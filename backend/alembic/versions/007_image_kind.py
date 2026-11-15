"""Bildart je Rezeptbild: ``photo`` (Rezeptfoto) oder ``source`` (Vorlage des Imports).

Bestehende Zeilen werden ``photo`` (Server-Default). Der Index ``idx_images_recipe``
(recipe_id, sort_order) bleibt: je Rezept gibt es nur wenige Bilder, der Filter auf ``kind``
läuft über die wenigen Zeilen hinter dem Index.

Revision ID: 007_image_kind
Revises: 006_add_pending_role
Create Date: 2026-11-15
"""

import sqlalchemy as sa
from alembic import op

revision = "007_image_kind"
down_revision = "006_add_pending_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "recipe_images",
        sa.Column("kind", sa.Text(), nullable=False, server_default="photo"),
    )
    # Name nach Namenskonvention: ck_recipe_images_valid_kind
    op.create_check_constraint("valid_kind", "recipe_images", "kind IN ('photo', 'source')")


def downgrade() -> None:
    op.drop_constraint("valid_kind", "recipe_images", type_="check")
    op.drop_column("recipe_images", "kind")
