"""Add lecture AI filter requests.

Revision ID: 016
Revises: 015
Create Date: 2026-04-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transcriptions",
        sa.Column("filtered_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "lecture_ai_filter_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("lecture_id", sa.UUID(), nullable=False),
        sa.Column("requested_by", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "approved",
                "rejected",
                "failed",
                name="lecture_ai_filter_request_status",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("review_comment", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.UUID(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("generation_status", sa.String(length=20), nullable=False, server_default="idle"),
        sa.Column("generation_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["lecture_id"], ["lectures.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_lecture_ai_filter_requests_lecture_id",
        "lecture_ai_filter_requests",
        ["lecture_id"],
    )
    op.create_index(
        "ix_lecture_ai_filter_requests_requested_by",
        "lecture_ai_filter_requests",
        ["requested_by"],
    )
    op.create_index(
        "ix_lecture_ai_filter_requests_status",
        "lecture_ai_filter_requests",
        ["status"],
    )
    op.create_index(
        "ix_lecture_ai_filter_requests_generation_status",
        "lecture_ai_filter_requests",
        ["generation_status"],
    )

    op.alter_column(
        "lecture_ai_filter_requests",
        "generation_status",
        server_default=None,
        existing_type=sa.String(length=20),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_lecture_ai_filter_requests_generation_status",
        table_name="lecture_ai_filter_requests",
    )
    op.drop_index(
        "ix_lecture_ai_filter_requests_status",
        table_name="lecture_ai_filter_requests",
    )
    op.drop_index(
        "ix_lecture_ai_filter_requests_requested_by",
        table_name="lecture_ai_filter_requests",
    )
    op.drop_index(
        "ix_lecture_ai_filter_requests_lecture_id",
        table_name="lecture_ai_filter_requests",
    )
    op.drop_table("lecture_ai_filter_requests")
    op.drop_column("transcriptions", "filtered_at")
