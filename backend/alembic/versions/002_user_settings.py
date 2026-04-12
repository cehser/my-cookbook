"""add user_settings column

Revision ID: 002_user_settings
Revises: 001_initial
Create Date: 2026-03-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002_user_settings"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("app_users", sa.Column("settings", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("app_users", "settings")
