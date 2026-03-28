"""Add worker_name and last_heartbeat_at to transcription_tasks.

Revision ID: 003
Revises: 002
Create Date: 2026-03-29
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transcription_tasks", sa.Column("worker_name", sa.String(100), nullable=True))
    op.add_column("transcription_tasks", sa.Column("last_heartbeat_at", sa.DateTime, nullable=True))


def downgrade() -> None:
    op.drop_column("transcription_tasks", "last_heartbeat_at")
    op.drop_column("transcription_tasks", "worker_name")
