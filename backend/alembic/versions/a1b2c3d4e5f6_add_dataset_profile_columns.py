"""Add dataset profile columns

Revision ID: a1b2c3d4e5f6
Revises: fa07d17f079b
Create Date: 2026-08-09

Adds profile_json and profile_version to datasets table.
Existing rows will have NULL (handled by inline fallback in AnalyticsEngine / MLTrainer).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "fa07d17f079b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "datasets",
        sa.Column("profile_json", sa.JSON(), nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("profile_version", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("datasets", "profile_version")
    op.drop_column("datasets", "profile_json")
