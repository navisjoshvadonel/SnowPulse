"""Initial schema — create all base tables

Revision ID: 0000000000
Revises:
Create Date: 2026-08-16

This migration creates the foundational tables that all subsequent ALTER
migrations depend on. It runs first (down_revision = None) and the former
first migration (8def80638f06) is re-chained to depend on this one.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0000000000"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Enable pgvector extension (no-op if already enabled)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # NOTE: Do NOT use index=True or unique=True on Column() defs inside
    # op.create_table() — those flags cause SQLAlchemy to auto-generate an
    # anonymous index, which then conflicts with the explicit named
    # op.create_index() calls below, producing DuplicateTable errors.

    # ── users ────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── datasets ─────────────────────────────────────────────────────────────
    op.create_table(
        "datasets",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_datasets_id", "datasets", ["id"], unique=False)
    op.create_index("ix_datasets_name", "datasets", ["name"], unique=True)
    op.create_index("ix_datasets_owner_id", "datasets", ["owner_id"], unique=False)

    # ── user_dashboards ───────────────────────────────────────────────────────
    op.create_table(
        "user_dashboards",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dataset_id", sa.Integer(), sa.ForeignKey("datasets.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("insight_notes", sa.Text(), nullable=True),
        sa.Column("query_history", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_user_dashboards_id", "user_dashboards", ["id"], unique=False)

    # ── refresh_tokens ───────────────────────────────────────────────────────
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_refresh_tokens_id", "refresh_tokens", ["id"], unique=False)
    op.create_index("ix_refresh_tokens_token", "refresh_tokens", ["token"], unique=True)

    # ── insights ─────────────────────────────────────────────────────────────
    op.create_table(
        "insights",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("dataset_id", sa.Integer(), sa.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_insights_id", "insights", ["id"], unique=False)

    # ── semantic_memory ───────────────────────────────────────────────────────
    # Created as NUMERIC initially; the fa07d17f079b migration converts it to
    # pgvector.Vector(384) — preserve that upgrade chain by using NUMERIC here.
    op.create_table(
        "semantic_memory",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("embedding", sa.Numeric(precision=384), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_semantic_memory_id", "semantic_memory", ["id"], unique=False)


def downgrade() -> None:
    op.drop_table("semantic_memory")
    op.drop_table("insights")
    op.drop_table("refresh_tokens")
    op.drop_table("user_dashboards")
    op.drop_table("datasets")
    op.drop_table("users")
