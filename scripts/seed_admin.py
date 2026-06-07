"""
Создание начального администратора при первом запуске.
Вызывается из start.sh перед запуском сервера.
Если админ уже существует — пропускается.
"""

import asyncio
import os
import secrets
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from api.database import async_session
from api.models import User, UserRole
from api.auth import hash_password

# Учётные данные берутся из окружения; пароль НЕ хардкодим в коде.
# В продакшне задайте ADMIN_PASSWORD (напр. в .env). Если не задан —
# сгенерируем одноразовый случайный и выведем его в лог при создании.
ADMIN_LOGIN = os.environ.get("ADMIN_LOGIN", "admin")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@mindesync.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")


async def main():
    async with async_session() as db:
        result = await db.execute(select(User.id).where(User.login == ADMIN_LOGIN))
        if result.scalar_one_or_none() is not None:
            print(f"[seed] Админ '{ADMIN_LOGIN}' уже существует — пропускаем.")
            return

        password = ADMIN_PASSWORD or secrets.token_urlsafe(16)

        user = User(
            login=ADMIN_LOGIN,
            email=ADMIN_EMAIL,
            password_hash=hash_password(password),
            role=UserRole.admin,
            full_name="Администратор",
        )
        db.add(user)
        await db.commit()
        print(f"[seed] Админ '{ADMIN_LOGIN}' создан! ID: {user.id}")
        if not ADMIN_PASSWORD:
            print(
                f"[seed] ADMIN_PASSWORD не задан — сгенерирован пароль: {password}\n"
                f"[seed] Сохраните его и смените после первого входа."
            )


if __name__ == "__main__":
    asyncio.run(main())
