"""Add catalog semesters.

Revision ID: 017
Revises: 016
Create Date: 2026-05-07
"""
from typing import Sequence, Union
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "catalog_semesters",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("stream_id", UUID(as_uuid=True), sa.ForeignKey("streams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_text", sa.String(50), nullable=False),
        sa.Column("semester_key", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("stream_id", "course_text", "semester_key", name="uq_catalog_semester_stream_course_key"),
    )
    op.create_index("ix_catalog_semesters_stream_id", "catalog_semesters", ["stream_id"])
    op.create_index("ix_catalog_semesters_course_text", "catalog_semesters", ["course_text"])
    op.create_index("ix_catalog_semesters_semester_key", "catalog_semesters", ["semester_key"])

    bind = op.get_bind()
    rows = bind.execute(sa.text(
        """
        SELECT DISTINCT stream_id, course_text
        FROM lecture_catalog_items
        WHERE course_text IS NOT NULL AND TRIM(course_text) <> ''
        """
    )).fetchall()

    if rows:
        table = sa.table(
            "catalog_semesters",
            sa.column("id", UUID(as_uuid=True)),
            sa.column("stream_id", UUID(as_uuid=True)),
            sa.column("course_text", sa.String(50)),
            sa.column("semester_key", sa.String(10)),
            sa.column("created_at", sa.DateTime()),
        )
        payload = []
        for row in rows:
            for key in ("winter", "spring"):
                payload.append({
                    "id": uuid.uuid4(),
                    "stream_id": row[0],
                    "course_text": row[1],
                    "semester_key": key,
                })
        op.bulk_insert(table, payload)


def downgrade() -> None:
    op.drop_index("ix_catalog_semesters_semester_key", table_name="catalog_semesters")
    op.drop_index("ix_catalog_semesters_course_text", table_name="catalog_semesters")
    op.drop_index("ix_catalog_semesters_stream_id", table_name="catalog_semesters")
    op.drop_table("catalog_semesters")
