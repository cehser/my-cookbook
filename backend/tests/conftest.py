"""Gemeinsame Fixtures für die Smoke-Tests (ohne Datenbank, ohne Netz).

Die App wird über ``httpx.ASGITransport`` angesprochen. Dabei läuft der
``lifespan`` nicht, also auch keine Alembic-Migration.
"""

import os
import uuid
from collections.abc import AsyncIterator, Callable
from typing import Any

# Pflichtwerte der Settings vor dem App-Import setzen (es gibt keine Code-Defaults).
os.environ.setdefault("OIDC_AUTHORITY", "https://idp.example.com/realms/test")
os.environ.setdefault("OIDC_CLIENT_ID", "test-client")

import httpx  # noqa: E402
import pytest  # noqa: E402

from app.auth.dependencies import get_current_user  # noqa: E402
from app.database import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import AppUser  # noqa: E402

ROLES = ("pending", "readonly", "editor", "admin")


class FakeResult:
    def scalar(self) -> int:
        return 1


class FakeSession:
    """Ersatz für ``AsyncSession``: beantwortet nur ``execute`` mit einem Dummy."""

    def __init__(self) -> None:
        self.executed: list[Any] = []

    async def execute(self, statement: Any, *args: Any, **kwargs: Any) -> FakeResult:
        self.executed.append(statement)
        return FakeResult()


def make_user(role: str) -> AppUser:
    return AppUser(
        oidc_sub=uuid.uuid4(),
        display_name=f"test-{role}",
        email=f"{role}@example.com",
        role=role,
        settings=None,
    )


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def fake_session() -> FakeSession:
    return FakeSession()


@pytest.fixture
def override_db(fake_session: FakeSession) -> AsyncIterator[FakeSession]:
    async def _get_db() -> AsyncIterator[FakeSession]:
        yield fake_session

    app.dependency_overrides[get_db] = _get_db
    yield fake_session
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def as_role(override_db: FakeSession) -> AsyncIterator[Callable[[str], AppUser]]:
    """Setzt den angemeldeten User auf die gegebene Rolle (überschreibt ``get_current_user``)."""

    def _set(role: str) -> AppUser:
        user = make_user(role)
        app.dependency_overrides[get_current_user] = lambda: user
        return user

    yield _set
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
