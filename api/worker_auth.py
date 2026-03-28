"""
Аутентификация воркеров через API-ключи.

Ключи задаются в переменной окружения:
  WORKER_API_KEYS=Sol PC:ключ1,Ivan Laptop:ключ2

Воркер передаёт ключ в заголовке: X-Worker-Key: <ключ>
"""

import os
from fastapi import Header, HTTPException, status


def _load_keys() -> dict[str, str]:
    """Парсит WORKER_API_KEYS и возвращает словарь {ключ: имя}."""
    raw = os.getenv("WORKER_API_KEYS", "")
    result: dict[str, str] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if ":" in pair:
            name, key = pair.split(":", 1)
            name = name.strip()
            key = key.strip()
            if key:
                result[key] = name
    return result


# Загружается один раз при старте сервера
_WORKER_KEYS: dict[str, str] = _load_keys()


def require_worker_key(x_worker_key: str = Header(...)) -> str:
    """
    FastAPI-зависимость. Проверяет заголовок X-Worker-Key.
    Возвращает имя воркера или бросает HTTP 401.
    """
    name = _WORKER_KEYS.get(x_worker_key)
    if not name:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid worker API key",
        )
    return name
