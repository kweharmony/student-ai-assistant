"""Add catalog domain and group head privileges.

Revision ID: 010
Revises: 009
Create Date: 2026-04-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    publication_request_status = sa.Enum(
        "pending", "approved", "rejected",
        name="publication_request_status",
        native_enum=False,
    )
    publication_request_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "faculties",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "directions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("faculty_id", UUID(as_uuid=True), sa.ForeignKey("faculties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("faculty_id", "name", name="uq_direction_faculty_name"),
    )
    op.create_index("ix_directions_faculty_id", "directions", ["faculty_id"])

    op.create_table(
        "streams",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("direction_id", UUID(as_uuid=True), sa.ForeignKey("directions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("course", sa.SmallInteger(), nullable=True),
        sa.Column("study_year_start", sa.SmallInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("direction_id", "name", "study_year_start", name="uq_stream_direction_name_year"),
    )
    op.create_index("ix_streams_direction_id", "streams", ["direction_id"])

    op.add_column("users", sa.Column("is_group_head", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("stream_id", UUID(as_uuid=True), sa.ForeignKey("streams.id"), nullable=True))
    op.create_index("ix_users_is_group_head", "users", ["is_group_head"])
    op.create_index("ix_users_stream_id", "users", ["stream_id"])

    op.create_table(
        "lecture_publication_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lecture_id", UUID(as_uuid=True), sa.ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("stream_id", UUID(as_uuid=True), sa.ForeignKey("streams.id"), nullable=False),
        sa.Column("discipline", sa.String(150), nullable=False),
        sa.Column("lecturer_name", sa.String(150), nullable=True),
        sa.Column("course_text", sa.String(50), nullable=True),
        sa.Column("study_year_text", sa.String(50), nullable=True),
        sa.Column("comment", sa.String(500), nullable=True),
        sa.Column("status", publication_request_status, nullable=False, server_default="pending"),
        sa.Column("review_comment", sa.String(500), nullable=True),
        sa.Column("reviewed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_lecture_publication_requests_lecture_id", "lecture_publication_requests", ["lecture_id"])
    op.create_index("ix_lecture_publication_requests_requested_by", "lecture_publication_requests", ["requested_by"])
    op.create_index("ix_lecture_publication_requests_stream_id", "lecture_publication_requests", ["stream_id"])
    op.create_index("ix_lecture_publication_requests_status", "lecture_publication_requests", ["status"])

    op.create_table(
        "lecture_catalog_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lecture_id", UUID(as_uuid=True), sa.ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("stream_id", UUID(as_uuid=True), sa.ForeignKey("streams.id"), nullable=False),
        sa.Column("discipline", sa.String(150), nullable=False),
        sa.Column("lecturer_name", sa.String(150), nullable=True),
        sa.Column("course_text", sa.String(50), nullable=True),
        sa.Column("study_year_text", sa.String(50), nullable=True),
        sa.Column("published_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("source_request_id", UUID(as_uuid=True), sa.ForeignKey("lecture_publication_requests.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_lecture_catalog_items_lecture_id", "lecture_catalog_items", ["lecture_id"])
    op.create_index("ix_lecture_catalog_items_stream_id", "lecture_catalog_items", ["stream_id"])
    op.create_index("ix_lecture_catalog_items_discipline", "lecture_catalog_items", ["discipline"])
    op.create_index("ix_lecture_catalog_items_lecturer_name", "lecture_catalog_items", ["lecturer_name"])
    op.create_index("ix_lecture_catalog_items_course_text", "lecture_catalog_items", ["course_text"])
    op.create_index("ix_lecture_catalog_items_study_year_text", "lecture_catalog_items", ["study_year_text"])
    op.create_index("ix_lecture_catalog_items_published_by", "lecture_catalog_items", ["published_by"])


def downgrade() -> None:
    op.drop_index("ix_lecture_catalog_items_published_by", table_name="lecture_catalog_items")
    op.drop_index("ix_lecture_catalog_items_study_year_text", table_name="lecture_catalog_items")
    op.drop_index("ix_lecture_catalog_items_course_text", table_name="lecture_catalog_items")
    op.drop_index("ix_lecture_catalog_items_lecturer_name", table_name="lecture_catalog_items")
    op.drop_index("ix_lecture_catalog_items_discipline", table_name="lecture_catalog_items")
    op.drop_index("ix_lecture_catalog_items_stream_id", table_name="lecture_catalog_items")
    op.drop_index("ix_lecture_catalog_items_lecture_id", table_name="lecture_catalog_items")
    op.drop_table("lecture_catalog_items")

    op.drop_index("ix_lecture_publication_requests_status", table_name="lecture_publication_requests")
    op.drop_index("ix_lecture_publication_requests_stream_id", table_name="lecture_publication_requests")
    op.drop_index("ix_lecture_publication_requests_requested_by", table_name="lecture_publication_requests")
    op.drop_index("ix_lecture_publication_requests_lecture_id", table_name="lecture_publication_requests")
    op.drop_table("lecture_publication_requests")

    op.drop_index("ix_users_stream_id", table_name="users")
    op.drop_index("ix_users_is_group_head", table_name="users")
    op.drop_column("users", "stream_id")
    op.drop_column("users", "is_group_head")

    op.drop_index("ix_streams_direction_id", table_name="streams")
    op.drop_table("streams")

    op.drop_index("ix_directions_faculty_id", table_name="directions")
    op.drop_table("directions")
    op.drop_table("faculties")

    publication_request_status = sa.Enum(name="publication_request_status")
    publication_request_status.drop(op.get_bind(), checkfirst=True)
