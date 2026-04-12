"""Add board sharing modes and recent board history.

Revision ID: 009
Revises: 008
Create Date: 2026-04-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "boards",
        sa.Column("share_mode", sa.String(length=10), nullable=False, server_default=sa.text("'view'")),
    )

    op.create_table(
        "board_visits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("board_id", UUID(as_uuid=True), sa.ForeignKey("boards.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("last_access_mode", sa.String(length=10), nullable=False, server_default=sa.text("'view'")),
        sa.Column("last_opened_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("board_id", "user_id", name="uq_board_visit_board_user"),
    )
    op.create_index("ix_board_visits_board_id", "board_visits", ["board_id"])
    op.create_index("ix_board_visits_user_id", "board_visits", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_board_visits_user_id", table_name="board_visits")
    op.drop_index("ix_board_visits_board_id", table_name="board_visits")
    op.drop_table("board_visits")
    op.drop_column("boards", "share_mode")
