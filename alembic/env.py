"""
Alembic env.py — асинхронные миграции через asyncpg.
"""

import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

# Add project root to path so we can import api.models
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

load_dotenv()

# Alembic Config object
config = context.config

# Set sqlalchemy.url from env
config.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL", ""))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import ALL models so autogenerate sees them
from api.database import Base
from api.models import (  # noqa: F401
    User, StudentProfile, TeacherProfile,
    Lecture, AudioFile, Transcription, AdminAction,
    TranscriptionTask, Board, BoardVisit,
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
