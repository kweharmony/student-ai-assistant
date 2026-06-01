"""Add subscription tier to users + generation_usage quota log.

Adds a per-user subscription tier (free/pro) and a usage-log table that
backs the sliding-30-day quota for personal-lecture generations and
fragment explanations. See api/quota.py for the enforcement logic.

Revision ID: 021
Revises: 020
Create Date: 2026-06-01
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = '021'
down_revision: Union[str, None] = '020'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('subscription_tier', sa.String(length=20), nullable=False, server_default='free'),
    )
    op.add_column(
        'users',
        sa.Column('subscription_expires_at', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'generation_usage',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('lecture_id', UUID(as_uuid=True), nullable=True),
        sa.Column('mode', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['lecture_id'], ['lectures.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_generation_usage_user_kind_created',
        'generation_usage',
        ['user_id', 'kind', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_generation_usage_user_kind_created', table_name='generation_usage')
    op.drop_table('generation_usage')
    op.drop_column('users', 'subscription_expires_at')
    op.drop_column('users', 'subscription_tier')
