"""``get_or_create_user``: erster Admin per ``ADMIN_EMAIL`` und Neuanlage ohne Race.

Ohne Datenbank: Eine Fake-Session liefert vorbereitete Zeilen. Das ``ON CONFLICT``
selbst läuft nur gegen PostgreSQL und wird hier nur als SQL geprüft.
"""

import uuid
from typing import Any

import pytest
from sqlalchemy.dialects import postgresql

from app.auth.dependencies import get_or_create_user
from app.config import settings
from app.models.user import AppUser

pytestmark = pytest.mark.anyio

ADMIN = "Admin@Example.com"


class _Result:
    def __init__(self, user: AppUser | None) -> None:
        self._user = user

    def scalar_one_or_none(self) -> AppUser | None:
        return self._user

    def scalar_one(self) -> AppUser:
        assert self._user is not None
        return self._user


class ProvisioningSession:
    """Simuliert die Tabelle ``app_users`` für genau einen User."""

    def __init__(self, existing: AppUser | None = None) -> None:
        self.user = existing
        self.inserts: list[Any] = []
        self.commits = 0

    async def execute(self, statement: Any) -> _Result:
        if statement.is_insert:
            self.inserts.append(statement)
            if self.user is None:
                values = {c.key: v.value for c, v in statement._values.items()}
                self.user = AppUser(**values)
        return _Result(self.user)

    async def commit(self) -> None:
        self.commits += 1

    def __contains__(self, item: object) -> bool:
        return item is self.user


def _payload(sub: uuid.UUID, **claims: Any) -> dict:
    return {"sub": str(sub), "preferred_username": "tester", **claims}


@pytest.fixture
def admin_email(monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setattr(settings, "admin_email", ADMIN)
    return ADMIN


async def test_new_user_is_pending() -> None:
    session = ProvisioningSession()
    user = await get_or_create_user(session, _payload(uuid.uuid4(), email="a@example.com"))
    assert user.role == "pending"
    assert len(session.inserts) == 1


async def test_insert_uses_on_conflict_do_nothing() -> None:
    session = ProvisioningSession()
    await get_or_create_user(session, _payload(uuid.uuid4()))
    sql = str(session.inserts[0].compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT (oidc_sub) DO NOTHING" in sql


async def test_race_loser_reads_existing_row(admin_email: str) -> None:
    """Der Insert läuft ins Leere (Konflikt), die Zeile des Gewinners wird gelesen."""
    sub = uuid.uuid4()
    winner = AppUser(oidc_sub=sub, display_name="tester", role="readonly")

    class Racing(ProvisioningSession):
        def __init__(self) -> None:
            super().__init__(None)
            self._selects = 0

        async def execute(self, statement: Any) -> _Result:
            if statement.is_insert:
                self.inserts.append(statement)
                self.user = winner  # paralleler Request hat bereits angelegt
                return _Result(None)
            self._selects += 1
            return _Result(self.user)

    session = Racing()
    user = await get_or_create_user(session, _payload(sub))
    assert user is winner
    assert user.role == "readonly"


@pytest.mark.parametrize("email", [ADMIN, ADMIN.lower(), ADMIN.upper()])
async def test_admin_email_promotes_new_user(admin_email: str, email: str) -> None:
    session = ProvisioningSession()
    user = await get_or_create_user(
        session, _payload(uuid.uuid4(), email=email, email_verified=True)
    )
    assert user.role == "admin"


@pytest.mark.parametrize("role", ["pending", "readonly", "editor"])
async def test_admin_email_promotes_existing_user(admin_email: str, role: str) -> None:
    sub = uuid.uuid4()
    session = ProvisioningSession(AppUser(oidc_sub=sub, display_name="tester", role=role))
    user = await get_or_create_user(session, _payload(sub, email=ADMIN, email_verified=True))
    assert user.role == "admin"


@pytest.mark.parametrize(
    "claims",
    [
        {"email": ADMIN},  # email_verified fehlt
        {"email": ADMIN, "email_verified": False},
        {"email": ADMIN, "email_verified": "true"},  # kein echtes Boolean
        {"email": "other@example.com", "email_verified": True},
        {"email_verified": True},  # keine E-Mail im Token
    ],
)
async def test_no_promotion_without_verified_match(admin_email: str, claims: dict) -> None:
    session = ProvisioningSession()
    user = await get_or_create_user(session, _payload(uuid.uuid4(), **claims))
    assert user.role == "pending"

    sub = uuid.uuid4()
    session = ProvisioningSession(AppUser(oidc_sub=sub, display_name="tester", role="readonly"))
    user = await get_or_create_user(session, _payload(sub, **claims))
    assert user.role == "readonly"


async def test_no_promotion_without_admin_email_setting(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "admin_email", None)
    session = ProvisioningSession()
    user = await get_or_create_user(
        session, _payload(uuid.uuid4(), email=ADMIN, email_verified=True)
    )
    assert user.role == "pending"


@pytest.mark.parametrize(
    "claims",
    [
        {"email": ADMIN, "email_verified": True},
        {"email": "other@example.com"},
        {},
    ],
)
async def test_existing_admin_is_never_demoted(admin_email: str, claims: dict) -> None:
    sub = uuid.uuid4()
    session = ProvisioningSession(AppUser(oidc_sub=sub, display_name="tester", role="admin"))
    user = await get_or_create_user(session, _payload(sub, **claims))
    assert user.role == "admin"
