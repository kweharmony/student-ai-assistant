"""
Роутер админки: управление пользователями, удаление контента, лог действий,
статистика, очередь аудиофайлов.
Все эндпоинты требуют role=admin.
"""

import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..dependencies import get_db, require_admin
from ..models import (
    AdminAction, AudioFile, Lecture, LectureStatus, Transcription, TranscriptionTask,
    TranscriptionTaskStatus, User, UserRole, StudentProfile, TeacherProfile, Board,
)
from ..schemas import (
    AdminActionOut,
    AdminLectureUpdateRequest,
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

@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    role: Optional[str] = Query(None),
    group_name: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """Список всех пользователей с фильтрацией по роли, группе и поиском."""

    query = (
        select(User)
        .options(selectinload(User.student_profile), selectinload(User.teacher_profile))
        .where(User.is_deleted == False)
    )

    if role:
        try:
            query = query.where(User.role == UserRole(role))
        except ValueError:
            pass

    if group_name:
        query = query.join(User.student_profile).where(
            StudentProfile.group_name.ilike(f"%{group_name}%")
        )

    if search:
        query = query.where(
            or_(
                User.login.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.full_name.ilike(f"%{search}%"),
            )
        )

    query = query.order_by(User.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    # Lecture counts per user
    user_ids = [u.id for u in users]
    counts_result = await db.execute(
        select(Lecture.uploaded_by, func.count(Lecture.id).label("cnt"))
        .where(Lecture.uploaded_by.in_(user_ids), Lecture.is_deleted == False)
        .group_by(Lecture.uploaded_by)
    )
    counts_map = {row[0]: row[1] for row in counts_result.all()}

    from ..schemas import AdminUserOut
    response = []
    for user in users:
        data = AdminUserOut.model_validate(user).model_dump()
        data["lecture_count"] = counts_map.get(user.id, 0)
        response.append(data)
    return response


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def hard_delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Жёсткое удаление пользователя из БД.
    Лекции, аудио, транскрипции и лог действий переназначаются
    на системного администратора с логином 'admin'.
    Профиль (student/teacher) удаляется каскадом.
    """
    from sqlalchemy import update

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")

    # Находим системного admin-пользователя для переназначения контента
    sys_admin_result = await db.execute(
        select(User).where(User.login == "admin", User.role == UserRole.admin)
    )
    sys_admin = sys_admin_result.scalar_one_or_none()
    if sys_admin is None:
        # Fallback: любой другой администратор
        sys_admin_result = await db.execute(
            select(User).where(User.role == UserRole.admin, User.id != user_id).limit(1)
        )
        sys_admin = sys_admin_result.scalar_one_or_none()
    if sys_admin is None:
        raise HTTPException(
            status_code=400,
            detail="Не найден администратор для переназначения лекций. Создайте пользователя с логином 'admin'.",
        )

    # Переназначаем лекции на системного админа
    await db.execute(
        update(Lecture)
        .where(Lecture.uploaded_by == user_id)
        .values(uploaded_by=sys_admin.id)
    )
    # Обнуляем nullable FK на удаляемого пользователя
    await db.execute(
        update(Lecture)
        .where(Lecture.deleted_by == user_id)
        .values(deleted_by=None)
    )
    await db.execute(
        update(AudioFile)
        .where(AudioFile.deleted_by == user_id)
        .values(deleted_by=None)
    )
    await db.execute(
        update(Transcription)
        .where(Transcription.deleted_by == user_id)
        .values(deleted_by=None)
    )
    await db.execute(
        update(User)
        .where(User.blocked_by == user_id)
        .values(blocked_by=None)
    )
    # Переназначаем лог действий администратора
    await db.execute(
        update(AdminAction)
        .where(AdminAction.admin_id == user_id)
        .values(admin_id=sys_admin.id)
    )

    from sqlalchemy import text
    await db.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": target.id})
    await db.commit()

    return {"detail": f"Пользователь удалён. Лекции переназначены на '{sys_admin.login}'."}


@router.post("/users/{user_id}/block", status_code=status.HTTP_200_OK)
async def block_user(
    user_id: UUID,
    body: BlockUserRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Заблокировать пользователя на срок или бессрочно."""

    result = await db.execute(select(User).where(User.id == user_id, User.is_deleted == False))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать самого себя")

    now = datetime.utcnow()
    blocked_until = (
        now + timedelta(minutes=body.duration_minutes)
        if body.duration_minutes is not None
        else None
    )

    target.is_active = False
    target.blocked_reason = body.reason
    target.blocked_by = admin.id
    target.blocked_at = now
    target.blocked_until = blocked_until

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
    target.blocked_until = None

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


@router.put("/lectures/{lecture_id}", status_code=status.HTTP_200_OK)
async def admin_update_lecture(
    lecture_id: UUID,
    body: AdminLectureUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Редактировать лекцию (админ, без проверки владельца)."""

    result = await db.execute(select(Lecture).where(Lecture.id == lecture_id, Lecture.is_deleted == False))
    lecture = result.scalar_one_or_none()
    if lecture is None:
        raise HTTPException(status_code=404, detail="Лекция не найдена")

    if body.title is not None:
        lecture.title = body.title
    if body.description is not None:
        lecture.description = body.description
    if body.subject is not None:
        lecture.subject = body.subject
    if body.is_public is not None:
        lecture.is_public = body.is_public

    await _log_action(db, admin, "edit_lecture", "lecture", lecture.id)
    await db.commit()
    await db.refresh(lecture)

    return {
        "id": str(lecture.id),
        "title": lecture.title,
        "description": lecture.description,
        "subject": lecture.subject,
        "is_public": lecture.is_public,
        "status": lecture.status.value if lecture.status else None,
    }


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

    # Полотна
    total_boards = (await db.execute(select(func.count(Board.id)))).scalar() or 0

    # Очередь транскрибации (задачи в БД)
    queue_pending = (
        await db.execute(
            select(func.count(TranscriptionTask.id)).where(
                TranscriptionTask.status == TranscriptionTaskStatus.pending
            )
        )
    ).scalar() or 0
    queue_processing = (
        await db.execute(
            select(func.count(TranscriptionTask.id)).where(
                TranscriptionTask.status == TranscriptionTaskStatus.processing
            )
        )
    ).scalar() or 0

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
        "boards": {"total": total_boards},
        "audio": {"total": total_audio},
        "transcriptions": {"total": total_transcriptions},
        "queue": {
            "files": queue_pending + queue_processing,
            "size_mb": 0.0,
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
    search: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    uploader_search: Optional[str] = Query(None),
):
    """Список всех лекций (для админа) с фильтрацией."""
    from datetime import date as date_type

    query = select(Lecture).options(
        selectinload(Lecture.uploader),
        selectinload(Lecture.audio_files),
        selectinload(Lecture.transcriptions),
    )

    if not include_deleted:
        query = query.where(Lecture.is_deleted == False)

    if search:
        query = query.where(
            or_(
                Lecture.title.ilike(f"%{search}%"),
                Lecture.subject.ilike(f"%{search}%"),
            )
        )

    if subject:
        query = query.where(Lecture.subject.ilike(f"%{subject}%"))

    if status:
        try:
            query = query.where(Lecture.status == LectureStatus(status))
        except ValueError:
            pass

    if date_from:
        try:
            query = query.where(Lecture.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass

    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59)
            query = query.where(Lecture.created_at <= dt_to)
        except ValueError:
            pass

    if uploader_search:
        query = query.join(Lecture.uploader).where(
            or_(
                User.login.ilike(f"%{uploader_search}%"),
                User.full_name.ilike(f"%{uploader_search}%"),
            )
        )

    query = query.order_by(Lecture.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    lectures = result.scalars().unique().all()

    return [
        {
            "id": str(l.id),
            "title": l.title,
            "description": l.description,
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


# ---------- All boards (admin view) ----------

@router.get("/boards")
async def list_all_boards(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None),
    owner_search: Optional[str] = Query(None),
):
    """Список всех полотен (для админа) с фильтрацией."""

    query = select(Board).options(selectinload(Board.owner))

    if search:
        query = query.where(Board.title.ilike(f"%{search}%"))

    if owner_search:
        query = query.join(Board.owner).where(
            or_(
                User.login.ilike(f"%{owner_search}%"),
                User.full_name.ilike(f"%{owner_search}%"),
                User.email.ilike(f"%{owner_search}%"),
            )
        )

    query = query.order_by(Board.updated_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    boards = result.scalars().unique().all()

    return [
        {
            "id": str(b.id),
            "title": b.title,
            "is_public": b.is_public,
            "share_token": b.share_token,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "updated_at": b.updated_at.isoformat() if b.updated_at else None,
            "owner": {
                "id": str(b.owner.id),
                "login": b.owner.login,
                "email": b.owner.email,
                "full_name": b.owner.full_name,
                "role": b.owner.role.value,
            } if b.owner else None,
        }
        for b in boards
    ]
