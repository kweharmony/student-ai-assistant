"""
Роутер для досок (Excalidraw-полотна).
Эндпоинты: CRUD + публичный доступ по share_token.
"""

import secrets
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_db
from ..dependencies import get_current_user
from ..models import Board, User
from ..schemas import BoardCreate, BoardDetailOut, BoardOut, BoardUpdate

router = APIRouter(prefix="/api/boards", tags=["boards"])


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


# ── получить полотно с данными ─────────────────────────────────────────────────
@router.get("/{board_id}", response_model=BoardDetailOut)
async def get_board(
    board_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    board = await _get_owned_board(board_id, current_user.id, db)
    return board


# ── сохранить данные полотна ───────────────────────────────────────────────────
@router.put("/{board_id}", response_model=BoardOut)
async def update_board(
    board_id: UUID,
    body: BoardUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    board = await _get_owned_board(board_id, current_user.id, db)
    if body.title is not None:
        board.title = body.title
    if body.data is not None:
        board.data = body.data
    if body.is_public is not None:
        board.is_public = body.is_public
    await db.commit()
    await db.refresh(board)
    return board


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


# ── создать / обновить share_token ─────────────────────────────────────────────
@router.post("/{board_id}/share", response_model=BoardOut)
async def enable_sharing(
    board_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    board = await _get_owned_board(board_id, current_user.id, db)
    if not board.share_token:
        board.share_token = secrets.token_urlsafe(32)
    board.is_public = True
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
    await db.commit()
    await db.refresh(board)
    return board


# ── публичный доступ по токену (только чтение) ────────────────────────────────
@router.get("/public/{token}", response_model=BoardDetailOut)
async def get_public_board(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Board).where(Board.share_token == token, Board.is_public == True)
    )
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Полотно не найдено или ссылка недействительна")
    return board


# ── helpers ────────────────────────────────────────────────────────────────────
async def _get_owned_board(board_id: UUID, user_id: UUID, db: AsyncSession) -> Board:
    result = await db.execute(select(Board).where(Board.id == board_id))
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Полотно не найдено")
    if board.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    return board
