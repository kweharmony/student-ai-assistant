"""
Эндпоинты для работы с аудиофайлами.
- /upload — сохраняет аудио + создаёт лекцию в БД
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import os
import logging
import uuid as uuid_mod
from pathlib import Path
from datetime import datetime, timedelta
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from .dependencies import get_db, get_current_user
from .models import Lecture, AudioFile, LectureStatus, TranscriptionTask, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcribe", tags=["Audio Transcription"])

# Директория для хранения загруженных аудиофайлов
UPLOAD_DIR = Path(os.getenv("DATA_DIR", "/data")) / "audio_queue"

ALLOWED_FORMATS = {'mp3', 'wav', 'm4a', 'flac', 'ogg', 'opus', 'mp4', 'mov', 'avi', 'mkv', 'webm'}


class UploadResponse(BaseModel):
    """Ответ на загрузку аудиофайла"""
    success: bool
    message: str
    filename: str
    file_id: str
    file_size_mb: float
    lecture_id: str
    task_id: str


@router.post("/upload", response_model=UploadResponse)
async def upload_audio(
    audio: UploadFile = File(...),
    title: str = Form(...),
    subject: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    lecture_date: Optional[str] = Form(None),
    is_public: bool = Form(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Загружает аудиофайл и создаёт лекцию в БД.
    """

    # Проверка формата
    file_extension = audio.filename.split('.')[-1].lower() if audio.filename else ''

    if file_extension not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Формат .{file_extension} не поддерживается. Разрешены: {', '.join(sorted(ALLOWED_FORMATS))}"
        )

    try:
        content = await audio.read()

        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Файл пустой")

        file_size_mb = len(content) / (1024 * 1024)

        if file_size_mb > 100:
            raise HTTPException(status_code=400, detail="Файл слишком большой. Максимум 100 МБ.")

        # Добавляем дату лекции в описание, если указана
        full_description = description or ""
        if lecture_date:
            full_description = f"Дата лекции: {lecture_date}\n{full_description}".strip()

        # Создаём лекцию в БД
        lecture = Lecture(
            title=title,
            description=full_description or None,
            subject=subject or None,
            uploaded_by=user.id,
            status=LectureStatus.processing,
            is_public=is_public,
        )
        db.add(lecture)
        await db.flush()

        # Создаём директорию YYYY/MM для организации файлов
        now = datetime.utcnow()
        date_dir = UPLOAD_DIR / str(now.year) / f"{now.month:02d}"
        date_dir.mkdir(parents=True, exist_ok=True)

        # Уникальное имя файла
        file_id = str(uuid_mod.uuid4())[:8]
        safe_filename = f"{file_id}-{audio.filename}"
        file_path = date_dir / safe_filename

        # Сохраняем файл на диск
        with open(file_path, "wb") as f:
            f.write(content)

        # Определяем MIME тип
        mime_map = {
            'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'm4a': 'audio/mp4',
            'flac': 'audio/flac', 'ogg': 'audio/ogg', 'opus': 'audio/opus',
            'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo',
            'mkv': 'video/x-matroska', 'webm': 'video/webm',
        }

        # Создаём запись AudioFile в БД
        audio_record = AudioFile(
            lecture_id=lecture.id,
            file_path=str(file_path),
            file_name=audio.filename,
            file_size=len(content),
            mime_type=mime_map.get(file_extension),
            audio_expires_at=datetime.utcnow() + timedelta(days=7),
        )
        db.add(audio_record)
        await db.flush()

        # Создаём задачу на транскрибацию
        task = TranscriptionTask(audio_file_id=audio_record.id)
        db.add(task)
        await db.commit()
        await db.refresh(task)

        logger.info(f"Лекция '{title}' создана, аудио сохранено: {file_path} ({file_size_mb:.1f} МБ)")

        return UploadResponse(
            success=True,
            message="Лекция создана. Файл поставлен в очередь на транскрибацию.",
            filename=audio.filename,
            file_id=file_id,
            file_size_mb=round(file_size_mb, 2),
            lecture_id=str(lecture.id),
            task_id=str(task.id),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка загрузки: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении: {str(e)}")


class FilterRequest(BaseModel):
    text: str


class FilterResponse(BaseModel):
    success: bool
    filtered_text: str
    error: Optional[str] = None


@router.post("/filter", response_model=FilterResponse)
async def filter_transcription(body: FilterRequest):
    """
    AI-фильтрация транскрибированного текста через DeepSeek.
    Исправляет ошибки распознавания, удаляет слова-паразиты, форматирует текст.
    """
    if not body.text or len(body.text.strip()) < 5:
        raise HTTPException(status_code=400, detail="Текст слишком короткий")

    try:
        from ml.transcription_filter import TranscriptionFilter
        fltr = TranscriptionFilter()
        filtered = await asyncio.get_event_loop().run_in_executor(
            None, fltr.filter_text, body.text
        )
        return FilterResponse(success=True, filtered_text=filtered)
    except Exception as e:
        logger.error(f"Ошибка фильтрации: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка фильтрации: {str(e)}")


@router.get("/health")
async def health_check():
    """Проверка работоспособности"""
    return {
        "status": "healthy",
        "message": "Сервис загрузки аудио работает. Транскрибация через очередь (в разработке).",
        "upload_enabled": True,
        "transcription_enabled": True
    }
