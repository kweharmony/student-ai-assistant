from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_, select
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
    Direction,
    Faculty,
    Lecture,
    LectureCatalogItem,
    LecturePublicationRequest,
    PublicationRequestStatus,
    Stream,
    User,
)
from ..schemas import (
    AdminSetGroupHeadIn,
    CatalogItemOut,
    DirectionCreateIn,
    DirectionOut,
    FacultyCreateIn,
    FacultyOut,
    ManualCatalogPublishIn,
    MyLecturePublicationStatusOut,
    PublicationRequestCreateIn,
    PublicationRequestModerateIn,
    PublicationRequestOut,
    StreamCreateIn,
    StreamOut,
)

router = APIRouter(prefix="/api/catalog", tags=["Catalog"])


def _is_catalog_editor(user: User, stream_id: Optional[UUID]) -> bool:
    return can_moderate_stream(user, stream_id)


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
        course=body.course,
        study_year_start=body.study_year_start,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.get("/items", response_model=List[CatalogItemOut])
async def list_catalog_items(
    faculty_id: Optional[UUID] = Query(None),
    direction_id: Optional[UUID] = Query(None),
    stream_id: Optional[UUID] = Query(None),
    discipline: Optional[str] = Query(None),
    lecturer_name: Optional[str] = Query(None),
    course_text: Optional[str] = Query(None),
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
        discipline=body.discipline.strip(),
        lecturer_name=(body.lecturer_name or "").strip() or None,
        course_text=(body.course_text or "").strip() or None,
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


async def _ensure_catalog_item(
    *,
    db: AsyncSession,
    lecture_id: UUID,
    stream_id: UUID,
    discipline: str,
    lecturer_name: Optional[str],
    course_text: Optional[str],
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
    if not _is_catalog_editor(moderator, req.stream_id):
        raise HTTPException(status_code=403, detail="Нет прав для этого потока")

    await _ensure_catalog_item(
        db=db,
        lecture_id=req.lecture_id,
        stream_id=req.stream_id,
        discipline=req.discipline,
        lecturer_name=req.lecturer_name,
        course_text=req.course_text,
        study_year_text=req.study_year_text,
        publisher=moderator,
        source_request_id=req.id,
    )
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
    req_result = await db.execute(select(LecturePublicationRequest).where(LecturePublicationRequest.id == request_id))
    req = req_result.scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if not _is_catalog_editor(moderator, req.stream_id):
        raise HTTPException(status_code=403, detail="Нет прав для этого потока")
    if not body.review_comment or not body.review_comment.strip():
        raise HTTPException(status_code=400, detail="Нужно указать причину отклонения")

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
        study_year_text=req.study_year_text,
        comment=req.comment,
        status=req.status.value,
        review_comment=req.review_comment,
        reviewed_by=req.reviewed_by,
        reviewed_by_login=reviewer_login,
        reviewed_at=req.reviewed_at,
        created_at=req.created_at,
    )
