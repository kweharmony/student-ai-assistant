"""
FastAPI-зависимости: сессия БД, текущий пользователь, проверка роли.
"""

from datetime import datetime
from typing import AsyncGenerator, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .database import async_session
from .auth import decode_access_token, is_token_revoked
from .models import User

# auto_error=False — чтобы самостоятельно обработать отсутствие заголовка
# и попробовать cookie как fallback
optional_security = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


def _extract_token(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials],
) -> Optional[str]:
    """Bearer header → приоритет. httpOnly cookie → fallback."""
    if creds is not None:
        return creds.credentials
    return request.cookies.get("mindesync_token")


async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _extract_token(request, creds)
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация")

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный токен")

    if await is_token_revoked(payload):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Токен отозван, войдите снова")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный токен")

    result = await db.execute(
        select(User)
        .options(selectinload(User.student_profile), selectinload(User.teacher_profile), selectinload(User.stream))
        .where(User.id == UUID(user_id), User.is_deleted == False)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")

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

    return user


async def get_current_user_optional(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    token = _extract_token(request, creds)
    if token is None:
        return None

    payload = decode_access_token(token)
    if payload is None:
        return None

    if await is_token_revoked(payload):
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


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права администратора")
    return user


def can_moderate_stream(user: User, stream_id: UUID | None) -> bool:
    if user.role == "admin":
        return True
    if user.is_group_head and user.stream_id is not None and stream_id is not None:
        return user.stream_id == stream_id
    return False


async def require_catalog_moderator(user: User = Depends(get_current_user)) -> User:
    if user.role == "admin":
        return user
    if user.is_group_head and user.stream_id is not None:
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Требуются права администратора или старосты с назначенным потоком",
    )
