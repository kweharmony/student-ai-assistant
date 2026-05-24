"""Add can_choose_role flag to users.

Existing non-admin accounts get can_choose_role=True so they can pick
their role once after the deploy. New accounts default to False.

Revision ID: 020
Revises: 019
Create Date: 2026-05-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '020'
down_revision: Union[str, None] = '019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('can_choose_role', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # Grant one-time role selection to every pre-existing non-admin account.
    op.execute(
        "UPDATE users SET can_choose_role = TRUE "
        "WHERE role != 'admin' AND is_deleted = FALSE"
    )


def downgrade() -> None:
    op.drop_column('users', 'can_choose_role')
