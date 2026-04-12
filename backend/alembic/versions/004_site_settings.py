"""add site_settings table

Revision ID: 004_site_settings
Revises: 003_user_profile_fields
Create Date: 2026-03-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "004_site_settings"
down_revision: Union[str, None] = "003_user_profile_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "site_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("data", postgresql.JSONB(), nullable=False, server_default="{}"),
    )
    # Insert the single config row
    op.execute("INSERT INTO site_settings (id, data) VALUES (1, '{\"max_share_days\": 30}')")


def downgrade() -> None:
    op.drop_table("site_settings")
