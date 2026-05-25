"""
JWT-токены, хеширование паролей, инвалидация токенов через Redis.
"""

import os
import uuid as _uuid_mod
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

import bcrypt
from jose import JWTError, jwt
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-to-random-64-char-string-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# Redis для инвалидации токенов (опционально — при отсутствии REDIS_URL работает без него)
try:
    import redis.asyncio as _aioredis
    _redis_client: Optional[_aioredis.Redis] = None

    async def _get_redis() -> Optional[_aioredis.Redis]:
        global _redis_client
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            return None
        if _redis_client is None:
            _redis_client = _aioredis.from_url(redis_url, decode_responses=True)
        return _redis_client

except ImportError:
    async def _get_redis():  # type: ignore[misc]
        return None


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: UUID, role: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "jti": str(_uuid_mod.uuid4()),  # уникальный ID для инвалидации
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Возвращает payload или None при невалидном/истёкшем токене."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


async def revoke_token(payload: dict) -> None:
    """Помещает jti токена в Redis-блэклист до истечения его срока."""
    redis = await _get_redis()
    if redis is None:
        return
    jti = payload.get("jti")
    exp = payload.get("exp")
    if not jti or not exp:
        return
    ttl = max(int(exp - datetime.utcnow().timestamp()), 1)
    await redis.setex(f"revoked:{jti}", ttl, "1")


async def is_token_revoked(payload: dict) -> bool:
    """Возвращает True если токен был отозван через logout."""
    redis = await _get_redis()
    if redis is None:
        return False
    jti = payload.get("jti")
    if not jti:
        return False
    return bool(await redis.exists(f"revoked:{jti}"))
