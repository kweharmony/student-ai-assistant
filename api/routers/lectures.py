"""
Роутер лекций: CRUD, загрузка аудио, запуск транскрибации.
"""

import mimetypes
import os
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..dependencies import get_current_user, get_db
from ..models import AudioFile, Lecture, LectureStatus, Transcription, User
from ..schemas import (
    AudioFileOut,
    LectureCreateRequest,
    LectureDetailOut,
    LectureOut,
    LectureUpdateRequest,
    TranscriptionOut,
)

router = APIRouter(prefix="/api/lectures", tags=["Lectures"])

DATA_DIR = Path(os.getenv("DATA_DIR", "/data"))
AUDIO_DIR = DATA_DIR / "audio"


# ---------- helpers ----------

async def _get_lecture_or_404(
    lecture_id: UUID, db: AsyncSession, *, load_relations: bool = False
) -> Lecture:
    stmt = select(Lecture).where(Lecture.id == lecture_id, Lecture.is_deleted == False)
    if load_relations:
        stmt = stmt.options(
            selectinload(Lecture.audio_files),
            selectinload(Lecture.transcriptions),
        )
    result = await db.execute(stmt)
    lecture = result.scalar_one_or_none()
    if lecture is None:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    return lecture


def _check_owner(lecture: Lecture, user: User):
    if lecture.uploaded_by != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этой лекции")


# ---------- CRUD ----------

@router.get("/", response_model=List[LectureOut])
async def list_lectures(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    subject: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Список моих лекций + публичные. Можно фильтровать по предмету."""

    stmt = (
        select(Lecture)
        .where(
            Lecture.is_deleted == False,
            or_(Lecture.uploaded_by == user.id, Lecture.is_public == True),
        )
        .order_by(Lecture.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if subject:
        stmt = stmt.where(Lecture.subject == subject)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", response_model=LectureOut, status_code=status.HTTP_201_CREATED)
async def create_lecture(
    body: LectureCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Создать новую лекцию."""

    lecture = Lecture(
        title=body.title,
        description=body.description,
        subject=body.subject,
        uploaded_by=user.id,
        is_public=body.is_public,
        status=LectureStatus.processing,
    )
    db.add(lecture)
    await db.commit()
    await db.refresh(lecture)
    return lecture


@router.get("/{lecture_id}", response_model=LectureDetailOut)
async def get_lecture(
    lecture_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Получить лекцию с аудиофайлами и транскрипциями."""

    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)

    # Access check: owner or public
    if lecture.uploaded_by != user.id and not lecture.is_public:
        raise HTTPException(status_code=403, detail="Нет доступа к этой лекции")

    # Filter out soft-deleted children
    lecture.audio_files = [a for a in lecture.audio_files if not a.is_deleted]
    lecture.transcriptions = [t for t in lecture.transcriptions if not t.is_deleted]

    return lecture


@router.put("/{lecture_id}", response_model=LectureOut)
async def update_lecture(
    lecture_id: UUID,
    body: LectureUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Обновить лекцию (только автор)."""

    lecture = await _get_lecture_or_404(lecture_id, db)
    _check_owner(lecture, user)

    if body.title is not None:
        lecture.title = body.title
    if body.description is not None:
        lecture.description = body.description
    if body.subject is not None:
        lecture.subject = body.subject
    if body.is_public is not None:
        lecture.is_public = body.is_public

    await db.commit()
    await db.refresh(lecture)
    return lecture


@router.delete("/{lecture_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lecture(
    lecture_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Мягкое удаление лекции (только автор)."""

    lecture = await _get_lecture_or_404(lecture_id, db)
    _check_owner(lecture, user)

    lecture.is_deleted = True
    lecture.deleted_by = user.id
    lecture.deleted_at = datetime.utcnow()
    await db.commit()


# ---------- Audio upload ----------

ALLOWED_AUDIO = {"mp3", "wav", "m4a", "flac", "ogg", "opus", "mp4", "mov", "avi", "mkv", "webm"}


@router.post("/{lecture_id}/audio", response_model=AudioFileOut, status_code=status.HTTP_201_CREATED)
async def upload_audio(
    lecture_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Загрузить аудиофайл к лекции → сохранить на диск → запись в audio_files."""

    lecture = await _get_lecture_or_404(lecture_id, db)
    _check_owner(lecture, user)

    ext = (file.filename or "unknown").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_AUDIO:
        raise HTTPException(status_code=400, detail=f"Формат .{ext} не поддерживается")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Файл пустой")

    # Save to disk: /data/audio/YYYY/MM/{uuid}-filename.ext
    now = datetime.utcnow()
    import uuid as _uuid_mod
    file_uuid = _uuid_mod.uuid4()
    month_dir = AUDIO_DIR / f"{now.year:04d}" / f"{now.month:02d}"
    month_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{file_uuid}-{file.filename}"
    file_path = month_dir / safe_name

    with open(file_path, "wb") as f:
        f.write(content)

    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"

    audio = AudioFile(
        lecture_id=lecture.id,
        file_path=str(file_path),
        file_name=file.filename or "unknown",
        file_size=len(content),
        mime_type=mime,
    )
    db.add(audio)
    await db.commit()
    await db.refresh(audio)
    return audio


# ---------- Transcription ----------

@router.post("/{lecture_id}/transcribe", response_model=TranscriptionOut, status_code=status.HTTP_201_CREATED)
async def transcribe_lecture_audio(
    lecture_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Запустить транскрибацию последнего аудиофайла лекции.
    Использует тот же Whisper, что и /api/transcribe/audio, но сохраняет результат в БД.
    """

    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)
    _check_owner(lecture, user)

    # Find latest non-deleted audio
    active_audio = [a for a in lecture.audio_files if not a.is_deleted]
    if not active_audio:
        raise HTTPException(status_code=400, detail="Нет аудиофайлов для транскрибации")

    audio = sorted(active_audio, key=lambda a: a.created_at, reverse=True)[0]

    if not os.path.exists(audio.file_path):
        raise HTTPException(status_code=404, detail="Аудиофайл не найден на диске")

    # Import whisper helpers from existing transcribe module
    from ..transcribe import get_whisper_model, _model_name

    try:
        from ...ml.profanity_filter import filter_profanity
    except (ImportError, ValueError):
        from ml.profanity_filter import filter_profanity

    start = time.time()
    model = get_whisper_model()
    result = model.transcribe(audio.file_path, language="ru", task="transcribe", fp16=False, verbose=False)
    processing_time = time.time() - start

    raw_text = result["text"]
    detected_lang = result.get("language", "ru")

    # Apply profanity filter
    filtered_text = filter_profanity(raw_text)

    transcription = Transcription(
        lecture_id=lecture.id,
        audio_file_id=audio.id,
        raw_text=filtered_text,
        whisper_model=_model_name,
        language=detected_lang,
        processing_time=processing_time,
    )
    db.add(transcription)

    # Update lecture status
    lecture.status = LectureStatus.ready
    await db.commit()
    await db.refresh(transcription)
    return transcription
