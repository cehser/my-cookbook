"""Alembic-Migrationen gegen ein leeres PostgreSQL."""

import asyncio

from alembic import command
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings

from .conftest import alembic_config, reset_schema

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
