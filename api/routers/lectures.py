"""
Роутер лекций: CRUD, загрузка аудио, запуск транскрибации.
"""

import mimetypes
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..dependencies import can_moderate_stream, get_current_user, get_db
from ..models import AudioFile, Lecture, LectureCatalogItem, LectureNote, LectureStatus, Transcription, TranscriptionTask, User
import asyncio
from uuid import UUID as PyUUID

from ..schemas import (
    ApplyFilterOut,
    AudioFileOut,
    LectureCreateRequest,
    LectureDetailOut,
    LectureMyOut,
    LectureNoteContentOut,
    LectureNoteIn,
    LectureNoteOut,
    LectureOut,
    LectureUpdateRequest,
    SaveTextIn,
    TaskEnqueuedOut,
    TranscriptionOut,
    TranscriptionTaskOut,
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
            selectinload(Lecture.catalog_item),
        )
    result = await db.execute(stmt)
    lecture = result.scalar_one_or_none()
    if lecture is None:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    return lecture


def _check_owner(lecture: Lecture, user: User):
    if lecture.uploaded_by != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этой лекции")


def _check_owner_or_catalog_moderator(lecture: Lecture, user: User):
    if lecture.uploaded_by == user.id:
        return
    if lecture.catalog_item is not None and can_moderate_stream(user, lecture.catalog_item.stream_id):
        return
    raise HTTPException(status_code=403, detail="Нет прав на изменение этой лекции")


def _can_read_lecture(lecture: Lecture, user: User) -> bool:
    if lecture.uploaded_by == user.id:
        return True
    if lecture.is_public:
        return True
    if lecture.catalog_item is not None:
        return True
    return False


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


@router.get("/my", response_model=List[LectureMyOut])
async def list_my_lectures(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Список лекций текущего пользователя с задачами транскрибации."""

    stmt = (
        select(Lecture)
        .where(Lecture.uploaded_by == user.id, Lecture.is_deleted == False)
        .options(
            selectinload(Lecture.transcriptions),
            selectinload(Lecture.audio_files),
            selectinload(Lecture.notes),
        )
        .order_by(Lecture.created_at.desc())
    )
    result = await db.execute(stmt)
    lectures = result.scalars().all()

    out: List[LectureMyOut] = []
    has_audio_expiry_backfill = False
    for lec in lectures:
        active_transcriptions = [t for t in lec.transcriptions if not t.is_deleted]
        active_audio = [a for a in lec.audio_files if not a.is_deleted]

        task_status: Optional[str] = None
        audio_expires_at = None
        if active_audio:
            latest_audio = sorted(active_audio, key=lambda a: a.created_at, reverse=True)[0]
            if latest_audio.audio_expires_at is None:
                latest_audio.audio_expires_at = latest_audio.created_at + timedelta(days=7)
                has_audio_expiry_backfill = True
            audio_expires_at = latest_audio.audio_expires_at
            task_result = await db.execute(
                select(TranscriptionTask)
                .where(TranscriptionTask.audio_file_id == latest_audio.id)
                .order_by(TranscriptionTask.created_at.desc())
                .limit(1)
            )
            task = task_result.scalar_one_or_none()
            if task:
                task_status = task.status.value

        latest_transcription = (
            sorted(active_transcriptions, key=lambda t: t.created_at, reverse=True)[0]
            if active_transcriptions else None
        )

        out.append(LectureMyOut(
            id=lec.id,
            title=lec.title,
            subject=lec.subject,
            status=lec.status.value,
            created_at=lec.created_at,
            task_status=task_status,
            transcription_id=latest_transcription.id if latest_transcription else None,
            has_text=bool(
                latest_transcription and
                (latest_transcription.processed_text or latest_transcription.raw_text)
            ),
            is_ai_filtered=bool(latest_transcription and latest_transcription.is_ai_filtered),
            audio_expires_at=audio_expires_at,
            notes=[
                LectureNoteOut(id=n.id, mode=n.mode, created_at=n.created_at)
                for n in lec.notes
            ],
        ))
    if has_audio_expiry_backfill:
        await db.commit()
    return out


@router.get("/{lecture_id}", response_model=LectureDetailOut)
async def get_lecture(
    lecture_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Получить лекцию с аудиофайлами и транскрипциями."""

    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)

    # Access check: owner or public
    if not _can_read_lecture(lecture, user):
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

    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)
    _check_owner_or_catalog_moderator(lecture, user)

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

    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)
    _check_owner_or_catalog_moderator(lecture, user)

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
        audio_expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(audio)
    await db.flush()

    # Создать задачу на транскрибацию
    task = TranscriptionTask(audio_file_id=audio.id)
    db.add(task)

    await db.commit()
    await db.refresh(audio)
    return audio


# ---------- Transcription ----------

@router.post("/{lecture_id}/transcribe", response_model=TaskEnqueuedOut, status_code=status.HTTP_202_ACCEPTED)
async def transcribe_lecture_audio(
    lecture_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Поставить аудиофайл лекции в очередь на транскрибацию.
    Возвращает task_id для отслеживания статуса.
    Транскрибация выполняется асинхронно воркером.
    """

    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)
    _check_owner(lecture, user)

    active_audio = [a for a in lecture.audio_files if not a.is_deleted]
    if not active_audio:
        raise HTTPException(status_code=400, detail="Нет аудиофайлов для транскрибации")

    audio = sorted(active_audio, key=lambda a: a.created_at, reverse=True)[0]

    if not os.path.exists(audio.file_path):
        raise HTTPException(status_code=404, detail="Аудиофайл не найден на диске")

    task = TranscriptionTask(audio_file_id=audio.id)
    db.add(task)
    await db.commit()
    await db.refresh(task)

    return TaskEnqueuedOut(
        task_id=task.id,
        status=task.status.value,
        audio_file_id=audio.id,
    )


@router.get("/{lecture_id}/task-status", response_model=TranscriptionTaskOut)
async def get_transcription_task_status(
    lecture_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Получить текущий статус задачи транскрибации для лекции.
    Используется фронтендом для polling (опрос каждые 5 сек).
    """

    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)

    if not _can_read_lecture(lecture, user):
        raise HTTPException(status_code=403, detail="Нет доступа к этой лекции")

    active_audio = [a for a in lecture.audio_files if not a.is_deleted]
    if not active_audio:
        raise HTTPException(status_code=404, detail="Нет аудиофайлов у лекции")

    audio = sorted(active_audio, key=lambda a: a.created_at, reverse=True)[0]

    result = await db.execute(
        select(TranscriptionTask)
        .where(TranscriptionTask.audio_file_id == audio.id)
        .order_by(TranscriptionTask.created_at.desc())
        .limit(1)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Задача транскрибации не найдена")

    return TranscriptionTaskOut.model_validate(task)


@router.put("/{lecture_id}/save-text", status_code=status.HTTP_200_OK)
async def save_transcription_text(
    lecture_id: UUID,
    body: SaveTextIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Сохранить отредактированный/отфильтрованный текст в транскрипцию лекции."""

    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)
    _check_owner(lecture, user)

    active_transcriptions = [t for t in lecture.transcriptions if not t.is_deleted]
    if not active_transcriptions:
        raise HTTPException(status_code=404, detail="Транскрипция не найдена")

    latest = sorted(active_transcriptions, key=lambda t: t.created_at, reverse=True)[0]
    latest.processed_text = body.text
    await db.commit()
    return {"ok": True}


@router.post("/{lecture_id}/re-transcribe", response_model=TaskEnqueuedOut, status_code=status.HTTP_202_ACCEPTED)
async def re_transcribe_lecture(
    lecture_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Удалить старую транскрипцию и поставить задачу заново."""

    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)
    _check_owner(lecture, user)

    # Soft-delete existing transcriptions
    for t in lecture.transcriptions:
        if not t.is_deleted:
            t.is_deleted = True
            t.deleted_at = datetime.utcnow()
            t.deleted_by = user.id

    lecture.status = LectureStatus.processing

    active_audio = [a for a in lecture.audio_files if not a.is_deleted]
    if not active_audio:
        raise HTTPException(status_code=400, detail="Нет аудиофайла для повторной транскрибации")

    audio = sorted(active_audio, key=lambda a: a.created_at, reverse=True)[0]

    task = TranscriptionTask(audio_file_id=audio.id)
    db.add(task)
    await db.commit()
    await db.refresh(task)

    return TaskEnqueuedOut(
        task_id=task.id,
        status=task.status.value,
        audio_file_id=audio.id,
    )


# ---------- AI Filter ----------

@router.post("/{lecture_id}/apply-filter", response_model=ApplyFilterOut)
async def apply_ai_filter(
    lecture_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Применить AI-фильтрацию к транскрипции лекции и сохранить результат."""

    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)
    _check_owner(lecture, user)

    active_transcriptions = [t for t in lecture.transcriptions if not t.is_deleted]
    if not active_transcriptions:
        raise HTTPException(status_code=404, detail="Транскрипция не найдена")

    latest = sorted(active_transcriptions, key=lambda t: t.created_at, reverse=True)[0]
    source_text = latest.raw_text

    try:
        from ml.transcription_filter import TranscriptionFilter
        fltr = TranscriptionFilter()
        filtered = await fltr.filter_text_async(source_text, chunk_size=8000)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка фильтрации: {str(e)}")

    latest.processed_text = filtered
    latest.is_ai_filtered = True
    await db.commit()

    return ApplyFilterOut(success=True, filtered_text=filtered)


# ---------- Lecture Notes ----------

@router.get("/{lecture_id}/notes", response_model=List[LectureNoteOut])
async def get_lecture_notes(
    lecture_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)
    if not _can_read_lecture(lecture, user):
        raise HTTPException(status_code=403, detail="Нет доступа")

    result = await db.execute(
        select(LectureNote)
        .where(LectureNote.lecture_id == lecture_id)
        .order_by(LectureNote.created_at.asc())
    )
    return result.scalars().all()


@router.get("/{lecture_id}/notes/{note_id}", response_model=LectureNoteContentOut)
async def get_lecture_note(
    lecture_id: UUID,
    note_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)
    if not _can_read_lecture(lecture, user):
        raise HTTPException(status_code=403, detail="Нет доступа")

    result = await db.execute(
        select(LectureNote).where(
            LectureNote.id == note_id,
            LectureNote.lecture_id == lecture_id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    return note


@router.post("/{lecture_id}/notes", response_model=LectureNoteContentOut, status_code=201)
async def upsert_lecture_note(
    lecture_id: UUID,
    body: LectureNoteIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Создать или обновить заметку (один режим — одна заметка на лекцию)."""

    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)
    _check_owner_or_catalog_moderator(lecture, user)

    result = await db.execute(
        select(LectureNote).where(
            LectureNote.lecture_id == lecture_id,
            LectureNote.mode == body.mode,
        )
    )
    note = result.scalar_one_or_none()

    if note:
        note.content = body.content
        note.created_at = datetime.utcnow()
    else:
        note = LectureNote(
            lecture_id=lecture_id,
            mode=body.mode,
            content=body.content,
        )
        db.add(note)

    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{lecture_id}/notes/{note_id}", status_code=204)
async def delete_lecture_note(
    lecture_id: UUID,
    note_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lecture = await _get_lecture_or_404(lecture_id, db, load_relations=True)
    _check_owner_or_catalog_moderator(lecture, user)

    result = await db.execute(
        select(LectureNote).where(
            LectureNote.id == note_id,
            LectureNote.lecture_id == lecture_id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")

    await db.delete(note)
    await db.commit()
