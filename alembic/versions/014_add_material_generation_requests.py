"""Add requests for lecture material generation.

Revision ID: 014
Revises: 013
Create Date: 2026-04-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lecture_material_generation_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("lecture_id", sa.UUID(), nullable=False),
        sa.Column("stream_id", sa.UUID(), nullable=False),
        sa.Column("mode", sa.String(length=50), nullable=False),
        sa.Column("requested_by", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "approved",
                "rejected",
                name="material_generation_request_status",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("review_comment", sa.String(length=500), nullable=True),
        sa.Column("reviewed_by", sa.UUID(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["lecture_id"], ["lectures.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["stream_id"], ["streams.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_lecture_material_generation_requests_lecture_id",
        "lecture_material_generation_requests",
        ["lecture_id"],
    )
    op.create_index(
        "ix_lecture_material_generation_requests_stream_id",
        "lecture_material_generation_requests",
        ["stream_id"],
    )
    op.create_index(
        "ix_lecture_material_generation_requests_mode",
        "lecture_material_generation_requests",
        ["mode"],
    )
    op.create_index(
        "ix_lecture_material_generation_requests_requested_by",
        "lecture_material_generation_requests",
        ["requested_by"],
    )
    op.create_index(
        "ix_lecture_material_generation_requests_status",
        "lecture_material_generation_requests",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_lecture_material_generation_requests_status", table_name="lecture_material_generation_requests")
    op.drop_index("ix_lecture_material_generation_requests_requested_by", table_name="lecture_material_generation_requests")
    op.drop_index("ix_lecture_material_generation_requests_mode", table_name="lecture_material_generation_requests")
    op.drop_index("ix_lecture_material_generation_requests_stream_id", table_name="lecture_material_generation_requests")
    op.drop_index("ix_lecture_material_generation_requests_lecture_id", table_name="lecture_material_generation_requests")
    op.drop_table("lecture_material_generation_requests")
