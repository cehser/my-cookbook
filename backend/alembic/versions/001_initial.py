"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-03-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # app_users
    op.create_table(
        "app_users",
        sa.Column("oidc_sub", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="readonly"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "role IN ('readonly', 'editor', 'admin')", name="ck_app_users_valid_role"
        ),
    )

    # recipes
    op.create_table(
        "recipes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("recipe_name", sa.Text(), nullable=False),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("app_users.oidc_sub"),
            nullable=True,
        ),
        sa.Column(
            "updated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("app_users.oidc_sub"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True),
    )

    op.create_index("idx_recipes_search", "recipes", ["search_vector"], postgresql_using="gin")
    op.create_index("idx_recipes_name", "recipes", ["recipe_name"])
    op.create_index("idx_recipes_data_gin", "recipes", ["data"], postgresql_using="gin")
    op.create_index(
        "idx_recipes_updated", "recipes", [sa.text("updated_at DESC")]
    )

    # Fulltext search trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION recipes_search_update() RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('german', COALESCE(NEW.recipe_name, '')), 'A') ||
                setweight(to_tsvector('german', COALESCE(NEW.data->>'author', '')), 'B') ||
                setweight(to_tsvector('german', COALESCE(NEW.data->>'notes', '')), 'C');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_recipes_search
            BEFORE INSERT OR UPDATE ON recipes
            FOR EACH ROW EXECUTE FUNCTION recipes_search_update();
    """)

    # recipe_images
    op.create_table(
        "recipe_images",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "recipe_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.Text(), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("thumbnail_path", sa.Text(), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "uploaded_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("app_users.oidc_sub"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index("idx_images_recipe", "recipe_images", ["recipe_id", "sort_order"])

    # favorites
    op.create_table(
        "favorites",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("app_users.oidc_sub", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "recipe_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # tags
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.Text(), nullable=False, unique=True),
    )
    op.create_index("idx_tags_name", "tags", ["name"])

    # recipe_tags
    op.create_table(
        "recipe_tags",
        sa.Column(
            "recipe_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tag_id",
            sa.Integer(),
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    # recipe_shares
    op.create_table(
        "recipe_shares",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "recipe_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.Text(), nullable=False, unique=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("app_users.oidc_sub"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )

    op.create_index(
        "idx_shares_token_active",
        "recipe_shares",
        ["token"],
        unique=True,
        postgresql_where=sa.text("is_active = true"),
    )
    op.create_index("idx_shares_recipe", "recipe_shares", ["recipe_id"])


def downgrade() -> None:
    op.drop_table("recipe_shares")
    op.drop_table("recipe_tags")
    op.drop_table("tags")
    op.drop_table("favorites")
    op.drop_table("recipe_images")
    op.execute("DROP TRIGGER IF EXISTS trg_recipes_search ON recipes")
    op.execute("DROP FUNCTION IF EXISTS recipes_search_update()")
    op.drop_table("recipes")
    op.drop_table("app_users")
