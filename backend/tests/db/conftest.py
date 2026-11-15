"""Fixtures für die DB-Tests (Marker ``db``) gegen ein echtes PostgreSQL.

Die Tests laufen nur, wenn ``DB_HOST`` gesetzt ist und ``DB_NAME`` mit ``test`` beginnt: Sie
fahren die Migrationen bis ``base`` zurück und löschen dabei alle Tabellen. Sonst werden sie
übersprungen, ``pytest`` ohne DB bleibt grün.

``DB_*`` müssen schon vor dem Start von pytest gesetzt sein, weil ``app.database`` die Engine
beim Import aus den Settings baut. Lokal z. B.::

    docker run -d --name cookbook-test-db -p 5432:5432 -e POSTGRES_DB=test_cookbook \\
        -e POSTGRES_USER=cookbook -e POSTGRES_PASSWORD=test postgres:16-alpine
    DB_HOST=localhost DB_NAME=test_cookbook DB_USER=cookbook DB_PASSWORD=test uv run pytest -m db
"""

import asyncio
import os
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from pathlib import Path

import httpx
import pytest
from alembic import command
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import get_db
from app.main import app
from app.models.user import AppUser
from tests.alembic_helpers import alembic_config

DB_DIR = Path(__file__).resolve().parent


def _db_configured() -> bool:
    return bool(os.environ.get("DB_HOST")) and settings.db_name.startswith("test")


def _is_db_test(item: pytest.Item) -> bool:
    return Path(str(item.fspath)).is_relative_to(DB_DIR)


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    # In der CI (GitHub setzt CI=true) ist Überspringen ein Fehler: sonst bliebe eine
    # falsch konfigurierte DB unbemerkt grün
    deselected = "not db" in (config.option.markexpr or "")
    if os.environ.get("CI") and not deselected and not _db_configured():
        if any(_is_db_test(i) for i in items):
            raise pytest.UsageError("CI: DB-Tests ohne DB_HOST/DB_NAME=test… nicht überspringbar")
    skip = pytest.mark.skip(reason="DB_HOST gesetzt und DB_NAME mit 'test' beginnend erforderlich")
    for item in items:
        if _is_db_test(item):
            item.add_marker(pytest.mark.db)
            if not _db_configured():
                item.add_marker(skip)


def reset_schema() -> None:
    """Schema ``public`` leeren (die Tests laufen nur gegen eine ``test…``-DB)."""

    async def _run() -> None:
        engine = create_async_engine(settings.database_url, poolclass=NullPool)
        async with engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
        await engine.dispose()

    asyncio.run(_run())


@pytest.fixture(scope="session")
def migrated_db() -> None:
    """Leere Test-DB auf ``head`` bringen (Alembic gezielt, ohne ``lifespan``)."""
    reset_schema()
    command.upgrade(alembic_config(), "head")


@pytest.fixture
async def db_engine():
    # NullPool: jeder Test hat seine eigene Event-Loop, Verbindungen dürfen nicht wandern
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine, migrated_db) -> AsyncIterator[AsyncSession]:
    async with async_sessionmaker(db_engine, expire_on_commit=False)() as session:
        yield session


@pytest.fixture
async def db_client(db_engine, migrated_db) -> AsyncIterator[httpx.AsyncClient]:
    """Client gegen die App mit echter DB; ``get_db`` nutzt die Test-Engine."""
    maker = async_sessionmaker(db_engine, expire_on_commit=False)

    async def _get_db() -> AsyncIterator[AsyncSession]:
        async with maker() as session:
            yield session

    app.dependency_overrides[get_db] = _get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_db_user(db_session: AsyncSession) -> Callable[[str], Awaitable[AppUser]]:
    """Legt einen User mit Rolle in der DB an und macht ihn zum angemeldeten User."""

    async def _set(role: str) -> AppUser:
        user = AppUser(
            oidc_sub=uuid.uuid4(), display_name=f"ci-{role}", email=None, role=role, settings=None
        )
        db_session.add(user)
        await db_session.commit()
        app.dependency_overrides[get_current_user] = lambda: user
        return user

    return _set
