"""Initial schema — all 7 tables.

Revision ID: 001
Revises:
Create Date: 2026-03-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Enum types
user_role = sa.Enum("student", "teacher", "admin", name="user_role")
lecture_status = sa.Enum("processing", "ready", "error", name="lecture_status")


def upgrade() -> None:
    # -- 1. users --
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("login", sa.String(50), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("full_name", sa.String(100), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("blocked_reason", sa.String(300), nullable=True),
        sa.Column("blocked_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("blocked_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("last_login_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_users_login", "users", ["login"])
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_is_deleted", "users", ["is_deleted"])

    # -- 2. student_profiles --
    op.create_table(
        "student_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("group_name", sa.String(20), nullable=True),
        sa.Column("course", sa.SmallInteger, nullable=True),
        sa.Column("faculty", sa.String(100), nullable=True),
    )

    # -- 3. teacher_profiles --
    op.create_table(
        "teacher_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("department", sa.String(150), nullable=True),
        sa.Column("position", sa.String(100), nullable=True),
        sa.Column("academic_degree", sa.String(100), nullable=True),
    )

    # -- 4. lectures --
    op.create_table(
        "lectures",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("subject", sa.String(100), nullable=True),
        sa.Column("uploaded_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", lecture_status, server_default="processing", nullable=False),
        sa.Column("is_public", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
        sa.Column("delete_reason", sa.String(300), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_lectures_uploaded_by", "lectures", ["uploaded_by"])
    op.create_index("ix_lectures_is_deleted", "lectures", ["is_deleted"])

    # -- 5. audio_files --
    op.create_table(
        "audio_files",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lecture_id", UUID(as_uuid=True), sa.ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_size", sa.BigInteger, nullable=True),
        sa.Column("duration_seconds", sa.Integer, nullable=True),
        sa.Column("mime_type", sa.String(50), nullable=True),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_audio_files_lecture_id", "audio_files", ["lecture_id"])

    # -- 6. transcriptions --
    op.create_table(
        "transcriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lecture_id", UUID(as_uuid=True), sa.ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False),
        sa.Column("audio_file_id", UUID(as_uuid=True), sa.ForeignKey("audio_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("raw_text", sa.Text, nullable=False),
        sa.Column("processed_text", sa.Text, nullable=True),
        sa.Column("whisper_model", sa.String(20), nullable=True),
        sa.Column("language", sa.String(10), nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("processing_time", sa.Float, nullable=True),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_transcriptions_lecture_id", "transcriptions", ["lecture_id"])

    # -- 7. admin_actions --
    op.create_table(
        "admin_actions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("admin_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.String(300), nullable=True),
        sa.Column("details", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_admin_actions_admin_id", "admin_actions", ["admin_id"])


def downgrade() -> None:
    op.drop_table("admin_actions")
    op.drop_table("transcriptions")
    op.drop_table("audio_files")
    op.drop_table("lectures")
    op.drop_table("teacher_profiles")
    op.drop_table("student_profiles")
    op.drop_table("users")
    user_role.drop(op.get_bind(), checkfirst=True)
    lecture_status.drop(op.get_bind(), checkfirst=True)
