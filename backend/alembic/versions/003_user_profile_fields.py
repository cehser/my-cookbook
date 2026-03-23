"""add email, given_name, family_name to app_users

Revision ID: 003_user_profile_fields
Revises: 002_user_settings
Create Date: 2026-03-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_user_profile_fields"
down_revision: Union[str, None] = "002_user_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("app_users", sa.Column("email", sa.Text(), nullable=True))
    op.add_column("app_users", sa.Column("given_name", sa.Text(), nullable=True))
    op.add_column("app_users", sa.Column("family_name", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("app_users", "family_name")
    op.drop_column("app_users", "given_name")
    op.drop_column("app_users", "email")
