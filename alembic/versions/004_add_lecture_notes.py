"""Add is_ai_filtered to transcriptions and create lecture_notes table.

Revision ID: 004
Revises: 003
Create Date: 2026-03-29
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transcriptions",
        sa.Column("is_ai_filtered", sa.Boolean, nullable=False, server_default="false"),
    )

    op.create_table(
        "lecture_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "lecture_id",
            UUID(as_uuid=True),
            sa.ForeignKey("lectures.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mode", sa.String(50), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.UniqueConstraint("lecture_id", "mode", name="uq_lecture_note_mode"),
    )
    op.create_index("ix_lecture_notes_lecture_id", "lecture_notes", ["lecture_id"])


def downgrade() -> None:
    op.drop_index("ix_lecture_notes_lecture_id", table_name="lecture_notes")
    op.drop_table("lecture_notes")
    op.drop_column("transcriptions", "is_ai_filtered")
