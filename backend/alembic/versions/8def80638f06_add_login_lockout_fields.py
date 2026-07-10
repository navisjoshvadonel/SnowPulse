"""add login lockout fields

Revision ID: 8def80638f06
Revises:
Create Date: 2026-07-11

Location: backend/alembic/versions/8def80638f06_add_login_lockout_fields.py
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "8def80638f06"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("locked_until", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_attempts")
