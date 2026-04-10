"""
FastAPI-зависимости: сессия БД, текущий пользователь, проверка роли.
"""

from datetime import datetime
from typing import AsyncGenerator
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .database import async_session
from .auth import decode_access_token
from .models import User

security = HTTPBearer()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_access_token(creds.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный токен")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный токен")

    result = await db.execute(
        select(User)
        .options(selectinload(User.student_profile), selectinload(User.teacher_profile))
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


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права администратора")
    return user
