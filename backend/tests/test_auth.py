"""Auth: 401 ohne Token, 403 je Rollenstufe.

``get_current_user`` wird immer überschrieben (legt sonst User in der DB an),
``get_db`` durch eine ``FakeSession`` ersetzt.
"""

import uuid

import httpx
import pytest
from fastapi import HTTPException

from app.auth.dependencies import require_admin, require_editor, require_readonly
from tests.conftest import ROLES, make_user

pytestmark = pytest.mark.anyio

SOME_ID = str(uuid.uuid4())

# Je Stufe eine Route ohne Request-Body, dazu die niedrigste erlaubte Rolle.
STAGE_ROUTES = [
    ("GET", "/api/v1/recipes", "readonly"),
    ("DELETE", f"/api/v1/shares/{SOME_ID}", "editor"),
    ("GET", "/api/v1/admin/users", "admin"),
]

PROTECTED_ROUTES = [("GET", "/api/v1/me")] + [(m, p) for m, p, _ in STAGE_ROUTES]


def _below(min_role: str) -> list[str]:
    return list(ROLES[: ROLES.index(min_role)])


@pytest.mark.parametrize(("method", "path"), PROTECTED_ROUTES)
async def test_without_token_401(
    client: httpx.AsyncClient, override_db, method: str, path: str
) -> None:
    response = await client.request(method, path)
    assert response.status_code == 401
    assert override_db.executed == []


@pytest.mark.parametrize(
    ("method", "path", "role"),
    [(m, p, role) for m, p, min_role in STAGE_ROUTES for role in _below(min_role)],
)
async def test_insufficient_role_403(
    client: httpx.AsyncClient, as_role, method: str, path: str, role: str
) -> None:
    as_role(role)
    response = await client.request(method, path)
    assert response.status_code == 403


@pytest.mark.parametrize("role", ROLES)
async def test_me_allowed_for_every_role(client: httpx.AsyncClient, as_role, role: str) -> None:
    user = as_role(role)
    response = await client.get("/api/v1/me")
    assert response.status_code == 200
    assert response.json()["role"] == role
    assert response.json()["display_name"] == user.display_name


@pytest.mark.parametrize(
    ("dependency", "min_role"),
    [(require_readonly, "readonly"), (require_editor, "editor"), (require_admin, "admin")],
)
@pytest.mark.parametrize("role", ROLES)
async def test_role_dependency_matrix(dependency, min_role: str, role: str) -> None:
    user = make_user(role)
    if ROLES.index(role) >= ROLES.index(min_role):
        assert await dependency(user) is user
    else:
        with pytest.raises(HTTPException) as exc:
            await dependency(user)
        assert exc.value.status_code == 403
