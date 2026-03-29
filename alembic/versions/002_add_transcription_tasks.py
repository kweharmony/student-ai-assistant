"""Add transcription_tasks table.

Revision ID: 002
Revises: 001
Create Date: 2026-03-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    task_status_enum = postgresql.ENUM(
        "pending", "processing", "completed", "error", "failed",
        name="task_status",
        create_type=False,
    )
    task_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "transcription_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "audio_file_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("audio_files.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            task_status_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("worker_id", sa.String(100), nullable=True),
        sa.Column("worker_name", sa.String(100), nullable=True),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("retry_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_heartbeat_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_index("ix_transcription_tasks_audio_file_id", "transcription_tasks", ["audio_file_id"])
    op.create_index("ix_transcription_tasks_status", "transcription_tasks", ["status"])


def downgrade() -> None:
    op.drop_index("ix_transcription_tasks_status", table_name="transcription_tasks")
    op.drop_index("ix_transcription_tasks_audio_file_id", table_name="transcription_tasks")
    op.drop_table("transcription_tasks")

    task_status = postgresql.ENUM(name="task_status")
    task_status.drop(op.get_bind())
