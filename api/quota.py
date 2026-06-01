"""
Лимиты генераций (система «подписок»).

Две независимых квоты со скользящим окном 30 дней:
  - generation — генерация заметок + AI-фильтр личной лекции (общий пул);
  - explain    — объяснение фрагмента (/api/ml/explain).

Остаток считается как COUNT(*) записей `generation_usage` за последние
30 дней. Списываем слот ДО запуска генерации (резерв от спама), при
провале — возвращаем (`refund`). Админ — без лимита; платный тариф (pro)
с истёкшим `subscription_expires_at` трактуется как free.
"""

import os
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import GenerationUsage, GenerationUsageKind, SubscriptionTier, User

WINDOW_DAYS = 30


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


# Лимиты по (вид квоты, тариф). Настраиваются через env.
LIMITS = {
    GenerationUsageKind.generation: {
        SubscriptionTier.free: _int_env("QUOTA_GEN_FREE", 5),
        SubscriptionTier.pro: _int_env("QUOTA_GEN_PRO", 15),
    },
    GenerationUsageKind.explain: {
        SubscriptionTier.free: _int_env("QUOTA_EXPLAIN_FREE", 10),
        SubscriptionTier.pro: _int_env("QUOTA_EXPLAIN_PRO", 30),
    },
}


def effective_tier(user: User) -> SubscriptionTier:
    """Фактический тариф с учётом истёкшего pro."""
    tier = user.subscription_tier or SubscriptionTier.free
    if isinstance(tier, str):
        tier = SubscriptionTier(tier)
    if tier == SubscriptionTier.pro and user.subscription_expires_at is not None:
        if user.subscription_expires_at < datetime.utcnow():
            return SubscriptionTier.free
    return tier


def is_unlimited(user: User) -> bool:
    """Админ генерирует без ограничений."""
    return user.role == "admin"


def limit_for(user: User, kind: GenerationUsageKind) -> Optional[int]:
    """Лимит для пользователя; None = без лимита."""
    if is_unlimited(user):
        return None
    return LIMITS[kind][effective_tier(user)]


def _window_cutoff() -> datetime:
    return datetime.utcnow() - timedelta(days=WINDOW_DAYS)


async def used_count(db: AsyncSession, user: User, kind: GenerationUsageKind) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(GenerationUsage)
        .where(
            GenerationUsage.user_id == user.id,
            GenerationUsage.kind == kind,
            GenerationUsage.created_at >= _window_cutoff(),
        )
    )
    return int(result.scalar_one())


async def next_reset_at(db: AsyncSession, user: User, kind: GenerationUsageKind) -> Optional[datetime]:
    """Когда освободится ближайший слот = самый старый расход в окне + 30 дней."""
    result = await db.execute(
        select(func.min(GenerationUsage.created_at)).where(
            GenerationUsage.user_id == user.id,
            GenerationUsage.kind == kind,
            GenerationUsage.created_at >= _window_cutoff(),
        )
    )
    earliest = result.scalar_one_or_none()
    if earliest is None:
        return None
    return earliest + timedelta(days=WINDOW_DAYS)


async def snapshot(db: AsyncSession, user: User, kind: GenerationUsageKind) -> dict:
    """Состояние квоты для ответа фронту."""
    limit = limit_for(user, kind)
    used = await used_count(db, user, kind)
    reset_at = await next_reset_at(db, user, kind)
    return {
        "kind": kind.value,
        "limit": limit,
        "used": used,
        "remaining": None if limit is None else max(0, limit - used),
        "unlimited": limit is None,
        "next_reset_at": reset_at,
    }


async def check_and_record(
    db: AsyncSession,
    user: User,
    kind: GenerationUsageKind,
    *,
    lecture_id: Optional[UUID] = None,
    mode: Optional[str] = None,
) -> Optional[UUID]:
    """Зарезервировать слот квоты.

    Бросает 429, если лимит исчерпан. Иначе пишет строку в `generation_usage`
    и возвращает её id (для возможного refund при провале генерации).
    Для пользователей без лимита (админ) ничего не пишет и возвращает None.
    """
    limit = limit_for(user, kind)
    if limit is None:
        return None

    used = await used_count(db, user, kind)
    if used >= limit:
        reset_at = await next_reset_at(db, user, kind)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "quota_exceeded",
                "kind": kind.value,
                "tier": effective_tier(user).value,
                "limit": limit,
                "used": used,
                "remaining": 0,
                "next_reset_at": reset_at.isoformat() if reset_at else None,
            },
        )

    usage = GenerationUsage(user_id=user.id, kind=kind, lecture_id=lecture_id, mode=mode)
    db.add(usage)
    await db.commit()
    await db.refresh(usage)
    return usage.id


async def refund(db: AsyncSession, usage_id: Optional[UUID]) -> None:
    """Вернуть слот квоты (при провале генерации)."""
    if usage_id is None:
        return
    await db.execute(delete(GenerationUsage).where(GenerationUsage.id == usage_id))
    await db.commit()
