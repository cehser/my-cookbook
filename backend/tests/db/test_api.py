"""Rezept-API und ``/me`` gegen die echte DB (Rolle über ``get_current_user`` gesetzt)."""

import asyncio
import io
import uuid

import httpx
import pytest
from PIL import Image
from sqlalchemy import select

from app.auth import dependencies
from app.models.image import RecipeImage
from app.models.user import AppUser
from app.routes import recipes
from app.services import images as image_service

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


async def test_create_with_client_id(db_client: httpx.AsyncClient, as_db_user) -> None:
    await as_db_user("admin")
    recipe_id = str(uuid.uuid4())

    created = await db_client.post(
        "/api/v1/recipes",
        json={"id": recipe_id, "recipe_name": "Mit Client-ID", "tags": ["Erst"]},
    )
    assert created.status_code == 201
    assert created.json()["id"] == recipe_id

    # Wiederholung bzw. Kollision: 409, das bestehende Rezept bleibt unverändert
    again = await db_client.post(
        "/api/v1/recipes",
        json={"id": recipe_id, "recipe_name": "Überschrieben?", "tags": ["Zweit"]},
    )
    assert again.status_code == 409
    assert recipe_id in again.json()["detail"]

    stored = (await db_client.get(f"/api/v1/recipes/{recipe_id}")).json()
    assert stored["recipe_name"] == "Mit Client-ID"
    assert stored["tags"] == ["Erst"]
    assert stored["updated_at"] == created.json()["updated_at"]

    assert (await db_client.delete(f"/api/v1/recipes/{recipe_id}")).status_code == 204
    # Kein Grabstein: Nach dem Löschen ist die ID wieder frei
    reused = await db_client.post("/api/v1/recipes", json={"id": recipe_id, "recipe_name": "Neu"})
    assert reused.status_code == 201
    await db_client.delete(f"/api/v1/recipes/{recipe_id}")


async def test_create_with_nil_uuid_is_rejected(db_client: httpx.AsyncClient, as_db_user) -> None:
    await as_db_user("admin")
    nil = str(uuid.UUID(int=0))
    r = await db_client.post("/api/v1/recipes", json={"id": nil, "recipe_name": "Nil"})
    assert r.status_code == 422
    assert (await db_client.get(f"/api/v1/recipes/{nil}")).status_code == 404


async def test_create_with_client_id_concurrently(db_client: httpx.AsyncClient, as_db_user) -> None:
    await as_db_user("admin")
    recipe_id = str(uuid.uuid4())
    body = {"id": recipe_id, "recipe_name": "Parallel"}

    results = await asyncio.gather(
        *(db_client.post("/api/v1/recipes", json=body) for _ in range(3))
    )

    assert sorted(r.status_code for r in results) == [201, 409, 409]
    await db_client.delete(f"/api/v1/recipes/{recipe_id}")


async def test_create_with_existing_client_id_leaves_no_image_files(
    db_client: httpx.AsyncClient, as_db_user, tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Die Kollision fällt beim ersten flush auf, vor dem Download der imageurl
    monkeypatch.setattr(image_service, "UPLOAD_DIR", tmp_path)

    async def _no_download(*_args, **_kwargs):
        raise AssertionError("Download vor der ID-Prüfung")

    monkeypatch.setattr(recipes, "download_and_store_image", _no_download)
    await as_db_user("admin")
    recipe_id = str(uuid.uuid4())
    assert (
        await db_client.post("/api/v1/recipes", json={"id": recipe_id, "recipe_name": "A"})
    ).status_code == 201

    r = await db_client.post(
        "/api/v1/recipes",
        json={
            "id": recipe_id,
            "recipe_name": "B",
            "data": {"imageurl": "https://example.invalid/bild.jpg"},
        },
    )
    assert r.status_code == 409
    assert not list(tmp_path.iterdir())
    await db_client.delete(f"/api/v1/recipes/{recipe_id}")


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


async def test_list_returns_first_image_per_recipe(
    db_client: httpx.AsyncClient, db_session, as_db_user
) -> None:
    await as_db_user("admin")
    tag = f"ci-{uuid.uuid4()}"
    with_images = (
        await db_client.post("/api/v1/recipes", json={"recipe_name": "Mit Bildern", "tags": [tag]})
    ).json()["id"]
    without = (
        await db_client.post("/api/v1/recipes", json={"recipe_name": "Ohne Bild", "tags": [tag]})
    ).json()["id"]

    first, second = uuid.uuid4(), uuid.uuid4()
    for image_id, order in ((second, 1), (first, 0)):  # absichtlich unsortiert eingefügt
        db_session.add(
            RecipeImage(
                id=image_id,
                recipe_id=uuid.UUID(with_images),
                filename="x.jpg",
                mime_type="image/webp",
                file_path=f"{image_id}.webp",
                sort_order=order,
            )
        )
    await db_session.commit()

    items = {
        i["id"]: i
        for i in (await db_client.get("/api/v1/recipes", params={"tag": tag})).json()["items"]
    }
    assert items[with_images]["first_image_id"] == str(first), "niedrigste sort_order gewinnt"
    assert items[without]["first_image_id"] is None

    for recipe_id in (with_images, without):
        await db_client.delete(f"/api/v1/recipes/{recipe_id}")


def _jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (60, 40), (200, 80, 40)).save(buf, "JPEG")
    return buf.getvalue()


async def _upload(client: httpx.AsyncClient, recipe_id: str, kind: str | None) -> httpx.Response:
    return await client.post(
        f"/api/v1/recipes/{recipe_id}/images",
        files={"file": ("seite.jpg", _jpeg(), "image/jpeg")},
        data={"kind": kind} if kind else None,
    )


async def test_source_images_never_become_title_image(
    db_client: httpx.AsyncClient, as_db_user, tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(image_service, "UPLOAD_DIR", tmp_path)
    await as_db_user("admin")
    tag = f"ci-{uuid.uuid4()}"
    recipe_id = (
        await db_client.post("/api/v1/recipes", json={"recipe_name": "Mit Vorlage", "tags": [tag]})
    ).json()["id"]

    # Vorlagen zuerst hochgeladen: dürfen trotzdem kein Titelbild werden
    sources = [await _upload(db_client, recipe_id, "source") for _ in range(2)]
    assert [r.status_code for r in sources] == [201, 201]
    assert [r.json()["kind"] for r in sources] == ["source", "source"]
    assert [r.json()["sort_order"] for r in sources] == [0, 1]
    assert (await db_client.get(f"/api/v1/recipes/{recipe_id}")).json()["first_image_id"] is None

    photo = await _upload(db_client, recipe_id, None)
    assert photo.json()["kind"] == "photo"
    assert photo.json()["sort_order"] == 0, "Vorlagen verschieben die Fotos nicht"
    photo_id = photo.json()["id"]

    detail = (await db_client.get(f"/api/v1/recipes/{recipe_id}")).json()
    assert detail["first_image_id"] == photo_id
    listed = (await db_client.get("/api/v1/recipes", params={"tag": tag})).json()["items"]
    assert listed[0]["first_image_id"] == photo_id

    url = f"/api/v1/recipes/{recipe_id}/images"
    all_images = (await db_client.get(url)).json()
    assert [i["kind"] for i in all_images] == ["photo", "source", "source"]
    only_sources = (await db_client.get(url, params={"kind": "source"})).json()
    assert [i["id"] for i in only_sources] == [r.json()["id"] for r in sources]
    assert (await db_client.get(url, params={"kind": "foo"})).status_code == 422
    assert (await _upload(db_client, recipe_id, "foo")).status_code == 422

    assert (tmp_path / recipe_id).is_dir()
    assert (await db_client.delete(f"/api/v1/recipes/{recipe_id}")).status_code == 204
    assert not (tmp_path / recipe_id).exists(), "Dateien aller Bildarten mitgelöscht"


async def test_delete_source_image_removes_files(
    db_client: httpx.AsyncClient, as_db_user, tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(image_service, "UPLOAD_DIR", tmp_path)
    await as_db_user("admin")
    recipe_id = (await db_client.post("/api/v1/recipes", json={"recipe_name": "X"})).json()["id"]
    image_id = (await _upload(db_client, recipe_id, "source")).json()["id"]
    assert list(tmp_path.rglob(f"{image_id}.*"))

    r = await db_client.delete(f"/api/v1/recipes/{recipe_id}/images/{image_id}")
    assert r.status_code == 204
    assert not list(tmp_path.rglob(f"{image_id}.*"))

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
