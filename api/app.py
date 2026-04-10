"""
FastAPI-приложение MindeSync.
Подключает все роутеры: ML, транскрибация, auth, users, lectures, admin, worker.
"""

import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from .ml_endpoints import router as ml_router, add_logging_middleware
from .transcribe import router as transcribe_router
from .routers.auth import router as auth_router
from .routers.users import router as users_router
from .routers.lectures import router as lectures_router
from .routers.admin import router as admin_router
from .routers.worker import router as worker_router
from .routers.export import router as export_router


async def _timeout_recovery_loop() -> None:
    """
    Каждые 5 минут сбрасывает зависшие задачи (processing > 30 мин) обратно в pending.
    Если исчерпаны попытки — переводит в failed.
    """
    from sqlalchemy import update
    from .database import async_session
    from .models import TranscriptionTask, TranscriptionTaskStatus

    while True:
        await asyncio.sleep(300)  # 5 минут
        cutoff = datetime.utcnow() - timedelta(minutes=30)
        async with async_session() as db:
            # Задачи с исчерпанными попытками → failed
            await db.execute(
                update(TranscriptionTask)
                .where(
                    TranscriptionTask.status == TranscriptionTaskStatus.processing,
                    TranscriptionTask.started_at < cutoff,
                    TranscriptionTask.retry_count >= 3,
                )
                .values(
                    status=TranscriptionTaskStatus.failed,
                    worker_id=None,
                    worker_name=None,
                )
            )
            # Остальные зависшие задачи → pending (повторная попытка)
            await db.execute(
                update(TranscriptionTask)
                .where(
                    TranscriptionTask.status == TranscriptionTaskStatus.processing,
                    TranscriptionTask.started_at < cutoff,
                    TranscriptionTask.retry_count < 3,
                )
                .values(
                    status=TranscriptionTaskStatus.pending,
                    worker_id=None,
                    worker_name=None,
                    started_at=None,
                )
            )
            await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    recovery_task = asyncio.create_task(_timeout_recovery_loop())
    yield
    recovery_task.cancel()


app = FastAPI(title="MindeSync — Student AI Assistant API", lifespan=lifespan)

# CORS: origins from env or defaults
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

add_logging_middleware(app)

# Existing routers (without auth, backward-compatible)
app.include_router(ml_router)
app.include_router(transcribe_router)

# New routers (with auth)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(lectures_router)
app.include_router(admin_router)
app.include_router(worker_router)
app.include_router(export_router, prefix="/api")

# This allows running with: uvicorn api.app:app --reload
