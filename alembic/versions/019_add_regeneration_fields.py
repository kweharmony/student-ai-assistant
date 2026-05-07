"""Add regeneration fields to material generation requests.

Revision ID: 019
Revises: 018
Create Date: 2026-05-07
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '019'
down_revision: Union[str, None] = '018'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'lecture_material_generation_requests',
        sa.Column('is_regeneration', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        'lecture_material_generation_requests',
        sa.Column('regeneration_reason', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('lecture_material_generation_requests', 'regeneration_reason')
    op.drop_column('lecture_material_generation_requests', 'is_regeneration')
