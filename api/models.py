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
    is_active = Column(Boolean, default=True, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    blocked_reason = Column(String(300), nullable=True)
    blocked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    blocked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    # relationships
    student_profile = relationship("StudentProfile", back_populates="user", uselist=False)
    teacher_profile = relationship("TeacherProfile", back_populates="user", uselist=False)
    lectures = relationship("Lecture", back_populates="uploader", foreign_keys="Lecture.uploaded_by")


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


# ========== 9. admin_actions ==========

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
