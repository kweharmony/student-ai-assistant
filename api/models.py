"""
SQLAlchemy ORM-модели для всех 7 таблиц.
UUID первичные ключи, мягкое удаление, индексы.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Index,
    Integer, SmallInteger, String, Text, BigInteger, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from .database import Base


# ---------- ENUM types ----------

import enum

class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class LectureStatus(str, enum.Enum):
    processing = "processing"
    ready = "ready"
    error = "error"


# ---------- helpers ----------

def _uuid():
    return uuid.uuid4()

def _now():
    return datetime.utcnow()


# ========== 1. users ==========

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    login = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, name="user_role", create_constraint=True), nullable=False)
    full_name = Column(String(100), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    avatar_emoji = Column(String(10), nullable=True)
    is_group_head = Column(Boolean, default=False, nullable=False, index=True)
    stream_id = Column(UUID(as_uuid=True), ForeignKey("streams.id"), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    blocked_reason = Column(String(300), nullable=True)
    blocked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    blocked_at = Column(DateTime, nullable=True)
    blocked_until = Column(DateTime, nullable=True)  # None = indefinite
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    # relationships
    student_profile = relationship("StudentProfile", back_populates="user", uselist=False)
    teacher_profile = relationship("TeacherProfile", back_populates="user", uselist=False)
    lectures = relationship("Lecture", back_populates="uploader", foreign_keys="Lecture.uploaded_by")
    stream = relationship("Stream")


# ========== 2. student_profiles ==========

class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    group_name = Column(String(20), nullable=True)
    course = Column(SmallInteger, nullable=True)
    faculty = Column(String(100), nullable=True)

    user = relationship("User", back_populates="student_profile")


# ========== 3. teacher_profiles ==========

class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    department = Column(String(150), nullable=True)
    position = Column(String(100), nullable=True)
    academic_degree = Column(String(100), nullable=True)

    user = relationship("User", back_populates="teacher_profile")


# ========== 4. lectures ==========

class Lecture(Base):
    __tablename__ = "lectures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String(100), nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(Enum(LectureStatus, name="lecture_status", create_constraint=True), default=LectureStatus.processing, nullable=False)
    is_public = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    delete_reason = Column(String(300), nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    uploader = relationship("User", back_populates="lectures", foreign_keys=[uploaded_by])
    audio_files = relationship("AudioFile", back_populates="lecture")
    transcriptions = relationship("Transcription", back_populates="lecture")
    notes = relationship("LectureNote", back_populates="lecture", cascade="all, delete-orphan")
    catalog_item = relationship("LectureCatalogItem", back_populates="lecture", uselist=False)
    publication_requests = relationship("LecturePublicationRequest", back_populates="lecture")
    ai_filter_requests = relationship("LectureAiFilterRequest", back_populates="lecture")


# ========== 5. audio_files ==========

class AudioFile(Base):
    __tablename__ = "audio_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    lecture_id = Column(UUID(as_uuid=True), ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(BigInteger, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    mime_type = Column(String(50), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    audio_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    lecture = relationship("Lecture", back_populates="audio_files")
    transcription = relationship("Transcription", back_populates="audio_file", uselist=False)


# ========== 6. transcriptions ==========

class Transcription(Base):
    __tablename__ = "transcriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    lecture_id = Column(UUID(as_uuid=True), ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, index=True)
    audio_file_id = Column(UUID(as_uuid=True), ForeignKey("audio_files.id", ondelete="CASCADE"), nullable=False)
    raw_text = Column(Text, nullable=False)
    processed_text = Column(Text, nullable=True)
    is_ai_filtered = Column(Boolean, default=False, nullable=False)
    filtered_at = Column(DateTime, nullable=True)
    whisper_model = Column(String(20), nullable=True)
    language = Column(String(10), nullable=True)
    confidence = Column(Float, nullable=True)
    processing_time = Column(Float, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    lecture = relationship("Lecture", back_populates="transcriptions")
    audio_file = relationship("AudioFile", back_populates="transcription")


# ========== 7. transcription_tasks ==========

class TranscriptionTaskStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    error = "error"
    failed = "failed"


class TranscriptionTask(Base):
    __tablename__ = "transcription_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    audio_file_id = Column(UUID(as_uuid=True), ForeignKey("audio_files.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(
        Enum(TranscriptionTaskStatus, name="task_status", native_enum=False),
        default=TranscriptionTaskStatus.pending,
        nullable=False,
        index=True,
    )
    worker_id = Column(String(100), nullable=True)
    worker_name = Column(String(100), nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    last_heartbeat_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    audio_file = relationship("AudioFile", backref="transcription_task")


# ========== 8. lecture_notes ==========

class LectureNote(Base):
    __tablename__ = "lecture_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    lecture_id = Column(UUID(as_uuid=True), ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, index=True)
    mode = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_now, nullable=False)

    lecture = relationship("Lecture", back_populates="notes")

    __table_args__ = (UniqueConstraint("lecture_id", "mode", name="uq_lecture_note_mode"),)


# ========== 9. lecture_ai_filter_requests ==========

class LectureAiFilterRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    failed = "failed"


class LectureAiFilterRequest(Base):
    __tablename__ = "lecture_ai_filter_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    lecture_id = Column(UUID(as_uuid=True), ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(
        Enum(LectureAiFilterRequestStatus, name="lecture_ai_filter_request_status", native_enum=False),
        default=LectureAiFilterRequestStatus.pending,
        nullable=False,
        index=True,
    )
    review_comment = Column(Text, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    generation_status = Column(String(20), default="idle", nullable=False)
    generation_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    lecture = relationship("Lecture", back_populates="ai_filter_requests")
    requester = relationship("User", foreign_keys=[requested_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


# ========== 9. boards ==========

class Board(Base):
    __tablename__ = "boards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    title = Column(String(255), nullable=False, default="Новое полотно")
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    share_token = Column(String(64), nullable=True, unique=True)
    is_public = Column(Boolean, default=False, nullable=False)
    share_mode = Column(String(10), default="view", nullable=False)
    data = Column(Text, nullable=True)  # Excalidraw JSON state
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    owner = relationship("User")


class BoardVisit(Base):
    __tablename__ = "board_visits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    board_id = Column(UUID(as_uuid=True), ForeignKey("boards.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    last_access_mode = Column(String(10), default="view", nullable=False)
    last_opened_at = Column(DateTime, default=_now, nullable=False)

    board = relationship("Board")
    user = relationship("User")

    __table_args__ = (UniqueConstraint("board_id", "user_id", name="uq_board_visit_board_user"),)


# ========== 10. admin_actions ==========

class AdminAction(Base):
    __tablename__ = "admin_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    target_type = Column(String(20), nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=False)
    reason = Column(String(300), nullable=True)
    details = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    admin = relationship("User", foreign_keys=[admin_id])


class Faculty(Base):
    __tablename__ = "faculties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name = Column(String(150), nullable=False, unique=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    directions = relationship("Direction", back_populates="faculty", cascade="all, delete-orphan")


class Direction(Base):
    __tablename__ = "directions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculties.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    created_at = Column(DateTime, default=_now, nullable=False)

    faculty = relationship("Faculty", back_populates="directions")
    streams = relationship("Stream", back_populates="direction", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("faculty_id", "name", name="uq_direction_faculty_name"),)


class Stream(Base):
    __tablename__ = "streams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    direction_id = Column(UUID(as_uuid=True), ForeignKey("directions.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    course = Column(SmallInteger, nullable=True)
    study_year_start = Column(SmallInteger, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    direction = relationship("Direction", back_populates="streams")

    __table_args__ = (
        UniqueConstraint("direction_id", "name", "study_year_start", name="uq_stream_direction_name_year"),
    )


class CatalogDisciplineTemplate(Base):
    __tablename__ = "catalog_discipline_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    direction_id = Column(UUID(as_uuid=True), ForeignKey("directions.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    direction = relationship("Direction")
    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        UniqueConstraint("direction_id", "name", name="uq_catalog_discipline_direction_name"),
    )


class CatalogLecturerTemplate(Base):
    __tablename__ = "catalog_lecturer_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    stream_id = Column(UUID(as_uuid=True), ForeignKey("streams.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    stream = relationship("Stream")
    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        UniqueConstraint("stream_id", "name", name="uq_catalog_lecturer_stream_name"),
    )


class PublicationRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class MaterialGenerationRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class LecturePublicationRequest(Base):
    __tablename__ = "lecture_publication_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    lecture_id = Column(UUID(as_uuid=True), ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    stream_id = Column(UUID(as_uuid=True), ForeignKey("streams.id"), nullable=False, index=True)
    discipline = Column(String(150), nullable=False)
    lecturer_name = Column(String(150), nullable=True)
    course_text = Column(String(50), nullable=True)
    semester_text = Column(String(20), nullable=True)
    lecture_number_text = Column(String(50), nullable=True)
    study_year_text = Column(String(50), nullable=True)
    comment = Column(String(500), nullable=True)
    status = Column(
        Enum(PublicationRequestStatus, name="publication_request_status", native_enum=False),
        default=PublicationRequestStatus.pending,
        nullable=False,
        index=True,
    )
    review_comment = Column(String(500), nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    lecture = relationship("Lecture", back_populates="publication_requests")
    requester = relationship("User", foreign_keys=[requested_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    stream = relationship("Stream")


class LectureCatalogItem(Base):
    __tablename__ = "lecture_catalog_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    lecture_id = Column(UUID(as_uuid=True), ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    stream_id = Column(UUID(as_uuid=True), ForeignKey("streams.id"), nullable=False, index=True)
    discipline = Column(String(150), nullable=False, index=True)
    lecturer_name = Column(String(150), nullable=True, index=True)
    course_text = Column(String(50), nullable=True, index=True)
    semester_text = Column(String(20), nullable=True, index=True)
    lecture_number_text = Column(String(50), nullable=True, index=True)
    study_year_text = Column(String(50), nullable=True, index=True)
    published_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    source_request_id = Column(UUID(as_uuid=True), ForeignKey("lecture_publication_requests.id"), nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    lecture = relationship("Lecture", back_populates="catalog_item")
    stream = relationship("Stream")
    publisher = relationship("User", foreign_keys=[published_by])
    source_request = relationship("LecturePublicationRequest")


class CatalogSemester(Base):
    __tablename__ = "catalog_semesters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    stream_id = Column(UUID(as_uuid=True), ForeignKey("streams.id", ondelete="CASCADE"), nullable=False, index=True)
    course_text = Column(String(50), nullable=False, index=True)
    semester_key = Column(String(10), nullable=False, index=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    stream = relationship("Stream")

    __table_args__ = (
        UniqueConstraint("stream_id", "course_text", "semester_key", name="uq_catalog_semester_stream_course_key"),
    )


class CatalogDisciplineNode(Base):
    __tablename__ = "catalog_discipline_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    stream_id = Column(UUID(as_uuid=True), ForeignKey("streams.id", ondelete="CASCADE"), nullable=False, index=True)
    course_text = Column(String(50), nullable=False, index=True)
    semester_key = Column(String(10), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    created_at = Column(DateTime, default=_now, nullable=False)

    stream = relationship("Stream")

    __table_args__ = (
        UniqueConstraint("stream_id", "course_text", "semester_key", "name", name="uq_catalog_discipline_node"),
    )


class LectureMaterialGenerationRequest(Base):
    __tablename__ = "lecture_material_generation_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    lecture_id = Column(UUID(as_uuid=True), ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, index=True)
    stream_id = Column(UUID(as_uuid=True), ForeignKey("streams.id"), nullable=False, index=True)
    mode = Column(String(50), nullable=False, index=True)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(
        Enum(MaterialGenerationRequestStatus, name="material_generation_request_status", native_enum=False),
        default=MaterialGenerationRequestStatus.pending,
        nullable=False,
        index=True,
    )
    review_comment = Column(String(500), nullable=True)
    generation_status = Column(String(20), nullable=False, default="idle", index=True)
    generation_error = Column(String(500), nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    lecture = relationship("Lecture")
    stream = relationship("Stream")
    requester = relationship("User", foreign_keys=[requested_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
