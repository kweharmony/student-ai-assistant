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
    # Колонки worker_name и last_heartbeat_at уже созданы в миграции 002
    pass


def downgrade() -> None:
    # Ничего не делаем — колонки удалятся при downgrade 002
    pass
