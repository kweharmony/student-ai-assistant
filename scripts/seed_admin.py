"""
Создание начального администратора при первом запуске.
Вызывается из start.sh перед запуском сервера.
Если админ уже существует — пропускается.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from api.database import async_session
from api.models import User, UserRole
from api.auth import hash_password

ADMIN_LOGIN = "admin"
ADMIN_PASSWORD = "435yeherha3SIWdg933!d2"
ADMIN_EMAIL = "admin@mindesync.local"


async def main():
    async with async_session() as db:
        result = await db.execute(select(User.id).where(User.login == ADMIN_LOGIN))
        if result.scalar_one_or_none() is not None:
            print(f"[seed] Админ '{ADMIN_LOGIN}' уже существует — пропускаем.")
            return

        user = User(
            login=ADMIN_LOGIN,
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            role=UserRole.admin,
            full_name="Администратор",
        )
        db.add(user)
        await db.commit()
        print(f"[seed] Админ '{ADMIN_LOGIN}' создан! ID: {user.id}")


if __name__ == "__main__":
    asyncio.run(main())
