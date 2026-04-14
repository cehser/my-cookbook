"""Add 'pending' to valid user roles.

Revision ID: 006_add_pending_role
Revises: 005_normalize_recipe_data
Create Date: 2026-04-14
"""

from alembic import op

revision = "006_add_pending_role"
down_revision = "005_normalize_recipe_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_app_users_valid_role", "app_users", type_="check")
    op.create_check_constraint(
        "ck_app_users_valid_role",
        "app_users",
        "role IN ('pending', 'readonly', 'editor', 'admin')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_app_users_valid_role", "app_users", type_="check")
    op.create_check_constraint(
        "ck_app_users_valid_role",
        "app_users",
        "role IN ('readonly', 'editor', 'admin')",
    )
