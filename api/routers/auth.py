"""
Роутер аутентификации: регистрация, логин, текущий пользователь.
"""

import random
import string
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import create_access_token, hash_password, verify_password
from ..dependencies import get_current_user, get_db
from ..models import Stream, StudentProfile, TeacherProfile, User, UserRole
from ..schemas import LoginRequest, RegisterRequest, RegisterResponse, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def _generate_login(email: str) -> str:
    """Генерирует логин из email-префикса + 4 случайных цифры."""
    prefix = email.split("@")[0]
    # Оставляем только буквы, цифры, точки и подчёркивания
    prefix = "".join(c for c in prefix if c.isalnum() or c in "._-")
    if len(prefix) < 2:
        prefix = "user"
    suffix = "".join(random.choices(string.digits, k=4))
    return f"{prefix}_{suffix}"


async def _unique_login(db: AsyncSession, email: str) -> str:
    """Генерирует уникальный логин, проверяя базу."""
    for _ in range(10):
        login = _generate_login(email)
        exists = await db.execute(select(User.id).where(User.login == login))
        if exists.scalar_one_or_none() is None:
            return login
    # Крайне маловероятно, но на всякий случай
    raise HTTPException(status_code=500, detail="Не удалось сгенерировать уникальный логин")


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Регистрация нового пользователя (студент или преподаватель)."""

    # Check email uniqueness
    exists = await db.execute(select(User.id).where(User.email == body.email))
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Email уже зарегистрирован")

    # Генерируем уникальный логин
    generated_login = await _unique_login(db, body.email)

    stream_id = body.stream_id
    if stream_id is not None:
        stream_exists = await db.execute(select(Stream.id).where(Stream.id == stream_id))
        if stream_exists.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Поток не найден")

    user = User(
        login=generated_login,
        email=body.email,
        password_hash=hash_password(body.password),
        role=UserRole(body.role),
        full_name=body.full_name,
        stream_id=stream_id,
    )
    db.add(user)
    await db.flush()  # get user.id

    # Create role-specific profile
    if body.role == "student":
        db.add(StudentProfile(
            user_id=user.id,
            group_name=body.group_name,
            course=body.course,
            faculty=body.faculty,
        ))
    elif body.role == "teacher":
        db.add(TeacherProfile(
            user_id=user.id,
            department=body.department,
            position=body.position,
            academic_degree=body.academic_degree,
        ))

    await db.commit()

    token = create_access_token(user.id, user.role.value)
    return RegisterResponse(access_token=token, generated_login=generated_login)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Вход по логину и паролю → JWT-токен."""

    result = await db.execute(
        select(User).where(User.email == body.email, User.is_deleted == False)
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")

    if not user.is_active:
        # Авто-разблокировка если срок истёк
        if user.blocked_until is not None and datetime.utcnow() >= user.blocked_until:
            user.is_active = True
            user.blocked_reason = None
            user.blocked_by = None
            user.blocked_at = None
            user.blocked_until = None
            await db.commit()
            await db.refresh(user)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Аккаунт заблокирован",
                    "reason": user.blocked_reason,
                    "blocked_until": user.blocked_until.isoformat() if user.blocked_until else None,
                },
            )

    user.last_login_at = datetime.utcnow()
    await db.commit()

    token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    """Текущий пользователь по JWT-токену."""
    return user
