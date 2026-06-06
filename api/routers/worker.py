"""
Worker API — эндпоинты для воркеров транскрибации.

Все эндпоинты требуют заголовок: X-Worker-Key: <ключ>
Ключи задаются в .env: WORKER_API_KEYS=Sol PC:ключ1,Ivan Laptop:ключ2
"""

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_db
from ..models import AudioFile, Lecture, LectureStatus, Transcription, TranscriptionTask, TranscriptionTaskStatus
from ..schemas import (
    TaskEnqueuedOut,
    TranscriptionTaskOut,
    WorkerErrorIn,
    WorkerHeartbeatIn,
    WorkerNextTaskOut,
    WorkerResultIn,
    WorkerStatusOut,
)
from ..worker_auth import require_worker_key

import os

router = APIRouter(prefix="/api/worker", tags=["Worker"])


@router.post("/register")
async def register_worker(worker_name: str = Depends(require_worker_key)):
    """Проверка ключа воркера. Возвращает имя воркера из конфига сервера."""
    return {"status": "ok", "worker_name": worker_name}


@router.get("/next", response_model=WorkerNextTaskOut)
async def get_next_task(
    worker_name: str = Depends(require_worker_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить следующую задачу из очереди.
    Использует SELECT FOR UPDATE SKIP LOCKED — два воркера никогда не возьмут одну задачу.
    """
    async with db.begin():
        result = await db.execute(
            select(TranscriptionTask)
            .where(TranscriptionTask.status == TranscriptionTaskStatus.pending)
            .order_by(TranscriptionTask.created_at.asc())
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        task = result.scalar_one_or_none()

        if task is None:
            return WorkerNextTaskOut(task=None)

        now = datetime.utcnow()
        task.status = TranscriptionTaskStatus.processing
        task.worker_name = worker_name
        task.worker_id = worker_name
        task.started_at = now
        task.last_heartbeat_at = now

    await db.refresh(task)
    return WorkerNextTaskOut(task=TranscriptionTaskOut.model_validate(task))


@router.get("/download/{task_id}")
async def download_audio(
    task_id: UUID,
    worker_name: str = Depends(require_worker_key),
    db: AsyncSession = Depends(get_db),
):
    """Скачать аудиофайл для транскрибации."""
    result = await db.execute(
        select(TranscriptionTask).where(TranscriptionTask.id == task_id)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    if task.worker_name != worker_name:
        raise HTTPException(status_code=403, detail="Эта задача принадлежит другому воркеру")

    audio_result = await db.execute(
        select(AudioFile).where(AudioFile.id == task.audio_file_id)
    )
    audio = audio_result.scalar_one_or_none()

    if audio is None or not os.path.exists(audio.file_path):
        raise HTTPException(status_code=404, detail="Аудиофайл не найден на диске")

    return FileResponse(
        path=audio.file_path,
        filename=audio.file_name,
        media_type=audio.mime_type or "application/octet-stream",
    )


@router.post("/result/{task_id}")
async def submit_result(
    task_id: UUID,
    body: WorkerResultIn,
    worker_name: str = Depends(require_worker_key),
    db: AsyncSession = Depends(get_db),
):
    """Отправить результат транскрибации."""
    result = await db.execute(
        select(TranscriptionTask).where(TranscriptionTask.id == task_id)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    if task.worker_name != worker_name:
        raise HTTPException(status_code=403, detail="Эта задача принадлежит другому воркеру")

    # Идемпотентность: если результат уже принят (повторная отправка из-за
    # потерянного ответа/ретрая), не создаём дубль транскрипта.
    if task.status == TranscriptionTaskStatus.completed:
        return {"status": "ok"}

    audio_result = await db.execute(
        select(AudioFile).where(AudioFile.id == task.audio_file_id)
    )
    audio = audio_result.scalar_one_or_none()

    if audio is None:
        raise HTTPException(status_code=404, detail="Аудиофайл не найден в БД")

    now = datetime.utcnow()

    # Создать запись транскрибации
    transcription = Transcription(
        lecture_id=audio.lecture_id,
        audio_file_id=audio.id,
        raw_text=body.raw_text,
        whisper_model=body.whisper_model,
        language=body.language,
        processing_time=body.processing_time,
    )
    db.add(transcription)

    # Обновить статус задачи
    task.status = TranscriptionTaskStatus.completed
    task.completed_at = now

    # Обновить статус лекции
    await db.execute(
        update(Lecture)
        .where(Lecture.id == audio.lecture_id)
        .values(status=LectureStatus.ready)
    )

    await db.commit()
    return {"status": "ok"}


@router.post("/error/{task_id}")
async def report_error(
    task_id: UUID,
    body: WorkerErrorIn,
    worker_name: str = Depends(require_worker_key),
    db: AsyncSession = Depends(get_db),
):
    """Сообщить об ошибке при обработке задачи."""
    result = await db.execute(
        select(TranscriptionTask).where(TranscriptionTask.id == task_id)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    if task.worker_name != worker_name:
        raise HTTPException(status_code=403, detail="Эта задача принадлежит другому воркеру")

    task.retry_count += 1
    task.error_message = body.error_message

    if task.retry_count >= 3:
        task.status = TranscriptionTaskStatus.failed
        will_retry = False
    else:
        task.status = TranscriptionTaskStatus.pending
        task.worker_name = None
        task.worker_id = None
        task.started_at = None
        will_retry = True

    await db.commit()
    return {"status": "ok", "will_retry": will_retry, "retry_count": task.retry_count}


@router.post("/heartbeat")
async def heartbeat(
    body: WorkerHeartbeatIn,
    worker_name: str = Depends(require_worker_key),
    db: AsyncSession = Depends(get_db),
):
    """Воркер сообщает что он ещё жив (каждые ~20 сек)."""
    if body.task_id is not None:
        result = await db.execute(
            select(TranscriptionTask).where(TranscriptionTask.id == body.task_id)
        )
        task = result.scalar_one_or_none()
        if task and task.worker_name == worker_name:
            task.last_heartbeat_at = datetime.utcnow()
            await db.commit()
    return {"status": "ok"}


@router.get("/status", response_model=WorkerStatusOut)
async def get_queue_status(
    worker_name: str = Depends(require_worker_key),
    db: AsyncSession = Depends(get_db),
):
    """Статус очереди: счётчики по статусам и список активных воркеров."""
    return await _get_worker_stats(db)


async def _get_worker_stats(db: AsyncSession) -> WorkerStatusOut:
    """Внутренняя функция для получения статистики — используется также в admin роутере."""
    counts_result = await db.execute(
        select(TranscriptionTask.status, func.count().label("cnt"))
        .group_by(TranscriptionTask.status)
    )
    counts = {row.status: row.cnt for row in counts_result}

    workers_result = await db.execute(
        select(TranscriptionTask.worker_name)
        .where(TranscriptionTask.status == TranscriptionTaskStatus.processing)
        .where(TranscriptionTask.worker_name.isnot(None))
        .distinct()
    )
    active_workers = [row.worker_name for row in workers_result]

    return WorkerStatusOut(
        pending=counts.get(TranscriptionTaskStatus.pending, 0),
        processing=counts.get(TranscriptionTaskStatus.processing, 0),
        completed=counts.get(TranscriptionTaskStatus.completed, 0),
        error=counts.get(TranscriptionTaskStatus.error, 0),
        failed=counts.get(TranscriptionTaskStatus.failed, 0),
        active_workers=active_workers,
    )
