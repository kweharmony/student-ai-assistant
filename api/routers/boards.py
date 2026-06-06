"""
Роутер для досок (Excalidraw-полотна).
Эндпоинты: CRUD + публичный доступ по share_token + WebSocket real-time collaboration.
"""

import asyncio
import json
import logging
import os
import secrets
import time
import uuid
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

try:
    import redis.asyncio as redis
except Exception:  # pragma: no cover - optional dependency
    redis = None

router = APIRouter(prefix="/api/boards", tags=["boards"])
logger = logging.getLogger(__name__)

# ── WebSocket rooms ───────────────────────────────────────────────────────────
_ws_rooms: dict[str, list[WebSocket]] = defaultdict(list)
_redis_client = None
_redis_warning_logged = False

# Серверный дебаунс записи доски в БД (п.6): храним только последний снапшот
# и пишем его не чаще раза в _SAVE_DEBOUNCE_SECONDS, по одному писателю на доску.
_SAVE_DEBOUNCE_SECONDS = 3.0
_pending_board_data: dict[str, str] = {}
_save_tasks: dict[str, asyncio.Task] = {}

# Короткоживущие WS-тикеты (п.10), чтобы не передавать JWT в query WS-URL.
# Используется Redis, если доступен, иначе — локальный словарь.
_WS_TICKET_TTL = 30  # секунд
_ws_tickets: dict[str, tuple[str, float]] = {}


async def _get_redis_client():
    global _redis_client, _redis_warning_logged
    if redis is None:
        if not _redis_warning_logged:
            _redis_warning_logged = True
            logger.warning(
                "REDIS_URL не задан / redis недоступен: realtime-синхронизация досок "
                "работает только в пределах одного процесса. Для нескольких воркеров "
                "обязательно настройте REDIS_URL."
            )
        return None
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        if not _redis_warning_logged:
            _redis_warning_logged = True
            logger.warning(
                "REDIS_URL не задан: realtime-синхронизация досок работает только в "
                "пределах одного процесса. Для нескольких воркеров настройте REDIS_URL."
            )
        return None
    if _redis_client is None:
        _redis_client = redis.from_url(redis_url, decode_responses=True)
    return _redis_client


# ── серверный дебаунс сохранения доски (п.6) ──────────────────────────────────
async def _schedule_board_save(board_id: str, data: str):
    """Запомнить последний снапшот и запланировать отложенную запись в БД."""
    _pending_board_data[board_id] = data
    task = _save_tasks.get(board_id)
    if task and not task.done():
        return  # уже запланировано — сохранится последний снапшот
    _save_tasks[board_id] = asyncio.create_task(_debounced_save(board_id))


async def _debounced_save(board_id: str):
    try:
        await asyncio.sleep(_SAVE_DEBOUNCE_SECONDS)
        data = _pending_board_data.pop(board_id, None)
        if data is not None:
            await _save_board_data(board_id, data)
    finally:
        _save_tasks.pop(board_id, None)


async def _flush_board_save(board_id: str):
    """Немедленно сохранить отложенный снапшот (например, при отключении всех)."""
    data = _pending_board_data.pop(board_id, None)
    if data is not None:
        await _save_board_data(board_id, data)


# ── WS-тикеты (п.10) ──────────────────────────────────────────────────────────
async def _create_ws_ticket(user_id: str) -> str:
    ticket = secrets.token_urlsafe(24)
    client = await _get_redis_client()
    if client is not None:
        try:
            await client.set(f"wsticket:{ticket}", user_id, ex=_WS_TICKET_TTL)
            return ticket
        except Exception:
            pass
    _ws_tickets[ticket] = (user_id, time.time() + _WS_TICKET_TTL)
    return ticket


async def _consume_ws_ticket(ticket: str) -> str | None:
    """Вернуть user_id по одноразовому тикету и удалить его."""
    client = await _get_redis_client()
    if client is not None:
        try:
            key = f"wsticket:{ticket}"
            user_id = await client.get(key)
            if user_id is not None:
                await client.delete(key)
                return user_id
        except Exception:
            pass
    entry = _ws_tickets.pop(ticket, None)
    if entry is None:
        return None
    user_id, expiry = entry
    if expiry < time.time():
        return None
    return user_id


async def _redis_listener(pubsub, websocket: WebSocket, client_id: str):
    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            try:
                payload = json.loads(message.get("data", "{}"))
            except Exception:
                continue
            if payload.get("sender_id") == client_id:
                continue
            await websocket.send_json(payload)
    except Exception:
        pass


async def _save_board_data(board_id: str, data: str):
    """Persist board data to PostgreSQL (fire-and-forget from websocket handler)."""
    try:
        async with async_session() as db:
            board = await db.get(Board, UUID(board_id))
            if board and board.data != data:
                board.data = data
                await db.commit()
    except Exception:
        # DB may be temporarily unavailable; next update will retry
        pass


async def _load_user(user_id: str, db: AsyncSession) -> User | None:
    """Загрузить активного пользователя по id (для WS-тикета/токена)."""
    try:
        uid = UUID(user_id)
    except (ValueError, AttributeError):
        return None
    result = await db.execute(
        select(User)
        .options(selectinload(User.student_profile), selectinload(User.teacher_profile), selectinload(User.stream))
        .where(User.id == uid, User.is_deleted == False)
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    return user


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
    return await _load_user(user_id, db)


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
    if body.show_cursors is not None and board.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только автор может менять показ курсоров")
    if body.title is not None:
        board.title = body.title
    if body.data is not None:
        board.data = body.data
    if body.is_public is not None:
        board.is_public = body.is_public
    if body.show_cursors is not None:
        board.show_cursors = body.show_cursors
    await db.commit()
    await db.refresh(board)
    return board


# ── WebSocket real-time collaboration ─────────────────────────────────────────
_PRESENCE_COLORS = [
    "#e07a5f", "#3d9a6c", "#5b8def", "#c97fb0",
    "#d9a441", "#7a6cc9", "#3aa6a6", "#cf6679",
]


async def _publish_or_broadcast(bid: str, redis_client, websocket: WebSocket, payload: dict):
    """Отправить payload остальным в комнате — через Redis (мульти-воркер) или локально."""
    if redis_client is not None:
        try:
            await redis_client.publish(f"boards:{bid}", json.dumps(payload))
            return
        except Exception:
            pass
    await _broadcast_to_room(bid, websocket, payload)


@router.websocket("/{board_id}/ws")
async def board_ws(
    board_id: UUID,
    websocket: WebSocket,
):
    """
    WebSocket для совместного редактирования в реальном времени.
    Аутентификация: ?ticket=<одноразовый> (предпочтительно) или ?token=<jwt>.
    """
    await websocket.accept()

    ticket = websocket.query_params.get("ticket")
    token = websocket.query_params.get("token")
    can_edit = False
    is_owner = False
    user = None
    async with async_session() as db:
        board = await db.get(Board, board_id)
        if not board:
            await websocket.close(code=4404, reason="Board not found")
            return

        if ticket:
            user_id = await _consume_ws_ticket(ticket)
            if user_id is not None:
                user = await _load_user(user_id, db)
        if user is None and token:
            user = await _authenticate_ws_token(token, db)

        if user is not None and board.owner_id == user.id:
            is_owner = True
        if user is not None and _can_edit_board(board, user):
            can_edit = True
        elif not board.is_public:
            await websocket.close(code=4403, reason="Forbidden")
            return

    bid = str(board_id)
    _ws_rooms[bid].append(websocket)
    client_id = str(uuid.uuid4())
    username = (getattr(user, "full_name", None) or getattr(user, "login", None) or "Гость") if user else "Гость"
    color = _PRESENCE_COLORS[hash(client_id) % len(_PRESENCE_COLORS)]
    redis_client = await _get_redis_client()
    pubsub = None
    redis_task = None
    if redis_client is not None:
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"boards:{bid}")
        redis_task = asyncio.create_task(_redis_listener(pubsub, websocket, client_id))

    try:
        while True:
            msg = await websocket.receive_json()
            mtype = msg.get("type")

            if mtype == "update":
                if not can_edit:
                    continue
                full_data = msg.get("data", "")
                if full_data:
                    # Серверный дебаунс записи в БД (п.6): только последний снапшот.
                    await _schedule_board_save(bid, full_data)
                # Шлём только сериализованный снапшот (п.5) — без дублирующих полей.
                payload = {"type": "update", "data": full_data, "sender_id": client_id}
                await _publish_or_broadcast(bid, redis_client, websocket, payload)

            elif mtype == "pointer":
                # Presence-курсоры (п.9): эфемерно, без записи и без gate на правку.
                payload = {
                    "type": "pointer",
                    "sender_id": client_id,
                    "x": msg.get("x"),
                    "y": msg.get("y"),
                    "username": username,
                    "color": color,
                }
                await _publish_or_broadcast(bid, redis_client, websocket, payload)

            elif mtype == "settings":
                # Менять настройки доски (показ курсоров) может только владелец.
                if not is_owner:
                    continue
                payload = {
                    "type": "settings",
                    "show_cursors": bool(msg.get("show_cursors", True)),
                    "sender_id": client_id,
                }
                await _publish_or_broadcast(bid, redis_client, websocket, payload)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # Сообщаем остальным, что участник ушёл — убрать его курсор (п.9).
        try:
            await _publish_or_broadcast(
                bid, redis_client, websocket,
                {"type": "leave", "sender_id": client_id},
            )
        except Exception:
            pass
        if redis_task is not None:
            redis_task.cancel()
        if pubsub is not None:
            try:
                await pubsub.unsubscribe()
                await pubsub.close()
            except Exception:
                pass
        listeners = _ws_rooms.get(bid, [])
        if websocket in listeners:
            listeners.remove(websocket)
        if not listeners:
            _ws_rooms.pop(bid, None)
            # Никого не осталось — немедленно сохраняем отложенный снапшот (п.6).
            await _flush_board_save(bid)


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


# ── сгенерировать новую ссылку (отозвать старую) ──────────────────────────────
@router.post("/{board_id}/share/rotate", response_model=BoardOut)
async def rotate_share_token(
    board_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Сменить share_token: старая ссылка немедленно перестаёт работать (п.2)."""
    board = await _get_owned_board(board_id, current_user.id, db)
    if not board.is_public:
        raise HTTPException(status_code=400, detail="Публичный доступ отключён")
    board.share_token = secrets.token_urlsafe(32)
    await db.commit()
    await db.refresh(board)
    return board


# ── короткоживущий тикет для WebSocket (вместо JWT в URL) ──────────────────────
@router.post("/{board_id}/ws-ticket")
async def create_ws_ticket(
    board_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Выдать одноразовый тикет (~30с) для подключения к WS без JWT в URL (п.10)."""
    await _get_accessible_board(board_id, current_user.id, db)
    ticket = await _create_ws_ticket(str(current_user.id))
    return {"ticket": ticket}


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
        "show_cursors": board.show_cursors,
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
        "show_cursors": board.show_cursors,
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
