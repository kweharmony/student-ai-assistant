from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..dependencies import (
    can_moderate_stream,
    get_current_user,
    get_db,
    require_admin,
    require_catalog_moderator,
)
from ..models import (
    CatalogDisciplineTemplate,
    CatalogLecturerTemplate,
    Direction,
    Faculty,
    Lecture,
    LectureCatalogItem,
    LectureMaterialGenerationRequest,
    LectureNote,
    LecturePublicationRequest,
    MaterialGenerationRequestStatus,
    PublicationRequestStatus,
    Stream,
    User,
)
from ..schemas import (
    AdminSetGroupHeadIn,
    CatalogDisciplineTemplateCreateIn,
    CatalogDisciplineTemplateOut,
    CatalogItemOut,
    CatalogLectureOptionOut,
    CatalogLecturerTemplateCreateIn,
    CatalogLecturerTemplateOut,
    DirectionCreateIn,
    DirectionOut,
    FacultyCreateIn,
    FacultyOut,
    ManualCatalogPublishIn,
    MaterialGenerationRequestCreateIn,
    MaterialGenerationRequestModerateIn,
    MaterialGenerationRequestOut,
    MyLecturePublicationStatusOut,
    PublicationRequestCreateIn,
    PublicationRequestModerateIn,
    PublicationRequestOut,
    StreamCreateIn,
    StreamOut,
)

router = APIRouter(prefix="/api/catalog", tags=["Catalog"])

MATERIAL_MODE_TO_ML_MODE: dict[str, str] = {
    "summary": "summarize",
    "detailed_notes": "detailed_notes",
    "qa": "generate_questions",
    "flashcards": "cheat_sheet",
    "mindmap": "extract_terms",
}


def _is_catalog_editor(user: User, stream_id: Optional[UUID]) -> bool:
    return can_moderate_stream(user, stream_id)


def _has_catalog_node_content(counts: dict[str, int]) -> bool:
    return any(value > 0 for value in counts.values())


def _raise_not_empty_error(node_label: str, counts: dict[str, int]) -> None:
    raise HTTPException(
        status_code=409,
        detail={
            "code": "catalog_node_not_empty",
            "message": f"В разделе «{node_label}» есть подразделы или файлы. Удалить вместе со всем содержимым?",
            "counts": counts,
        },
    )


async def _delete_stream_related_data(db: AsyncSession, stream_ids: list[UUID]) -> None:
    if not stream_ids:
        return
    await db.execute(
        update(User)
        .where(User.stream_id.in_(stream_ids))
        .values(stream_id=None, is_group_head=False)
    )
    await db.execute(delete(LectureCatalogItem).where(LectureCatalogItem.stream_id.in_(stream_ids)))
    await db.execute(delete(LecturePublicationRequest).where(LecturePublicationRequest.stream_id.in_(stream_ids)))
    await db.execute(delete(LectureMaterialGenerationRequest).where(LectureMaterialGenerationRequest.stream_id.in_(stream_ids)))
    await db.execute(delete(CatalogLecturerTemplate).where(CatalogLecturerTemplate.stream_id.in_(stream_ids)))


async def _stream_usage_counts(db: AsyncSession, stream_ids: list[UUID]) -> dict[str, int]:
    if not stream_ids:
        return {
            "catalog_items": 0,
            "publication_requests": 0,
            "material_generation_requests": 0,
            "users": 0,
        }
    catalog_items_count = await db.scalar(
        select(func.count(LectureCatalogItem.id)).where(LectureCatalogItem.stream_id.in_(stream_ids))
    )
    publication_requests_count = await db.scalar(
        select(func.count(LecturePublicationRequest.id)).where(LecturePublicationRequest.stream_id.in_(stream_ids))
    )
    material_generation_requests_count = await db.scalar(
        select(func.count(LectureMaterialGenerationRequest.id)).where(LectureMaterialGenerationRequest.stream_id.in_(stream_ids))
    )
    users_count = await db.scalar(
        select(func.count(User.id)).where(User.stream_id.in_(stream_ids))
    )
    return {
        "catalog_items": int(catalog_items_count or 0),
        "publication_requests": int(publication_requests_count or 0),
        "material_generation_requests": int(material_generation_requests_count or 0),
        "users": int(users_count or 0),
    }


@router.get("/disciplines")
async def list_disciplines(
    direction_id: Optional[UUID] = Query(None),
    stream_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    del user
    collected: set[str] = set()
    stmt_templates = select(CatalogDisciplineTemplate.name)
    if direction_id is not None:
        stmt_templates = stmt_templates.where(CatalogDisciplineTemplate.direction_id == direction_id)
    elif stream_id is not None:
        stream_result = await db.execute(select(Stream).where(Stream.id == stream_id))
        stream_obj = stream_result.scalar_one_or_none()
        if stream_obj is not None:
            stmt_templates = stmt_templates.where(CatalogDisciplineTemplate.direction_id == stream_obj.direction_id)
        else:
            stmt_templates = stmt_templates.where(CatalogDisciplineTemplate.direction_id.is_(None))  # no rows
    templates_result = await db.execute(stmt_templates)
    for row in templates_result.all():
        if row[0]:
            collected.add(row[0])

    stmt = (
        select(LectureCatalogItem.discipline)
        .join(Stream, Stream.id == LectureCatalogItem.stream_id)
        .where(LectureCatalogItem.discipline.isnot(None), LectureCatalogItem.discipline != "")
    )
    if stream_id is not None:
        stmt = stmt.where(Stream.id == stream_id)
    elif direction_id is not None:
        stmt = stmt.where(Stream.direction_id == direction_id)
    stmt = stmt.distinct().order_by(LectureCatalogItem.discipline.asc())
    result = await db.execute(stmt)
    for row in result.all():
        if row[0]:
            collected.add(row[0])
    return sorted(collected)


@router.get("/lecturers")
async def list_lecturers(
    stream_id: Optional[UUID] = Query(None),
    direction_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    del user
    collected: set[str] = set()

    tmpl_stmt = select(CatalogLecturerTemplate.name)
    if stream_id is not None:
        tmpl_stmt = tmpl_stmt.where(CatalogLecturerTemplate.stream_id == stream_id)
    elif direction_id is not None:
        stream_ids_result = await db.execute(select(Stream.id).where(Stream.direction_id == direction_id))
        stream_ids = [r[0] for r in stream_ids_result.all()]
        if stream_ids:
            tmpl_stmt = tmpl_stmt.where(CatalogLecturerTemplate.stream_id.in_(stream_ids))
        else:
            tmpl_stmt = tmpl_stmt.where(CatalogLecturerTemplate.stream_id.is_(None))  # no rows
    tmpl_res = await db.execute(tmpl_stmt)
    for row in tmpl_res.all():
        if row[0]:
            collected.add(row[0])

    stmt = (
        select(LectureCatalogItem.lecturer_name)
        .join(Stream, Stream.id == LectureCatalogItem.stream_id)
        .where(LectureCatalogItem.lecturer_name.isnot(None), LectureCatalogItem.lecturer_name != "")
    )
    if stream_id is not None:
        stmt = stmt.where(Stream.id == stream_id)
    elif direction_id is not None:
        stmt = stmt.where(Stream.direction_id == direction_id)
    stmt = stmt.distinct()
    result = await db.execute(stmt)
    for row in result.all():
        if row[0]:
            collected.add(row[0])
    return sorted(collected)


@router.post("/discipline-templates", response_model=CatalogDisciplineTemplateOut, status_code=status.HTTP_201_CREATED)
async def create_discipline_template(
    body: CatalogDisciplineTemplateCreateIn,
    db: AsyncSession = Depends(get_db),
    moderator: User = Depends(require_catalog_moderator),
):
    direction_result = await db.execute(select(Direction).where(Direction.id == body.direction_id))
    direction = direction_result.scalar_one_or_none()
    if direction is None:
        raise HTTPException(status_code=404, detail="Направление не найдено")

    if moderator.role != "admin":
        stream_result = await db.execute(select(Stream).where(Stream.id == moderator.stream_id))
        own_stream = stream_result.scalar_one_or_none()
        if own_stream is None or own_stream.direction_id != body.direction_id:
            raise HTTPException(status_code=403, detail="Нет прав для этого направления")

    name = body.name.strip()
    exists = await db.execute(
        select(CatalogDisciplineTemplate).where(
            CatalogDisciplineTemplate.direction_id == body.direction_id,
            CatalogDisciplineTemplate.name == name,
        )
    )
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Дисциплина уже существует для этого направления")

    obj = CatalogDisciplineTemplate(direction_id=body.direction_id, name=name, created_by=moderator.id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.post("/lecturer-templates", response_model=CatalogLecturerTemplateOut, status_code=status.HTTP_201_CREATED)
async def create_lecturer_template(
    body: CatalogLecturerTemplateCreateIn,
    db: AsyncSession = Depends(get_db),
    moderator: User = Depends(require_catalog_moderator),
):
    stream_result = await db.execute(select(Stream).where(Stream.id == body.stream_id))
    stream = stream_result.scalar_one_or_none()
    if stream is None:
        raise HTTPException(status_code=404, detail="Поток не найден")
    if not _is_catalog_editor(moderator, stream.id):
        raise HTTPException(status_code=403, detail="Нет прав для этого потока")

    name = body.name.strip()
    exists = await db.execute(
        select(CatalogLecturerTemplate).where(
            CatalogLecturerTemplate.stream_id == body.stream_id,
            CatalogLecturerTemplate.name == name,
        )
    )
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Лектор уже существует для этого потока")

    obj = CatalogLecturerTemplate(stream_id=body.stream_id, name=name, created_by=moderator.id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.get("/faculties", response_model=List[FacultyOut])
async def list_faculties(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    del user
    result = await db.execute(select(Faculty).order_by(Faculty.name.asc()))
    return result.scalars().all()


@router.post("/faculties", response_model=FacultyOut, status_code=status.HTTP_201_CREATED)
async def create_faculty(
    body: FacultyCreateIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    del admin
    name = body.name.strip()
    exists = await db.execute(select(Faculty).where(Faculty.name == name))
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Факультет уже существует")
    obj = Faculty(name=name)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/faculties/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faculty(
    faculty_id: UUID,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    del admin
    faculty_result = await db.execute(select(Faculty).where(Faculty.id == faculty_id))
    faculty = faculty_result.scalar_one_or_none()
    if faculty is None:
        raise HTTPException(status_code=404, detail="Факультет не найден")

    direction_rows = await db.execute(select(Direction.id).where(Direction.faculty_id == faculty_id))
    direction_ids = [row[0] for row in direction_rows.all()]

    stream_ids: list[UUID] = []
    if direction_ids:
        stream_rows = await db.execute(select(Stream.id).where(Stream.direction_id.in_(direction_ids)))
        stream_ids = [row[0] for row in stream_rows.all()]

    stream_counts = await _stream_usage_counts(db, stream_ids)
    counts = {
        "directions": len(direction_ids),
        "streams": len(stream_ids),
        **stream_counts,
    }

    if not force and _has_catalog_node_content(counts):
        _raise_not_empty_error(faculty.name, counts)

    await _delete_stream_related_data(db, stream_ids)
    if direction_ids:
        await db.execute(delete(CatalogDisciplineTemplate).where(CatalogDisciplineTemplate.direction_id.in_(direction_ids)))
        await db.execute(delete(Stream).where(Stream.direction_id.in_(direction_ids)))
        await db.execute(delete(Direction).where(Direction.id.in_(direction_ids)))
    await db.execute(delete(Faculty).where(Faculty.id == faculty_id))
    await db.commit()


@router.get("/directions", response_model=List[DirectionOut])
async def list_directions(
    faculty_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    del user
    stmt = select(Direction).order_by(Direction.name.asc())
    if faculty_id is not None:
        stmt = stmt.where(Direction.faculty_id == faculty_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/directions", response_model=DirectionOut, status_code=status.HTTP_201_CREATED)
async def create_direction(
    body: DirectionCreateIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    del admin
    faculty_result = await db.execute(select(Faculty).where(Faculty.id == body.faculty_id))
    if faculty_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Факультет не найден")
    name = body.name.strip()
    exists = await db.execute(select(Direction).where(Direction.faculty_id == body.faculty_id, Direction.name == name))
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Направление уже существует на этом факультете")
    obj = Direction(faculty_id=body.faculty_id, name=name)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/directions/{direction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_direction(
    direction_id: UUID,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    del admin
    direction_result = await db.execute(select(Direction).where(Direction.id == direction_id))
    direction = direction_result.scalar_one_or_none()
    if direction is None:
        raise HTTPException(status_code=404, detail="Направление не найдено")

    stream_rows = await db.execute(select(Stream.id).where(Stream.direction_id == direction_id))
    stream_ids = [row[0] for row in stream_rows.all()]

    stream_counts = await _stream_usage_counts(db, stream_ids)
    counts = {
        "streams": len(stream_ids),
        **stream_counts,
    }

    if not force and _has_catalog_node_content(counts):
        _raise_not_empty_error(direction.name, counts)

    await _delete_stream_related_data(db, stream_ids)
    await db.execute(delete(CatalogDisciplineTemplate).where(CatalogDisciplineTemplate.direction_id == direction_id))
    if stream_ids:
        await db.execute(delete(Stream).where(Stream.id.in_(stream_ids)))
    await db.execute(delete(Direction).where(Direction.id == direction_id))
    await db.commit()


@router.get("/streams", response_model=List[StreamOut])
async def list_streams(
    direction_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    del user
    stmt = select(Stream).order_by(Stream.name.asc())
    if direction_id is not None:
        stmt = stmt.where(Stream.direction_id == direction_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/streams", response_model=StreamOut, status_code=status.HTTP_201_CREATED)
async def create_stream(
    body: StreamCreateIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    del admin
    direction_result = await db.execute(select(Direction).where(Direction.id == body.direction_id))
    if direction_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Направление не найдено")
    obj = Stream(
        direction_id=body.direction_id,
        name=body.name.strip(),
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/streams/{stream_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stream(
    stream_id: UUID,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    del admin
    stream_result = await db.execute(select(Stream).where(Stream.id == stream_id))
    stream = stream_result.scalar_one_or_none()
    if stream is None:
        raise HTTPException(status_code=404, detail="Поток не найден")

    stream_counts = await _stream_usage_counts(db, [stream_id])
    if not force and _has_catalog_node_content(stream_counts):
        _raise_not_empty_error(stream.name, stream_counts)

    await _delete_stream_related_data(db, [stream_id])
    await db.execute(delete(Stream).where(Stream.id == stream_id))
    await db.commit()


@router.get("/lecture-options", response_model=List[CatalogLectureOptionOut])
async def lecture_options(
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    moderator: User = Depends(require_catalog_moderator),
):
    del moderator
    stmt = (
        select(Lecture, User)
        .join(User, User.id == Lecture.uploaded_by)
        .where(Lecture.is_deleted == False)
        .order_by(Lecture.created_at.desc())
        .limit(limit)
    )
    if search:
        stmt = stmt.where(or_(Lecture.title.ilike(f"%{search}%"), User.login.ilike(f"%{search}%")))
    result = await db.execute(stmt)
    rows = result.all()
    return [
        CatalogLectureOptionOut(
            lecture_id=lecture.id,
            lecture_title=lecture.title,
            uploader_login=uploader.login,
        )
        for lecture, uploader in rows
    ]


@router.get("/items", response_model=List[CatalogItemOut])
async def list_catalog_items(
    faculty_id: Optional[UUID] = Query(None),
    direction_id: Optional[UUID] = Query(None),
    stream_id: Optional[UUID] = Query(None),
    discipline: Optional[str] = Query(None),
    lecturer_name: Optional[str] = Query(None),
    course_text: Optional[str] = Query(None),
    semester_text: Optional[str] = Query(None),
    study_year_text: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=300),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    del user
    stmt = (
        select(
            LectureCatalogItem,
            Lecture,
            Stream,
            Direction,
            Faculty,
            User,
        )
        .join(Lecture, Lecture.id == LectureCatalogItem.lecture_id)
        .join(Stream, Stream.id == LectureCatalogItem.stream_id)
        .join(Direction, Direction.id == Stream.direction_id)
        .join(Faculty, Faculty.id == Direction.faculty_id)
        .join(User, User.id == LectureCatalogItem.published_by)
        .where(Lecture.is_deleted == False)
        .order_by(LectureCatalogItem.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    conditions = []
    if faculty_id:
        conditions.append(Faculty.id == faculty_id)
    if direction_id:
        conditions.append(Direction.id == direction_id)
    if stream_id:
        conditions.append(Stream.id == stream_id)
    if discipline:
        conditions.append(LectureCatalogItem.discipline.ilike(f"%{discipline}%"))
    if lecturer_name:
        conditions.append(LectureCatalogItem.lecturer_name.ilike(f"%{lecturer_name}%"))
    if course_text:
        conditions.append(LectureCatalogItem.course_text.ilike(f"%{course_text}%"))
    if semester_text:
        conditions.append(LectureCatalogItem.semester_text.ilike(f"%{semester_text}%"))
    if study_year_text:
        conditions.append(LectureCatalogItem.study_year_text.ilike(f"%{study_year_text}%"))
    if search:
        conditions.append(
            or_(
                Lecture.title.ilike(f"%{search}%"),
                LectureCatalogItem.discipline.ilike(f"%{search}%"),
                LectureCatalogItem.lecturer_name.ilike(f"%{search}%"),
            )
        )
    if conditions:
        stmt = stmt.where(and_(*conditions))

    result = await db.execute(stmt)
    rows = result.all()
    return [
        CatalogItemOut(
            id=item.id,
            lecture_id=lecture.id,
            lecture_title=lecture.title,
            lecture_subject=lecture.subject,
            discipline=item.discipline,
            lecturer_name=item.lecturer_name,
            course_text=item.course_text,
            semester_text=item.semester_text,
            lecture_number_text=item.lecture_number_text,
            study_year_text=item.study_year_text,
            stream_id=stream.id,
            stream_name=stream.name,
            direction_id=direction.id,
            direction_name=direction.name,
            faculty_id=faculty.id,
            faculty_name=faculty.name,
            published_by_login=publisher.login,
            created_at=item.created_at,
        )
        for item, lecture, stream, direction, faculty, publisher in rows
    ]


@router.get("/my-lecture-statuses", response_model=List[MyLecturePublicationStatusOut])
async def my_lecture_publication_statuses(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LecturePublicationRequest)
        .join(Lecture, Lecture.id == LecturePublicationRequest.lecture_id)
        .where(Lecture.uploaded_by == user.id, Lecture.is_deleted == False)
        .order_by(LecturePublicationRequest.created_at.desc())
    )
    requests = result.scalars().all()
    latest_by_lecture: dict[UUID, LecturePublicationRequest] = {}
    for req in requests:
        if req.lecture_id not in latest_by_lecture:
            latest_by_lecture[req.lecture_id] = req

    return [
        MyLecturePublicationStatusOut(
            lecture_id=lecture_id,
            latest_request_status=req.status.value,
            latest_request_review_comment=req.review_comment,
        )
        for lecture_id, req in latest_by_lecture.items()
    ]


@router.post("/requests", response_model=PublicationRequestOut, status_code=status.HTTP_201_CREATED)
async def create_publication_request(
    body: PublicationRequestCreateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lecture_result = await db.execute(
        select(Lecture).where(Lecture.id == body.lecture_id, Lecture.is_deleted == False)
    )
    lecture = lecture_result.scalar_one_or_none()
    if lecture is None:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    if lecture.uploaded_by != user.id:
        raise HTTPException(status_code=403, detail="Можно отправлять только свои лекции")

    stream_result = await db.execute(
        select(Stream)
        .options(selectinload(Stream.direction).selectinload(Direction.faculty))
        .where(Stream.id == body.stream_id)
    )
    stream = stream_result.scalar_one_or_none()
    if stream is None:
        raise HTTPException(status_code=400, detail="Поток не найден")

    req = LecturePublicationRequest(
        lecture_id=body.lecture_id,
        requested_by=user.id,
        stream_id=body.stream_id,
        discipline=lecture.subject or lecture.title,
        lecturer_name=None,
        course_text=None,
        semester_text=None,
        lecture_number_text=(body.lecture_number_text or "").strip() or None,
        study_year_text=(body.study_year_text or "").strip() or None,
        comment=(body.comment or "").strip() or None,
        status=PublicationRequestStatus.pending,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    return PublicationRequestOut(
        id=req.id,
        lecture_id=lecture.id,
        lecture_title=lecture.title,
        requested_by=user.id,
        requested_by_login=user.login,
        stream_id=stream.id,
        stream_name=stream.name,
        direction_id=stream.direction.id,
        direction_name=stream.direction.name,
        faculty_id=stream.direction.faculty.id,
        faculty_name=stream.direction.faculty.name,
        discipline=req.discipline,
        lecturer_name=req.lecturer_name,
        course_text=req.course_text,
        semester_text=req.semester_text,
        lecture_number_text=req.lecture_number_text,
        study_year_text=req.study_year_text,
        comment=req.comment,
        status=req.status.value,
        review_comment=req.review_comment,
        reviewed_by=req.reviewed_by,
        reviewed_by_login=None,
        reviewed_at=req.reviewed_at,
        created_at=req.created_at,
    )


@router.get("/requests", response_model=List[PublicationRequestOut])
async def list_publication_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    stream_id: Optional[UUID] = Query(None),
    limit: int = Query(100, ge=1, le=300),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    moderator: User = Depends(require_catalog_moderator),
):
    stmt = select(LecturePublicationRequest).order_by(LecturePublicationRequest.created_at.desc()).offset(offset).limit(limit)

    if status_filter:
        try:
            stmt = stmt.where(LecturePublicationRequest.status == PublicationRequestStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail="Невалидный статус")

    if stream_id:
        stmt = stmt.where(LecturePublicationRequest.stream_id == stream_id)

    if moderator.role != "admin":
        stmt = stmt.where(LecturePublicationRequest.stream_id == moderator.stream_id)

    result = await db.execute(stmt)
    requests = result.scalars().all()
    out: list[PublicationRequestOut] = []
    for req in requests:
        out.append(await _request_out(db, req))
    return out


def _lecture_latest_text(lecture: Lecture) -> str:
    active_transcriptions = [t for t in lecture.transcriptions if not t.is_deleted]
    if not active_transcriptions:
        return ""
    latest = sorted(active_transcriptions, key=lambda t: t.created_at, reverse=True)[0]
    return (latest.processed_text or latest.raw_text or "").strip()


async def _generate_note_for_mode(db: AsyncSession, lecture: Lecture, mode: str) -> None:
    ml_mode = MATERIAL_MODE_TO_ML_MODE.get(mode)
    if ml_mode is None:
        raise HTTPException(status_code=400, detail="Неподдерживаемый режим материала")

    text = _lecture_latest_text(lecture)
    if not text:
        raise HTTPException(status_code=400, detail="У лекции нет текста для генерации материала")

    try:
        # Avoid circular import on startup; reuse global ML processor instance.
        from ..ml_endpoints import get_processor

        processor = get_processor()
        generated = await processor.process_text(text, ml_mode)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации материала: {str(e)}")

    if not (generated or "").strip():
        raise HTTPException(status_code=500, detail="Сервис генерации вернул пустой материал")

    note_result = await db.execute(
        select(LectureNote).where(LectureNote.lecture_id == lecture.id, LectureNote.mode == mode)
    )
    note = note_result.scalar_one_or_none()
    if note is None:
        note = LectureNote(lecture_id=lecture.id, mode=mode, content=generated)
        db.add(note)
    else:
        note.content = generated
        note.created_at = datetime.utcnow()


async def _material_request_out(db: AsyncSession, req: LectureMaterialGenerationRequest) -> MaterialGenerationRequestOut:
    lecture_res = await db.execute(select(Lecture).where(Lecture.id == req.lecture_id))
    lecture = lecture_res.scalar_one()

    requester_res = await db.execute(select(User).where(User.id == req.requested_by))
    requester = requester_res.scalar_one()

    stream_res = await db.execute(
        select(Stream)
        .options(selectinload(Stream.direction).selectinload(Direction.faculty))
        .where(Stream.id == req.stream_id)
    )
    stream = stream_res.scalar_one()

    reviewer_login = None
    if req.reviewed_by:
        reviewer_res = await db.execute(select(User).where(User.id == req.reviewed_by))
        reviewer = reviewer_res.scalar_one_or_none()
        reviewer_login = reviewer.login if reviewer else None

    return MaterialGenerationRequestOut(
        id=req.id,
        lecture_id=req.lecture_id,
        lecture_title=lecture.title,
        stream_id=stream.id,
        stream_name=stream.name,
        direction_id=stream.direction.id,
        direction_name=stream.direction.name,
        faculty_id=stream.direction.faculty.id,
        faculty_name=stream.direction.faculty.name,
        mode=req.mode,
        requested_by=req.requested_by,
        requested_by_login=requester.login,
        status=req.status.value,
        review_comment=req.review_comment,
        reviewed_by=req.reviewed_by,
        reviewed_by_login=reviewer_login,
        reviewed_at=req.reviewed_at,
        created_at=req.created_at,
    )


@router.post("/material-requests", response_model=MaterialGenerationRequestOut, status_code=status.HTTP_201_CREATED)
async def create_material_generation_request(
    body: MaterialGenerationRequestCreateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mode = body.mode.strip()
    if mode not in MATERIAL_MODE_TO_ML_MODE:
        raise HTTPException(status_code=400, detail="Неподдерживаемый режим материала")

    lecture_result = await db.execute(
        select(Lecture)
        .options(selectinload(Lecture.catalog_item), selectinload(Lecture.notes))
        .where(Lecture.id == body.lecture_id, Lecture.is_deleted == False)
    )
    lecture = lecture_result.scalar_one_or_none()
    if lecture is None:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    if lecture.catalog_item is None:
        raise HTTPException(status_code=400, detail="Лекция не опубликована в базе")
    if lecture.catalog_item.stream_id != body.stream_id:
        raise HTTPException(status_code=400, detail="Поток заявки не совпадает с потоком лекции в базе")

    existing_note = next((n for n in lecture.notes if n.mode == mode), None)
    if existing_note is not None:
        raise HTTPException(status_code=409, detail="Материал для этого режима уже создан")

    pending_result = await db.execute(
        select(LectureMaterialGenerationRequest).where(
            LectureMaterialGenerationRequest.lecture_id == body.lecture_id,
            LectureMaterialGenerationRequest.mode == mode,
            LectureMaterialGenerationRequest.status == MaterialGenerationRequestStatus.pending,
        )
    )
    if pending_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Заявка на этот режим уже отправлена и ожидает модерации")

    req = LectureMaterialGenerationRequest(
        lecture_id=body.lecture_id,
        stream_id=body.stream_id,
        mode=mode,
        requested_by=user.id,
        status=MaterialGenerationRequestStatus.pending,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return await _material_request_out(db, req)


@router.get("/material-requests/my", response_model=List[MaterialGenerationRequestOut])
async def list_my_material_generation_requests(
    lecture_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(LectureMaterialGenerationRequest).where(
        LectureMaterialGenerationRequest.requested_by == user.id
    )
    if lecture_id is not None:
        stmt = stmt.where(LectureMaterialGenerationRequest.lecture_id == lecture_id)
    stmt = stmt.order_by(LectureMaterialGenerationRequest.created_at.desc())
    result = await db.execute(stmt)
    reqs = result.scalars().all()
    out: list[MaterialGenerationRequestOut] = []
    for req in reqs:
        out.append(await _material_request_out(db, req))
    return out


@router.get("/material-requests", response_model=List[MaterialGenerationRequestOut])
async def list_material_generation_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    stream_id: Optional[UUID] = Query(None),
    limit: int = Query(100, ge=1, le=300),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    moderator: User = Depends(require_catalog_moderator),
):
    stmt = (
        select(LectureMaterialGenerationRequest)
        .order_by(LectureMaterialGenerationRequest.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    if status_filter:
        try:
            stmt = stmt.where(LectureMaterialGenerationRequest.status == MaterialGenerationRequestStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail="Невалидный статус")

    if stream_id:
        stmt = stmt.where(LectureMaterialGenerationRequest.stream_id == stream_id)

    if moderator.role != "admin":
        stmt = stmt.where(LectureMaterialGenerationRequest.stream_id == moderator.stream_id)

    result = await db.execute(stmt)
    reqs = result.scalars().all()
    out: list[MaterialGenerationRequestOut] = []
    for req in reqs:
        out.append(await _material_request_out(db, req))
    return out


@router.post("/material-requests/{request_id}/approve", response_model=MaterialGenerationRequestOut)
async def approve_material_generation_request(
    request_id: UUID,
    body: MaterialGenerationRequestModerateIn,
    db: AsyncSession = Depends(get_db),
    moderator: User = Depends(require_catalog_moderator),
):
    req_result = await db.execute(
        select(LectureMaterialGenerationRequest).where(LectureMaterialGenerationRequest.id == request_id)
    )
    req = req_result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if not _is_catalog_editor(moderator, req.stream_id):
        raise HTTPException(status_code=403, detail="Нет прав для этого потока")
    if req.status != MaterialGenerationRequestStatus.pending:
        raise HTTPException(status_code=400, detail="Заявка уже обработана")

    lecture_result = await db.execute(
        select(Lecture)
        .options(selectinload(Lecture.transcriptions), selectinload(Lecture.notes), selectinload(Lecture.catalog_item))
        .where(Lecture.id == req.lecture_id, Lecture.is_deleted == False)
    )
    lecture = lecture_result.scalar_one_or_none()
    if lecture is None:
        raise HTTPException(status_code=404, detail="Лекция не найдена")
    if lecture.catalog_item is None or lecture.catalog_item.stream_id != req.stream_id:
        raise HTTPException(status_code=400, detail="Лекция больше не принадлежит потоку заявки")

    await _generate_note_for_mode(db, lecture, req.mode)
    req.status = MaterialGenerationRequestStatus.approved
    req.reviewed_by = moderator.id
    req.reviewed_at = datetime.utcnow()
    req.review_comment = (body.review_comment or "").strip() or None
    await db.commit()
    await db.refresh(req)
    return await _material_request_out(db, req)


@router.post("/material-requests/{request_id}/reject", response_model=MaterialGenerationRequestOut)
async def reject_material_generation_request(
    request_id: UUID,
    body: MaterialGenerationRequestModerateIn,
    db: AsyncSession = Depends(get_db),
    moderator: User = Depends(require_catalog_moderator),
):
    req_result = await db.execute(
        select(LectureMaterialGenerationRequest).where(LectureMaterialGenerationRequest.id == request_id)
    )
    req = req_result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if not _is_catalog_editor(moderator, req.stream_id):
        raise HTTPException(status_code=403, detail="Нет прав для этого потока")
    if req.status != MaterialGenerationRequestStatus.pending:
        raise HTTPException(status_code=400, detail="Заявка уже обработана")

    review_comment = (body.review_comment or "").strip()
    if not review_comment:
        raise HTTPException(status_code=400, detail="Нужно указать причину отклонения")

    req.status = MaterialGenerationRequestStatus.rejected
    req.reviewed_by = moderator.id
    req.reviewed_at = datetime.utcnow()
    req.review_comment = review_comment
    await db.commit()
    await db.refresh(req)
    return await _material_request_out(db, req)


async def _ensure_catalog_item(
    *,
    db: AsyncSession,
    lecture_id: UUID,
    stream_id: UUID,
    discipline: str,
    lecturer_name: Optional[str],
    course_text: Optional[str],
    semester_text: Optional[str],
    lecture_number_text: Optional[str],
    study_year_text: Optional[str],
    publisher: User,
    source_request_id: Optional[UUID] = None,
) -> LectureCatalogItem:
    lecture_result = await db.execute(select(Lecture).where(Lecture.id == lecture_id, Lecture.is_deleted == False))
    lecture = lecture_result.scalar_one_or_none()
    if lecture is None:
        raise HTTPException(status_code=404, detail="Лекция не найдена")

    stream_result = await db.execute(select(Stream).where(Stream.id == stream_id))
    stream = stream_result.scalar_one_or_none()
    if stream is None:
        raise HTTPException(status_code=400, detail="Поток не найден")
    if not _is_catalog_editor(publisher, stream.id):
        raise HTTPException(status_code=403, detail="Нет прав для этого потока")

    existing_result = await db.execute(
        select(LectureCatalogItem).where(LectureCatalogItem.lecture_id == lecture_id)
    )
    item = existing_result.scalar_one_or_none()
    if item:
        item.stream_id = stream_id
        item.discipline = discipline
        item.lecturer_name = lecturer_name
        item.course_text = course_text
        item.semester_text = semester_text
        item.lecture_number_text = lecture_number_text
        item.study_year_text = study_year_text
        item.published_by = publisher.id
        item.source_request_id = source_request_id
    else:
        item = LectureCatalogItem(
            lecture_id=lecture_id,
            stream_id=stream_id,
            discipline=discipline,
            lecturer_name=lecturer_name,
            course_text=course_text,
            semester_text=semester_text,
            lecture_number_text=lecture_number_text,
            study_year_text=study_year_text,
            published_by=publisher.id,
            source_request_id=source_request_id,
        )
        db.add(item)

    return item


@router.post("/publish", response_model=CatalogItemOut, status_code=status.HTTP_201_CREATED)
async def publish_catalog_item_manual(
    body: ManualCatalogPublishIn,
    db: AsyncSession = Depends(get_db),
    moderator: User = Depends(require_catalog_moderator),
):
    item = await _ensure_catalog_item(
        db=db,
        lecture_id=body.lecture_id,
        stream_id=body.stream_id,
        discipline=body.discipline.strip(),
        lecturer_name=(body.lecturer_name or "").strip() or None,
        course_text=(body.course_text or "").strip() or None,
        semester_text=(body.semester_text or "").strip() or None,
        lecture_number_text=(body.lecture_number_text or "").strip() or None,
        study_year_text=(body.study_year_text or "").strip() or None,
        publisher=moderator,
        source_request_id=None,
    )
    await db.commit()
    await db.refresh(item)

    row_result = await db.execute(
        select(
            LectureCatalogItem,
            Lecture,
            Stream,
            Direction,
            Faculty,
            User,
        )
        .join(Lecture, Lecture.id == LectureCatalogItem.lecture_id)
        .join(Stream, Stream.id == LectureCatalogItem.stream_id)
        .join(Direction, Direction.id == Stream.direction_id)
        .join(Faculty, Faculty.id == Direction.faculty_id)
        .join(User, User.id == LectureCatalogItem.published_by)
        .where(LectureCatalogItem.id == item.id)
    )
    item, lecture, stream, direction, faculty, publisher = row_result.one()
    return CatalogItemOut(
        id=item.id,
        lecture_id=lecture.id,
        lecture_title=lecture.title,
        lecture_subject=lecture.subject,
        discipline=item.discipline,
        lecturer_name=item.lecturer_name,
        course_text=item.course_text,
        semester_text=item.semester_text,
        lecture_number_text=item.lecture_number_text,
        study_year_text=item.study_year_text,
        stream_id=stream.id,
        stream_name=stream.name,
        direction_id=direction.id,
        direction_name=direction.name,
        faculty_id=faculty.id,
        faculty_name=faculty.name,
        published_by_login=publisher.login,
        created_at=item.created_at,
    )


@router.post("/requests/{request_id}/approve", response_model=PublicationRequestOut)
async def approve_publication_request(
    request_id: UUID,
    body: PublicationRequestModerateIn,
    db: AsyncSession = Depends(get_db),
    moderator: User = Depends(require_catalog_moderator),
):
    req_result = await db.execute(
        select(LecturePublicationRequest)
        .options(selectinload(LecturePublicationRequest.lecture))
        .where(LecturePublicationRequest.id == request_id)
    )
    req = req_result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    target_stream_id = body.stream_id or req.stream_id
    stream_result = await db.execute(select(Stream).where(Stream.id == target_stream_id))
    target_stream = stream_result.scalar_one_or_none()
    if target_stream is None:
        raise HTTPException(status_code=400, detail="Поток не найден")
    if not _is_catalog_editor(moderator, target_stream_id):
        raise HTTPException(status_code=403, detail="Нет прав для этого потока")

    if body.lecture_title and body.lecture_title.strip():
        req.lecture.title = body.lecture_title.strip()

    discipline = (body.discipline or "").strip() or req.discipline
    lecturer_name = (body.lecturer_name or "").strip() or req.lecturer_name
    course_text = (body.course_text or "").strip() or req.course_text
    semester_text = (body.semester_text or "").strip() or req.semester_text
    lecture_number_text = (body.lecture_number_text or "").strip() or req.lecture_number_text
    study_year_text = (body.study_year_text or "").strip() or req.study_year_text

    if not discipline:
        raise HTTPException(status_code=400, detail="Нужно указать дисциплину")

    await _ensure_catalog_item(
        db=db,
        lecture_id=req.lecture_id,
        stream_id=target_stream_id,
        discipline=discipline,
        lecturer_name=lecturer_name,
        course_text=course_text,
        semester_text=semester_text,
        lecture_number_text=lecture_number_text,
        study_year_text=study_year_text,
        publisher=moderator,
        source_request_id=req.id,
    )
    req.discipline = discipline
    req.lecturer_name = lecturer_name
    req.course_text = course_text
    req.semester_text = semester_text
    req.stream_id = target_stream_id
    req.lecture_number_text = lecture_number_text
    req.study_year_text = study_year_text
    req.status = PublicationRequestStatus.approved
    req.reviewed_by = moderator.id
    req.reviewed_at = datetime.utcnow()
    req.review_comment = (body.review_comment or "").strip() or None
    await db.commit()
    await db.refresh(req)

    return await _request_out(db, req)


@router.post("/requests/{request_id}/reject", response_model=PublicationRequestOut)
async def reject_publication_request(
    request_id: UUID,
    body: PublicationRequestModerateIn,
    db: AsyncSession = Depends(get_db),
    moderator: User = Depends(require_catalog_moderator),
):
    req_result = await db.execute(
        select(LecturePublicationRequest)
        .options(selectinload(LecturePublicationRequest.lecture))
        .where(LecturePublicationRequest.id == request_id)
    )
    req = req_result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    target_stream_id = body.stream_id or req.stream_id
    stream_result = await db.execute(select(Stream).where(Stream.id == target_stream_id))
    target_stream = stream_result.scalar_one_or_none()
    if target_stream is None:
        raise HTTPException(status_code=400, detail="Поток не найден")
    if not _is_catalog_editor(moderator, target_stream_id):
        raise HTTPException(status_code=403, detail="Нет прав для этого потока")
    if not body.review_comment or not body.review_comment.strip():
        raise HTTPException(status_code=400, detail="Нужно указать причину отклонения")

    if body.lecture_title and body.lecture_title.strip():
        req.lecture.title = body.lecture_title.strip()

    req.discipline = (body.discipline or "").strip() or req.discipline
    req.lecturer_name = (body.lecturer_name or "").strip() or req.lecturer_name
    req.course_text = (body.course_text or "").strip() or req.course_text
    req.semester_text = (body.semester_text or "").strip() or req.semester_text
    req.stream_id = target_stream_id
    req.lecture_number_text = (body.lecture_number_text or "").strip() or req.lecture_number_text
    req.study_year_text = (body.study_year_text or "").strip() or req.study_year_text

    req.status = PublicationRequestStatus.rejected
    req.reviewed_by = moderator.id
    req.reviewed_at = datetime.utcnow()
    req.review_comment = body.review_comment.strip()
    await db.commit()
    await db.refresh(req)
    return await _request_out(db, req)


async def _request_out(db: AsyncSession, req: LecturePublicationRequest) -> PublicationRequestOut:
    lecture_res = await db.execute(select(Lecture).where(Lecture.id == req.lecture_id))
    lecture = lecture_res.scalar_one()

    requester_res = await db.execute(select(User).where(User.id == req.requested_by))
    requester = requester_res.scalar_one()

    stream_res = await db.execute(
        select(Stream)
        .options(selectinload(Stream.direction).selectinload(Direction.faculty))
        .where(Stream.id == req.stream_id)
    )
    stream = stream_res.scalar_one()

    reviewer_login = None
    if req.reviewed_by:
        reviewer_res = await db.execute(select(User).where(User.id == req.reviewed_by))
        reviewer = reviewer_res.scalar_one_or_none()
        reviewer_login = reviewer.login if reviewer else None

    return PublicationRequestOut(
        id=req.id,
        lecture_id=req.lecture_id,
        lecture_title=lecture.title,
        requested_by=req.requested_by,
        requested_by_login=requester.login,
        stream_id=stream.id,
        stream_name=stream.name,
        direction_id=stream.direction.id,
        direction_name=stream.direction.name,
        faculty_id=stream.direction.faculty.id,
        faculty_name=stream.direction.faculty.name,
        discipline=req.discipline,
        lecturer_name=req.lecturer_name,
        course_text=req.course_text,
        semester_text=req.semester_text,
        lecture_number_text=req.lecture_number_text,
        study_year_text=req.study_year_text,
        comment=req.comment,
        status=req.status.value,
        review_comment=req.review_comment,
        reviewed_by=req.reviewed_by,
        reviewed_by_login=reviewer_login,
        reviewed_at=req.reviewed_at,
        created_at=req.created_at,
    )
