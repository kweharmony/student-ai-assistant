"""Add runtime generation status for material requests.

Revision ID: 015
Revises: 014
Create Date: 2026-04-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lecture_material_generation_requests",
        sa.Column("generation_status", sa.String(length=20), nullable=False, server_default="idle"),
    )
    op.add_column(
        "lecture_material_generation_requests",
        sa.Column("generation_error", sa.String(length=500), nullable=True),
    )
    op.create_index(
        "ix_lecture_material_generation_requests_generation_status",
        "lecture_material_generation_requests",
        ["generation_status"],
    )

    op.execute(
        """
        UPDATE lecture_material_generation_requests
        SET generation_status = CASE
            WHEN status = 'approved' THEN 'completed'
            ELSE 'idle'
        END
        """
    )

    op.alter_column(
        "lecture_material_generation_requests",
        "generation_status",
        server_default=None,
        existing_type=sa.String(length=20),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_lecture_material_generation_requests_generation_status",
        table_name="lecture_material_generation_requests",
    )
    op.drop_column("lecture_material_generation_requests", "generation_error")
    op.drop_column("lecture_material_generation_requests", "generation_status")
