"""
Роутер профиля: просмотр/обновление своего профиля, аватарка.
"""

import os
import shutil
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import re

from ..auth import hash_password, verify_password
from ..dependencies import get_current_user, get_db
from ..models import Direction, Faculty, Stream, User
from ..schemas import ChangePasswordRequest, SetEmojiRequest, StreamCreateForUserIn, UserOut, UserRoleUpdateIn, UserUpdateRequest

router = APIRouter(prefix="/api/users", tags=["Users"])

DATA_DIR = Path(os.getenv("DATA_DIR", "/data"))
AVATARS_DIR = DATA_DIR / "avatars"


@router.get("/me", response_model=UserOut)
async def get_my_profile(user: User = Depends(get_current_user)):
    """Мой профиль с данными student_profile / teacher_profile."""
    return user


@router.put("/me", response_model=UserOut)
async def update_my_profile(
    body: UserUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить свой профиль."""
    if body.stream_id is not None:
        stream_result = await db.execute(select(Stream).where(Stream.id == body.stream_id))
        stream = stream_result.scalar_one_or_none()
        if stream is None:
            raise HTTPException(status_code=400, detail="Поток не найден")
        user.stream_id = stream.id

    if body.full_name is not None:
        user.full_name = body.full_name
    if body.email is not None:
        user.email = body.email

    # Update role-specific profile
    if user.student_profile:
        prof = user.student_profile
        if body.group_name is not None:
            prof.group_name = body.group_name
        if body.course is not None:
            prof.course = body.course
        if body.faculty is not None:
            prof.faculty = body.faculty

    if user.teacher_profile:
        prof = user.teacher_profile
        if body.department is not None:
            prof.department = body.department
        if body.position is not None:
            prof.position = body.position
        if body.academic_degree is not None:
            prof.academic_degree = body.academic_degree

    await db.commit()
    await db.refresh(user)
    return user


@router.put("/me/role", response_model=UserOut)
async def set_own_role(
    body: UserRoleUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.can_choose_role:
        raise HTTPException(status_code=403, detail="Самостоятельный выбор роли недоступен для вашего аккаунта")
    from ..models import UserRole
    user.role = UserRole(body.role)
    user.can_choose_role = False
    await db.commit()
    await db.refresh(user)
    return user


STREAM_NAME_RE = re.compile(r'^[А-ЯA-ZЁ]+\d{2}$')


@router.post("/me/stream", response_model=UserOut)
async def create_and_assign_stream(
    body: StreamCreateForUserIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stream_name = body.stream_name.strip().upper()
    if not STREAM_NAME_RE.match(stream_name):
        raise HTTPException(
            status_code=400,
            detail="Название потока должно быть в формате «БВТ24»: заглавные буквы + 2 цифры",
        )

    existing_result = await db.execute(select(Stream).where(Stream.name == stream_name))
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail="Поток с таким названием уже существует. Выберите его из списка.",
        )

    faculty_result = await db.execute(select(Faculty).where(Faculty.id == body.faculty_id))
    if faculty_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Факультет не найден")

    direction_result = await db.execute(
        select(Direction).where(
            Direction.id == body.direction_id,
            Direction.faculty_id == body.faculty_id,
        )
    )
    direction = direction_result.scalar_one_or_none()
    if direction is None:
        raise HTTPException(status_code=404, detail="Направление не найдено")

    new_stream = Stream(direction_id=direction.id, name=stream_name)
    db.add(new_stream)
    await db.flush()

    user.stream_id = new_stream.id
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/me/password", status_code=204)
async def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Изменить свой пароль."""
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    user.password_hash = hash_password(body.new_password)
    await db.commit()


@router.put("/me/avatar-emoji", response_model=UserOut)
async def set_avatar_emoji(
    body: SetEmojiRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Установить эмодзи как аватарку."""
    user.avatar_emoji = body.emoji
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/me/avatar-emoji", response_model=UserOut)
async def delete_avatar_emoji(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить эмодзи-аватарку."""
    user.avatar_emoji = None
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Загрузить аватарку (jpg/png, до 5 MB)."""

    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Допустимы только JPEG, PNG, WebP")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Максимальный размер аватарки — 5 MB")

    ext = file.content_type.split("/")[-1]
    if ext == "jpeg":
        ext = "jpg"

    AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{user.id}.{ext}"
    filepath = AVATARS_DIR / filename

    with open(filepath, "wb") as f:
        f.write(content)

    user.avatar_url = f"/data/avatars/{filename}"
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/me/avatar", response_model=UserOut)
async def delete_avatar(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить свою аватарку."""

    if user.avatar_url:
        path = Path(user.avatar_url)
        # avatar_url stores relative like /data/avatars/uuid.jpg
        full_path = DATA_DIR.parent / path.relative_to("/")
        if full_path.exists():
            full_path.unlink()

    user.avatar_url = None
    await db.commit()
    await db.refresh(user)
    return user
