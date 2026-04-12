"""Add semester field for catalog/request hierarchy.

Revision ID: 013
Revises: 012
Create Date: 2026-04-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lecture_publication_requests", sa.Column("semester_text", sa.String(length=20), nullable=True))
    op.add_column("lecture_catalog_items", sa.Column("semester_text", sa.String(length=20), nullable=True))
    op.create_index("ix_lecture_catalog_items_semester_text", "lecture_catalog_items", ["semester_text"])


def downgrade() -> None:
    op.drop_index("ix_lecture_catalog_items_semester_text", table_name="lecture_catalog_items")
    op.drop_column("lecture_catalog_items", "semester_text")
    op.drop_column("lecture_publication_requests", "semester_text")
