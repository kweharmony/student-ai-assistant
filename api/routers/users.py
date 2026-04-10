"""
Роутер профиля: просмотр/обновление своего профиля, аватарка.
"""

import os
import shutil
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import hash_password, verify_password
from ..dependencies import get_current_user, get_db
from ..models import User
from ..schemas import ChangePasswordRequest, SetEmojiRequest, UserOut, UserUpdateRequest

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
