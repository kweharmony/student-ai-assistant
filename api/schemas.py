"""
Pydantic-схемы для валидации request/response всех эндпоинтов.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator


# ==================== Auth ====================

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(..., pattern="^(student|teacher)$")
    full_name: Optional[str] = Field(None, max_length=100)
    # student fields
    group_name: Optional[str] = Field(None, max_length=20)
    course: Optional[int] = Field(None, ge=1, le=6)
    faculty: Optional[str] = Field(None, max_length=100)
    stream_id: Optional[UUID] = None
    # teacher fields
    department: Optional[str] = Field(None, max_length=150)
    position: Optional[str] = Field(None, max_length=100)
    academic_degree: Optional[str] = Field(None, max_length=100)


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    generated_login: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ==================== User ====================

class StudentProfileOut(BaseModel):
    group_name: Optional[str] = None
    course: Optional[int] = None
    faculty: Optional[str] = None

    model_config = {"from_attributes": True}


class TeacherProfileOut(BaseModel):
    department: Optional[str] = None
    position: Optional[str] = None
    academic_degree: Optional[str] = None

    model_config = {"from_attributes": True}


class UserStreamOut(BaseModel):
    id: UUID
    name: str

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: UUID
    login: str
    email: str
    role: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_emoji: Optional[str] = None
    is_group_head: bool = False
    stream_id: Optional[UUID] = None
    stream: Optional[UserStreamOut] = None
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    student_profile: Optional[StudentProfileOut] = None
    teacher_profile: Optional[TeacherProfileOut] = None

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None
    # student fields
    group_name: Optional[str] = Field(None, max_length=20)
    course: Optional[int] = Field(None, ge=1, le=6)
    faculty: Optional[str] = Field(None, max_length=100)
    stream_id: Optional[UUID] = None
    # teacher fields
    department: Optional[str] = Field(None, max_length=150)
    position: Optional[str] = Field(None, max_length=100)
    academic_degree: Optional[str] = Field(None, max_length=100)


class SetEmojiRequest(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=10)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=128)


# ==================== Lectures ====================

class LectureCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: Optional[str] = None
    subject: Optional[str] = Field(None, max_length=100)
    is_public: bool = False


class LectureUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=300)
    description: Optional[str] = None
    subject: Optional[str] = Field(None, max_length=100)
    is_public: Optional[bool] = None


class AudioFileOut(BaseModel):
    id: UUID
    file_name: str
    file_size: Optional[int] = None
    duration_seconds: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TranscriptionOut(BaseModel):
    id: UUID
    audio_file_id: UUID
    raw_text: str
    processed_text: Optional[str] = None
    whisper_model: Optional[str] = None
    language: Optional[str] = None
    confidence: Optional[float] = None
    processing_time: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class LectureOut(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    uploaded_by: UUID
    status: str
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LectureDetailOut(LectureOut):
    audio_files: List[AudioFileOut] = []
    transcriptions: List[TranscriptionOut] = []


# ==================== Worker / TranscriptionTask ====================

class TaskEnqueuedOut(BaseModel):
    task_id: UUID
    status: str
    audio_file_id: UUID


class TranscriptionTaskOut(BaseModel):
    id: UUID
    audio_file_id: UUID
    status: str
    worker_name: Optional[str] = None
    retry_count: int
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class WorkerNextTaskOut(BaseModel):
    task: Optional[TranscriptionTaskOut] = None


class WorkerResultIn(BaseModel):
    raw_text: str
    language: str = "ru"
    processing_time: float = 0.0
    whisper_model: str = "base"
    device_used: Optional[str] = None


class WorkerErrorIn(BaseModel):
    error_message: str


class WorkerHeartbeatIn(BaseModel):
    task_id: Optional[UUID] = None


class WorkerStatusOut(BaseModel):
    pending: int
    processing: int
    completed: int
    error: int
    failed: int
    active_workers: List[str]


# ==================== My Lectures ====================

class LectureNoteOut(BaseModel):
    id: UUID
    mode: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LectureNoteContentOut(LectureNoteOut):
    content: str


class LectureNoteIn(BaseModel):
    mode: str
    content: str


class LectureMyOut(BaseModel):
    id: UUID
    title: str
    subject: Optional[str] = None
    status: str
    created_at: datetime
    task_status: Optional[str] = None
    transcription_id: Optional[UUID] = None
    has_text: bool = False
    is_ai_filtered: bool = False
    audio_expires_at: Optional[datetime] = None
    notes: List[LectureNoteOut] = []


class FacultyOut(BaseModel):
    id: UUID
    name: str

    model_config = {"from_attributes": True}


class DirectionOut(BaseModel):
    id: UUID
    faculty_id: UUID
    name: str

    model_config = {"from_attributes": True}


class StreamOut(BaseModel):
    id: UUID
    direction_id: UUID
    name: str
    course: Optional[int] = None
    study_year_start: Optional[int] = None

    model_config = {"from_attributes": True}


class CatalogItemOut(BaseModel):
    id: UUID
    lecture_id: UUID
    lecture_title: str
    lecture_subject: Optional[str] = None
    discipline: str
    lecturer_name: Optional[str] = None
    course_text: Optional[str] = None
    study_year_text: Optional[str] = None
    stream_id: UUID
    stream_name: str
    direction_id: UUID
    direction_name: str
    faculty_id: UUID
    faculty_name: str
    published_by_login: str
    created_at: datetime


class PublicationRequestCreateIn(BaseModel):
    lecture_id: UUID
    stream_id: UUID
    discipline: str = Field(..., min_length=1, max_length=150)
    lecturer_name: Optional[str] = Field(None, max_length=150)
    course_text: Optional[str] = Field(None, max_length=50)
    study_year_text: Optional[str] = Field(None, max_length=50)
    comment: Optional[str] = Field(None, max_length=500)


class PublicationRequestModerateIn(BaseModel):
    review_comment: Optional[str] = Field(None, max_length=500)


class ManualCatalogPublishIn(BaseModel):
    lecture_id: UUID
    stream_id: UUID
    discipline: str = Field(..., min_length=1, max_length=150)
    lecturer_name: Optional[str] = Field(None, max_length=150)
    course_text: Optional[str] = Field(None, max_length=50)
    study_year_text: Optional[str] = Field(None, max_length=50)


class PublicationRequestOut(BaseModel):
    id: UUID
    lecture_id: UUID
    lecture_title: str
    requested_by: UUID
    requested_by_login: str
    stream_id: UUID
    stream_name: str
    direction_id: UUID
    direction_name: str
    faculty_id: UUID
    faculty_name: str
    discipline: str
    lecturer_name: Optional[str] = None
    course_text: Optional[str] = None
    study_year_text: Optional[str] = None
    comment: Optional[str] = None
    status: str
    review_comment: Optional[str] = None
    reviewed_by: Optional[UUID] = None
    reviewed_by_login: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime


class MyLecturePublicationStatusOut(BaseModel):
    lecture_id: UUID
    latest_request_status: Optional[str] = None
    latest_request_review_comment: Optional[str] = None


class FacultyCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)


class DirectionCreateIn(BaseModel):
    faculty_id: UUID
    name: str = Field(..., min_length=1, max_length=150)


class StreamCreateIn(BaseModel):
    direction_id: UUID
    name: str = Field(..., min_length=1, max_length=150)
    course: Optional[int] = Field(None, ge=1, le=6)
    study_year_start: Optional[int] = Field(None, ge=2000, le=2100)


class AdminSetGroupHeadIn(BaseModel):
    is_group_head: bool
    stream_id: Optional[UUID] = None


class SaveTextIn(BaseModel):
    text: str


class ApplyFilterOut(BaseModel):
    success: bool
    filtered_text: str


# ==================== Admin ====================

class AdminLectureUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    description: Optional[str] = None
    subject: Optional[str] = Field(None, max_length=100)
    is_public: Optional[bool] = None


class BlockUserRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=300)
    # duration_minutes=None означает бессрочную блокировку
    duration_minutes: Optional[int] = Field(None, gt=0)


class DeleteContentRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=300)


class AdminUserOut(UserOut):
    is_deleted: bool = False
    blocked_reason: Optional[str] = None
    blocked_at: Optional[datetime] = None
    lecture_count: int = 0


class AdminActionOut(BaseModel):
    id: UUID
    admin_id: UUID
    action: str
    target_type: str
    target_id: UUID
    reason: Optional[str] = None
    details: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ==================== Boards ====================

class BoardCreate(BaseModel):
    title: str = Field("Новое полотно", max_length=255)


class BoardUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    data: Optional[str] = None
    is_public: Optional[bool] = None


class BoardShareRequest(BaseModel):
    mode: str = Field("view", pattern="^(view|edit)$")


class BoardOwnerOut(BaseModel):
    id: UUID
    login: str
    full_name: Optional[str] = None
    role: str

    model_config = {"from_attributes": True}


class BoardOut(BaseModel):
    id: UUID
    title: str
    is_public: bool
    share_token: Optional[str] = None
    share_mode: str = "view"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BoardDetailOut(BoardOut):
    data: Optional[str] = None
    owner: Optional[BoardOwnerOut] = None
    can_edit: bool = False


class BoardRecentOut(BoardOut):
    owner: Optional[BoardOwnerOut] = None
    last_opened_at: Optional[datetime] = None
    last_access_mode: str = "view"
