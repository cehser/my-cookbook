"""Alembic-Migrationen gegen ein leeres PostgreSQL."""

import asyncio
import uuid

from alembic import command
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from tests.alembic_helpers import alembic_config

from .conftest import reset_schema

EXPECTED_TABLES = {
    "app_users",
    "recipes",
    "recipe_images",
    "tags",
    "recipe_tags",
    "recipe_shares",
    "favorites",
    "site_settings",
}


def _tables() -> set[str]:
    async def _run() -> set[str]:
        engine = create_async_engine(settings.database_url, poolclass=NullPool)
        async with engine.connect() as conn:
            names = await conn.run_sync(lambda c: set(inspect(c).get_table_names()))
        await engine.dispose()
        return names

    return asyncio.run(_run()) - {"alembic_version"}


def test_upgrade_downgrade_upgrade() -> None:
    cfg = alembic_config()
    # Leere DB: Downgrades können Daten nicht erhalten (z. B. Rolle ``pending``)
    reset_schema()
    assert _tables() == set()

    command.upgrade(cfg, "head")
    assert EXPECTED_TABLES <= _tables()

    command.downgrade(cfg, "base")
    assert _tables() == set()

    command.upgrade(cfg, "head")
    assert EXPECTED_TABLES <= _tables()
    assert _check_constraints("recipe_images") == {"ck_recipe_images_valid_kind"}


def _execute(*statements: str) -> list[tuple]:
    """SQL der Reihe nach in einer Transaktion ausführen, Zeilen der letzten Anweisung."""

    async def _run() -> list[tuple]:
        engine = create_async_engine(settings.database_url, poolclass=NullPool)
        async with engine.begin() as conn:
            for statement in statements:
                result = await conn.execute(text(statement))
            rows = [tuple(r) for r in result] if result.returns_rows else []
        await engine.dispose()
        return rows

    return asyncio.run(_run())


def test_007_sets_kind_photo_on_existing_images() -> None:
    cfg = alembic_config()
    reset_schema()
    command.upgrade(cfg, "006_add_pending_role")

    recipe_id = uuid.uuid4()
    image_ids = sorted(uuid.uuid4() for _ in range(2))
    _execute(
        f"INSERT INTO recipes (id, recipe_name, data) VALUES ('{recipe_id}', 'Alt', '{{}}')",
        *(
            "INSERT INTO recipe_images (id, recipe_id, filename, mime_type, file_path, sort_order)"
            f" VALUES ('{image_id}', '{recipe_id}', 'x.jpg', 'image/webp', 'x.webp', {order})"
            for order, image_id in enumerate(image_ids)
        ),
    )

    command.upgrade(cfg, "007_image_kind")

    rows = _execute("SELECT id, kind FROM recipe_images ORDER BY id")
    assert rows == [(image_id, "photo") for image_id in image_ids]

    # Wie test_upgrade_downgrade_upgrade auf head enden (Session-Fixture migrated_db)
    reset_schema()
    command.upgrade(cfg, "head")


def _check_constraints(table: str) -> set[str]:
    async def _run() -> set[str]:
        engine = create_async_engine(settings.database_url, poolclass=NullPool)
        async with engine.connect() as conn:
            names = await conn.run_sync(
                lambda c: {ck["name"] for ck in inspect(c).get_check_constraints(table)}
            )
        await engine.dispose()
        return names

    return asyncio.run(_run())
