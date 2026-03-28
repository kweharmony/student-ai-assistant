"""
Скрипт создания первого администратора.
Запуск: python -m scripts.create_admin
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import select
from api.database import async_session
from api.models import User, UserRole
from api.auth import hash_password


async def main():
    login = input("Логин админа: ").strip()
    email = input("Email админа: ").strip()
    password = input("Пароль админа: ").strip()
    full_name = input("ФИО (необязательно): ").strip() or None

    async with async_session() as db:
        exists = await db.execute(select(User.id).where(User.login == login))
        if exists.scalar_one_or_none():
            print(f"Пользователь '{login}' уже существует!")
            return

        user = User(
            login=login,
            email=email,
            password_hash=hash_password(password),
            role=UserRole.admin,
            full_name=full_name,
        )
        db.add(user)
        await db.commit()
        print(f"Админ '{login}' создан! ID: {user.id}")


if __name__ == "__main__":
    asyncio.run(main())
