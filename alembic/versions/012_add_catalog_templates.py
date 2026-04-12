"""Add catalog discipline and lecturer templates.

Revision ID: 012
Revises: 011
Create Date: 2026-04-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "catalog_discipline_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("direction_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["direction_id"], ["directions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("direction_id", "name", name="uq_catalog_discipline_direction_name"),
    )
    op.create_index("ix_catalog_discipline_templates_direction_id", "catalog_discipline_templates", ["direction_id"])
    op.create_index("ix_catalog_discipline_templates_created_by", "catalog_discipline_templates", ["created_by"])

    op.create_table(
        "catalog_lecturer_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stream_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["stream_id"], ["streams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stream_id", "name", name="uq_catalog_lecturer_stream_name"),
    )
    op.create_index("ix_catalog_lecturer_templates_stream_id", "catalog_lecturer_templates", ["stream_id"])
    op.create_index("ix_catalog_lecturer_templates_created_by", "catalog_lecturer_templates", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_catalog_lecturer_templates_created_by", table_name="catalog_lecturer_templates")
    op.drop_index("ix_catalog_lecturer_templates_stream_id", table_name="catalog_lecturer_templates")
    op.drop_table("catalog_lecturer_templates")

    op.drop_index("ix_catalog_discipline_templates_created_by", table_name="catalog_discipline_templates")
    op.drop_index("ix_catalog_discipline_templates_direction_id", table_name="catalog_discipline_templates")
    op.drop_table("catalog_discipline_templates")
