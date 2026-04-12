"""Add lecture number and moderator-owned metadata flow fields.

Revision ID: 011
Revises: 010
Create Date: 2026-04-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lecture_publication_requests", sa.Column("lecture_number_text", sa.String(length=50), nullable=True))
    op.add_column("lecture_catalog_items", sa.Column("lecture_number_text", sa.String(length=50), nullable=True))
    op.create_index("ix_lecture_catalog_items_lecture_number_text", "lecture_catalog_items", ["lecture_number_text"])


def downgrade() -> None:
    op.drop_index("ix_lecture_catalog_items_lecture_number_text", table_name="lecture_catalog_items")
    op.drop_column("lecture_catalog_items", "lecture_number_text")
    op.drop_column("lecture_publication_requests", "lecture_number_text")
