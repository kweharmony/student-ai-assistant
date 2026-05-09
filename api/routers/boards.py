"""
Роутер для досок (Excalidraw-полотна).
Эндпоинты: CRUD + публичный доступ по share_token + WebSocket real-time collaboration.
"""

import asyncio
import secrets
from collections import defaultdict
from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import async_session
from ..dependencies import get_db
from ..dependencies import get_current_user
from ..dependencies import get_current_user_optional
from ..auth import decode_access_token
from ..models import Board, BoardVisit, User
from ..schemas import BoardCreate, BoardDetailOut, BoardOut, BoardRecentOut, BoardShareRequest, BoardUpdate

router = APIRouter(prefix="/api/boards", tags=["boards"])

# ── WebSocket rooms & in-memory state ─────────────────────────────────────────
# board_id (str) -> list of connected WebSocket clients
_ws_rooms: dict[str, list[WebSocket]] = defaultdict(list)
# latest data JSON snapshot per board (for periodic flush to DB)
_board_snapshots: dict[str, str] = {}


async def _periodic_flush_boards():
    """Save in-memory board snapshots to PostgreSQL every 5 seconds."""
    while True:
        await asyncio.sleep(5)
        if not _board_snapshots:
            continue
        try:
            async with async_session() as db:
                for bid, data in list(_board_snapshots.items()):
                    try:
                        board = await db.get(Board, UUID(bid))
                        if board and board.data != data:
                            board.data = data
                        if len(_ws_rooms.get(bid, [])) == 0:
                            # nobody connected — clean up snapshot
                            _board_snapshots.pop(bid, None)
                    except Exception:
                        continue
                await db.commit()
        except Exception:
            # DB may be temporarily unavailable; retry next cycle
            pass


# start background flusher
try:
    asyncio.get_running_loop().create_task(_periodic_flush_boards())
except RuntimeError:
    # no running loop at import time; will be started on first request
    pass


async def _authenticate_ws_token(token: str | None, db: AsyncSession) -> User | None:
    """Decode JWT from WebSocket query param and return user or None."""
    if not token:
        return None
    payload = decode_access_token(token)
    if payload is None:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    result = await db.execute(
        select(User)
        .options(selectinload(User.student_profile), selectinload(User.teacher_profile), selectinload(User.stream))
        .where(User.id == UUID(user_id), User.is_deleted == False)
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    return user


async def _broadcast_to_room(board_id: str, sender: WebSocket, payload: dict):
    """Send JSON payload to every socket in the room except sender."""
    listeners = _ws_rooms.get(board_id, [])
    dead = []
    for ws in listeners:
        if ws is sender:
            continue
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for d in dead:
        if d in listeners:
            listeners.remove(d)


# ── список полотен текущего пользователя ──────────────────────────────────────
@router.get("", response_model=List[BoardOut])
async def list_boards(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Board)
        .where(Board.owner_id == current_user.id)
        .order_by(Board.updated_at.desc())
    )
    return result.scalars().all()


# ── список недавно открытых чужих полотен ────────────────────────────────────
@router.get("/recent", response_model=List[BoardRecentOut])
async def list_recent_boards(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BoardVisit, Board)
        .join(Board, Board.id == BoardVisit.board_id)
        .options(selectinload(Board.owner))
        .where(BoardVisit.user_id == current_user.id, Board.owner_id != current_user.id)
        .order_by(BoardVisit.last_opened_at.desc())
    )

    items: list[dict] = []
    for visit, board in result.all():
        items.append(_serialize_recent_board(board, visit))
    return items


# ── создать полотно ────────────────────────────────────────────────────────────
@router.post("", response_model=BoardOut, status_code=status.HTTP_201_CREATED)
async def create_board(
    body: BoardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    board = Board(title=body.title, owner_id=current_user.id)
    db.add(board)
    await db.commit()
    await db.refresh(board)
    return board


# ── публичный доступ по токену ────────────────────────────────────────────────
@router.get("/public/{token}", response_model=BoardDetailOut)
async def get_public_board(
    token: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Board)
        .options(selectinload(Board.owner))
        .where(Board.share_token == token, Board.is_public == True)
    )
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Полотно не найдено или ссылка недействительна")

    await _record_board_visit(board, current_user, db)
    return _serialize_board_detail(board, current_user)


# ── получить полотно с данными ─────────────────────────────────────────────────
@router.get("/{board_id}", response_model=BoardDetailOut)
async def get_board(
    board_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    board = await _get_accessible_board(board_id, current_user.id, db)
    await _record_board_visit(board, current_user, db)
    return _serialize_board_detail(board, current_user)


# ── сохранить данные полотна (manual / fallback) ───────────────────────────────
@router.put("/{board_id}", response_model=BoardOut)
async def update_board(
    board_id: UUID,
    body: BoardUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    board = await _get_accessible_board(board_id, current_user.id, db)
    if not _can_edit_board(board, current_user):
        raise HTTPException(status_code=403, detail="Нет доступа на редактирование")
    if body.is_public is not None and board.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только автор может менять режим публикации")
    if body.title is not None:
        board.title = body.title
    if body.data is not None:
        board.data = body.data
    if body.is_public is not None:
        board.is_public = body.is_public
    await db.commit()
    await db.refresh(board)
    return board


# ── WebSocket real-time collaboration ─────────────────────────────────────────
@router.websocket("/{board_id}/ws")
async def board_ws(
    board_id: UUID,
    websocket: WebSocket,
):
    """
    WebSocket endpoint for collaborative real-time board editing.
    Client must provide ?token=<jwt> query param.
    """
    await websocket.accept()

    token = websocket.query_params.get("token")
    async with async_session() as db:
        user = await _authenticate_ws_token(token, db)
        if user is None:
            await websocket.close(code=4401, reason="Unauthorized")
            return

        board = await db.get(Board, board_id)
        if not board:
            await websocket.close(code=4404, reason="Board not found")
            return
        if not _can_edit_board(board, user):
            await websocket.close(code=4403, reason="Forbidden")
            return

    bid = str(board_id)
    _ws_rooms[bid].append(websocket)

    try:
        while True:
            msg = await websocket.receive_json()
            if msg.get("type") == "update":
                elements = msg.get("elements", [])
                app_state = msg.get("appState", {})
                # reconstruct full Excalidraw JSON string for DB snapshot
                full_data = msg.get("data", "")
                if full_data:
                    _board_snapshots[bid] = full_data
                payload = {"type": "update", "elements": elements, "appState": app_state}
                await _broadcast_to_room(bid, websocket, payload)
    except WebSocketDisconnect:
        pass
    finally:
        listeners = _ws_rooms.get(bid, [])
        if websocket in listeners:
            listeners.remove(websocket)
        if not listeners:
            _ws_rooms.pop(bid, None)


# ── удалить полотно ────────────────────────────────────────────────────────────
@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board(
    board_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    board = await _get_owned_board(board_id, current_user.id, db)
    await db.delete(board)
    await db.commit()


# ── создать / обновить share_token и режим доступа ───────────────────────────
@router.post("/{board_id}/share", response_model=BoardOut)
async def enable_sharing(
    board_id: UUID,
    body: BoardShareRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    board = await _get_owned_board(board_id, current_user.id, db)
    if not board.share_token:
        board.share_token = secrets.token_urlsafe(32)
    board.is_public = True
    board.share_mode = body.mode
    await db.commit()
    await db.refresh(board)
    return board


# ── отключить публичный доступ ─────────────────────────────────────────────────
@router.delete("/{board_id}/share", response_model=BoardOut)
async def disable_sharing(
    board_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    board = await _get_owned_board(board_id, current_user.id, db)
    board.share_token = None
    board.is_public = False
    board.share_mode = "view"
    await db.commit()
    await db.refresh(board)
    return board


# ── убрать из недавних ────────────────────────────────────────────────────────
@router.delete("/recent/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_recent_board(
    board_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(BoardVisit).where(BoardVisit.board_id == board_id, BoardVisit.user_id == current_user.id)
    )
    await db.commit()


# ── helpers ────────────────────────────────────────────────────────────────────
def _can_edit_board(board: Board, user: User | None) -> bool:
    if user is None:
        return False
    if board.owner_id == user.id:
        return True
    return board.is_public and board.share_mode == "edit"


async def _record_board_visit(board: Board, user: User | None, db: AsyncSession) -> None:
    if user is None or board.owner_id == user.id:
        return

    result = await db.execute(
        select(BoardVisit).where(BoardVisit.board_id == board.id, BoardVisit.user_id == user.id)
    )
    visit = result.scalar_one_or_none()
    if visit is None:
        visit = BoardVisit(
            board_id=board.id,
            user_id=user.id,
            last_access_mode=board.share_mode,
            last_opened_at=datetime.utcnow(),
        )
        db.add(visit)
    else:
        visit.last_access_mode = board.share_mode
        visit.last_opened_at = datetime.utcnow()
    await db.commit()


def _serialize_owner(board: Board):
    owner = board.owner
    if not owner:
        return None
    return {
        "id": owner.id,
        "login": owner.login,
        "full_name": owner.full_name,
        "role": owner.role.value,
    }


def _serialize_board_detail(board: Board, current_user: User | None):
    return {
        "id": board.id,
        "title": board.title,
        "is_public": board.is_public,
        "share_token": board.share_token,
        "share_mode": board.share_mode,
        "created_at": board.created_at,
        "updated_at": board.updated_at,
        "data": board.data,
        "owner": _serialize_owner(board),
        "can_edit": _can_edit_board(board, current_user),
    }


def _serialize_recent_board(board: Board, visit: BoardVisit):
    return {
        "id": board.id,
        "title": board.title,
        "is_public": board.is_public,
        "share_token": board.share_token,
        "share_mode": board.share_mode,
        "created_at": board.created_at,
        "updated_at": board.updated_at,
        "owner": _serialize_owner(board),
        "last_opened_at": visit.last_opened_at,
        "last_access_mode": visit.last_access_mode,
    }


async def _get_owned_board(board_id: UUID, user_id: UUID, db: AsyncSession) -> Board:
    result = await db.execute(select(Board).where(Board.id == board_id))
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Полотно не найдено")
    if board.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    return board


async def _get_accessible_board(board_id: UUID, user_id: UUID, db: AsyncSession) -> Board:
    result = await db.execute(
        select(Board).options(selectinload(Board.owner)).where(Board.id == board_id)
    )
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Полотно не найдено")
    if board.owner_id != user_id and not board.is_public:
        raise HTTPException(status_code=403, detail="Нет доступа")
    return board
