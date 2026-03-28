"""
Роутер админки: управление пользователями, удаление контента, лог действий,
статистика, очередь аудиофайлов.
Все эндпоинты требуют role=admin.
"""

import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..dependencies import get_db, require_admin
from ..models import (
    AdminAction, AudioFile, Lecture, Transcription, TranscriptionTask,
    TranscriptionTaskStatus, User, UserRole,
)
from ..schemas import (
    AdminActionOut,
    AdminUserOut,
    BlockUserRequest,
    DeleteContentRequest,
    WorkerStatusOut,
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ---------- helpers ----------

async def _log_action(
    db: AsyncSession,
    admin: User,
    action: str,
    target_type: str,
    target_id: UUID,
    reason: Optional[str] = None,
    details: Optional[dict] = None,
):
    db.add(AdminAction(
        admin_id=admin.id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        details=details,
    ))


# ---------- Users ----------

@router.get("/users", response_model=List[AdminUserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Список всех пользователей (включая заблокированных)."""

    result = await db.execute(
        select(User)
        .options(selectinload(User.student_profile), selectinload(User.teacher_profile))
        .where(User.is_deleted == False)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/users/{user_id}/block", status_code=status.HTTP_200_OK)
async def block_user(
    user_id: UUID,
    body: BlockUserRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Заблокировать пользователя."""

    result = await db.execute(select(User).where(User.id == user_id, User.is_deleted == False))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать самого себя")

    target.is_active = False
    target.blocked_reason = body.reason
    target.blocked_by = admin.id
    target.blocked_at = datetime.utcnow()

    await _log_action(db, admin, "block_user", "user", target.id, reason=body.reason)
    await db.commit()

    return {"detail": "Пользователь заблокирован"}


@router.post("/users/{user_id}/unblock", status_code=status.HTTP_200_OK)
async def unblock_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Разблокировать пользователя."""

    result = await db.execute(select(User).where(User.id == user_id, User.is_deleted == False))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    target.is_active = True
    target.blocked_reason = None
    target.blocked_by = None
    target.blocked_at = None

    await _log_action(db, admin, "unblock_user", "user", target.id)
    await db.commit()

    return {"detail": "Пользователь разблокирован"}


@router.delete("/users/{user_id}/avatar", status_code=status.HTTP_200_OK)
async def delete_user_avatar(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Удалить аватарку пользователя (админ)."""
    import os
    from pathlib import Path

    result = await db.execute(select(User).where(User.id == user_id, User.is_deleted == False))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if target.avatar_url:
        data_dir = Path(os.getenv("DATA_DIR", "/data"))
        full_path = data_dir.parent / Path(target.avatar_url).relative_to("/")
        if full_path.exists():
            full_path.unlink()

    target.avatar_url = None
    await _log_action(db, admin, "delete_avatar", "user", target.id)
    await db.commit()

    return {"detail": "Аватарка удалена"}


# ---------- Content deletion ----------

@router.delete("/lectures/{lecture_id}", status_code=status.HTTP_200_OK)
async def admin_delete_lecture(
    lecture_id: UUID,
    body: DeleteContentRequest = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Мягкое удаление лекции (админ)."""

    result = await db.execute(select(Lecture).where(Lecture.id == lecture_id, Lecture.is_deleted == False))
    lecture = result.scalar_one_or_none()
    if lecture is None:
        raise HTTPException(status_code=404, detail="Лекция не найдена")

    lecture.is_deleted = True
    lecture.deleted_by = admin.id
    lecture.deleted_at = datetime.utcnow()
    lecture.delete_reason = body.reason if body else None

    await _log_action(db, admin, "delete_lecture", "lecture", lecture.id, reason=body.reason if body else None)
    await db.commit()

    return {"detail": "Лекция удалена"}


@router.delete("/audio/{audio_id}", status_code=status.HTTP_200_OK)
async def admin_delete_audio(
    audio_id: UUID,
    body: DeleteContentRequest = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Мягкое удаление аудиофайла (админ)."""

    result = await db.execute(select(AudioFile).where(AudioFile.id == audio_id, AudioFile.is_deleted == False))
    audio = result.scalar_one_or_none()
    if audio is None:
        raise HTTPException(status_code=404, detail="Аудиофайл не найден")

    audio.is_deleted = True
    audio.deleted_by = admin.id
    audio.deleted_at = datetime.utcnow()

    await _log_action(db, admin, "delete_audio", "audio", audio.id, reason=body.reason if body else None)
    await db.commit()

    return {"detail": "Аудиофайл удалён"}


@router.delete("/transcriptions/{transcription_id}", status_code=status.HTTP_200_OK)
async def admin_delete_transcription(
    transcription_id: UUID,
    body: DeleteContentRequest = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Мягкое удаление транскрипции (админ)."""

    result = await db.execute(
        select(Transcription).where(Transcription.id == transcription_id, Transcription.is_deleted == False)
    )
    transcription = result.scalar_one_or_none()
    if transcription is None:
        raise HTTPException(status_code=404, detail="Транскрипция не найдена")

    transcription.is_deleted = True
    transcription.deleted_by = admin.id
    transcription.deleted_at = datetime.utcnow()

    await _log_action(
        db, admin, "delete_transcription", "transcription", transcription.id,
        reason=body.reason if body else None,
    )
    await db.commit()

    return {"detail": "Транскрипция удалена"}


# ---------- Action log ----------

@router.get("/actions", response_model=List[AdminActionOut])
async def list_admin_actions(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Лог действий админов."""

    result = await db.execute(
        select(AdminAction)
        .order_by(AdminAction.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


# ---------- Dashboard stats ----------

@router.get("/stats")
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Статистика для админ-дашборда."""

    # Пользователи
    total_users = (await db.execute(select(func.count(User.id)).where(User.is_deleted == False))).scalar() or 0
    active_users = (await db.execute(select(func.count(User.id)).where(User.is_deleted == False, User.is_active == True))).scalar() or 0
    blocked_users = (await db.execute(select(func.count(User.id)).where(User.is_deleted == False, User.is_active == False))).scalar() or 0
    students = (await db.execute(select(func.count(User.id)).where(User.is_deleted == False, User.role == UserRole.student))).scalar() or 0
    teachers = (await db.execute(select(func.count(User.id)).where(User.is_deleted == False, User.role == UserRole.teacher))).scalar() or 0
    admins = (await db.execute(select(func.count(User.id)).where(User.is_deleted == False, User.role == UserRole.admin))).scalar() or 0

    # Лекции
    total_lectures = (await db.execute(select(func.count(Lecture.id)).where(Lecture.is_deleted == False))).scalar() or 0

    # Аудиофайлы
    total_audio = (await db.execute(select(func.count(AudioFile.id)).where(AudioFile.is_deleted == False))).scalar() or 0

    # Транскрипции
    total_transcriptions = (await db.execute(select(func.count(Transcription.id)).where(Transcription.is_deleted == False))).scalar() or 0

    # Очередь аудио (файлы на диске)
    queue_dir = Path(os.getenv("DATA_DIR", "/data")) / "audio_queue"
    queue_files = 0
    queue_size_mb = 0.0
    if queue_dir.exists():
        for f in queue_dir.rglob("*"):
            if f.is_file():
                queue_files += 1
                queue_size_mb += f.stat().st_size / (1024 * 1024)

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "blocked": blocked_users,
            "students": students,
            "teachers": teachers,
            "admins": admins,
        },
        "lectures": {"total": total_lectures},
        "audio": {"total": total_audio},
        "transcriptions": {"total": total_transcriptions},
        "queue": {
            "files": queue_files,
            "size_mb": round(queue_size_mb, 1),
        },
    }


# ---------- Audio queue ----------

@router.get("/queue")
async def list_audio_queue(
    admin: User = Depends(require_admin),
):
    """Список аудиофайлов в очереди на транскрибацию."""

    queue_dir = Path(os.getenv("DATA_DIR", "/data")) / "audio_queue"
    files = []

    if queue_dir.exists():
        for f in sorted(queue_dir.rglob("*"), key=lambda p: p.stat().st_mtime, reverse=True):
            if f.is_file():
                stat = f.stat()
                files.append({
                    "filename": f.name,
                    "path": str(f.relative_to(queue_dir)),
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "uploaded_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })

    return {"files": files, "total": len(files)}


# ---------- Worker stats (admin view) ----------

@router.get("/worker-stats", response_model=WorkerStatusOut)
async def get_worker_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Статистика воркеров и очереди транскрибации для админ-панели."""
    from ..routers.worker import _get_worker_stats
    return await _get_worker_stats(db)


# ---------- All lectures (admin view) ----------

@router.get("/lectures")
async def list_all_lectures(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    include_deleted: bool = Query(False),
):
    """Список всех лекций (для админа)."""

    query = select(Lecture).options(
        selectinload(Lecture.uploader),
        selectinload(Lecture.audio_files),
        selectinload(Lecture.transcriptions),
    )

    if not include_deleted:
        query = query.where(Lecture.is_deleted == False)

    query = query.order_by(Lecture.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    lectures = result.scalars().unique().all()

    return [
        {
            "id": str(l.id),
            "title": l.title,
            "subject": l.subject,
            "status": l.status.value if l.status else None,
            "is_public": l.is_public,
            "is_deleted": l.is_deleted,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "uploader": {
                "id": str(l.uploader.id),
                "login": l.uploader.login,
                "role": l.uploader.role.value,
            } if l.uploader else None,
            "audio_count": len([a for a in l.audio_files if not a.is_deleted]),
            "transcription_count": len([t for t in l.transcriptions if not t.is_deleted]),
        }
        for l in lectures
    ]
