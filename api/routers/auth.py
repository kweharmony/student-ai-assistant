"""
Роутер аутентификации: регистрация, логин, текущий пользователь, выход, обновление токена.
"""

import os
import random
import string
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    decode_access_token,
    hash_password,
    is_token_revoked,
    revoke_token,
    verify_password,
)
from ..dependencies import get_current_user, get_db
from ..models import Stream, StudentProfile, TeacherProfile, User, UserRole
from ..schemas import LoginRequest, RegisterRequest, RegisterResponse, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Флаг Secure для cookie: True только в продакшне за HTTPS
_COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"


def _set_auth_cookie(response: Response, token: str) -> None:
    """Устанавливает httpOnly cookie с JWT-токеном."""
    response.set_cookie(
        key="mindesync_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=_COOKIE_SECURE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def _generate_login(email: str) -> str:
    prefix = email.split("@")[0]
    prefix = "".join(c for c in prefix if c.isalnum() or c in "._-")
    if len(prefix) < 2:
        prefix = "user"
    suffix = "".join(random.choices(string.digits, k=4))
    return f"{prefix}_{suffix}"


async def _unique_login(db: AsyncSession, email: str) -> str:
    for _ in range(10):
        login = _generate_login(email)
        exists = await db.execute(select(User.id).where(User.login == login))
        if exists.scalar_one_or_none() is None:
            return login
    raise HTTPException(status_code=500, detail="Не удалось сгенерировать уникальный логин")


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Регистрация нового пользователя (студент или преподаватель)."""

    exists = await db.execute(select(User.id).where(User.email == body.email))
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Email уже зарегистрирован")

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
    await db.flush()

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
    _set_auth_cookie(response, token)
    return RegisterResponse(access_token=token, generated_login=generated_login)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Вход по email и паролю → JWT-токен + httpOnly cookie."""

    result = await db.execute(
        select(User).where(User.email == body.email, User.is_deleted == False)
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")

    if not user.is_active:
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
    _set_auth_cookie(response, token)
    return TokenResponse(access_token=token)


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Выход: отзывает токен в Redis и удаляет httpOnly cookie."""
    # Пробуем взять токен из cookie или Authorization header
    token = request.cookies.get("mindesync_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    if token:
        payload = decode_access_token(token)
        if payload:
            await revoke_token(payload)

    response.delete_cookie("mindesync_token", path="/")
    return {"status": "ok"}


@router.get("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Обновляет токен по httpOnly cookie.
    Вызывается фронтендом при перезагрузке страницы — позволяет восстановить
    сессию без localStorage.
    """
    token = request.cookies.get("mindesync_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия истекла")

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия истекла")

    if await is_token_revoked(payload):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия истекла")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный токен")

    result = await db.execute(
        select(User).where(User.id == UUID(user_id), User.is_deleted == False)
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")

    # Отзываем старый токен и выдаём новый (ротация)
    await revoke_token(payload)
    new_token = create_access_token(user.id, user.role.value)
    _set_auth_cookie(response, new_token)
    return TokenResponse(access_token=new_token)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    """Текущий пользователь по JWT-токену."""
    return user
