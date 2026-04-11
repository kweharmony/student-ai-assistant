"""Add audio_expires_at to audio_files.

Revision ID: 008
Revises: 007
Create Date: 2026-04-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '008'
down_revision: Union[str, None] = '007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('audio_files', sa.Column('audio_expires_at', sa.DateTime(), nullable=True))
    # Существующие файлы получают 7 дней от момента миграции (не от даты загрузки),
    # чтобы пользователи успели повторно транскрибировать если нужно.
    op.execute(
        "UPDATE audio_files SET audio_expires_at = NOW() + INTERVAL '7 days' "
        "WHERE is_deleted = false AND audio_expires_at IS NULL"
    )


def downgrade() -> None:
    op.drop_column('audio_files', 'audio_expires_at')
