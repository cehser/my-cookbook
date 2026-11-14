"""Rezept-API und ``/me`` gegen die echte DB (Rolle über ``get_current_user`` gesetzt)."""

import uuid

import httpx
import pytest
from sqlalchemy import select

from app.auth import dependencies
from app.models.user import AppUser

pytestmark = pytest.mark.anyio


async def test_recipe_lifecycle(db_client: httpx.AsyncClient, as_db_user) -> None:
    await as_db_user("admin")
    tag = f"ci-{uuid.uuid4()}"

    created = await db_client.post(
        "/api/v1/recipes",
        json={"recipe_name": "CI-Testkuchen", "data": {"author": "CI"}, "tags": [tag, "Kuchen"]},
    )
    assert created.status_code == 201
    recipe = created.json()
    assert recipe["tags"] == sorted([tag, "Kuchen"])

    fetched = await db_client.get(f"/api/v1/recipes/{recipe['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["data"]["author"] == "CI"
    assert fetched.json()["data"]["sections"] == [{"section": ""}]

    listed = await db_client.get("/api/v1/recipes", params={"tag": tag})
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["id"] == recipe["id"]

    retagged = await db_client.post(f"/api/v1/recipes/{recipe['id']}/tags", json=["Neu"])
    assert retagged.json() == ["Neu"]

    deleted = await db_client.delete(f"/api/v1/recipes/{recipe['id']}")
    assert deleted.status_code == 204
    assert (await db_client.get(f"/api/v1/recipes/{recipe['id']}")).status_code == 404


async def test_pagination_with_identical_names_is_stable(
    db_client: httpx.AsyncClient, as_db_user
) -> None:
    await as_db_user("admin")
    tag = f"ci-{uuid.uuid4()}"
    ids = []
    for _ in range(5):
        r = await db_client.post(
            "/api/v1/recipes", json={"recipe_name": "Gleicher Name", "tags": [tag]}
        )
        ids.append(r.json()["id"])

    seen: list[str] = []
    for page in (1, 2, 3):
        r = await db_client.get(
            "/api/v1/recipes",
            params={"tag": tag, "sort": "name", "order": "asc", "page": page, "page_size": 2},
        )
        body = r.json()
        assert body["total"] == 5
        seen += [item["id"] for item in body["items"]]

    assert len(seen) == 5
    assert sorted(seen) == sorted(ids)
    assert seen == sorted(seen), "Tie-Breaker Recipe.id aufsteigend"

    for recipe_id in ids:
        await db_client.delete(f"/api/v1/recipes/{recipe_id}")


async def test_readonly_cannot_create(db_client: httpx.AsyncClient, as_db_user) -> None:
    await as_db_user("readonly")
    r = await db_client.post("/api/v1/recipes", json={"recipe_name": "X"})
    assert r.status_code == 403


async def test_me_creates_new_user(
    db_client: httpx.AsyncClient, db_session, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Echtes get_current_user, nur die Token-Prüfung ist ersetzt
    sub = uuid.uuid4()
    monkeypatch.setattr(
        dependencies,
        "verify_oidc_token",
        lambda _token: {"sub": str(sub), "preferred_username": "neu", "email": "neu@example.com"},
    )

    r = await db_client.get("/api/v1/me", headers={"Authorization": "Bearer dummy"})
    assert r.status_code == 200
    assert r.json()["oidc_sub"] == str(sub)
    assert r.json()["role"] == "pending"

    stored = (await db_session.execute(select(AppUser).where(AppUser.oidc_sub == sub))).scalar_one()
    assert stored.display_name == "neu"
    assert stored.email == "neu@example.com"
