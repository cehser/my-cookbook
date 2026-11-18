"""Gesamtexport ``GET /v1/admin/export`` gegen die echte DB und ein temporäres ``UPLOAD_DIR``."""

import io
import json
import zipfile
from datetime import datetime
from pathlib import Path

import httpx
import pytest
from PIL import Image
from sqlalchemy import text

from app.services import export as export_service
from app.services import images as image_service

pytestmark = pytest.mark.anyio


def _image_bytes(fmt: str) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (60, 40), (40, 120, 200)).save(buf, fmt)
    return buf.getvalue()


async def _upload(
    client: httpx.AsyncClient, recipe_id: str, name: str, content: bytes, mime: str, kind: str
) -> dict:
    r = await client.post(
        f"/api/v1/recipes/{recipe_id}/images",
        files={"file": (name, content, mime)},
        data={"kind": kind},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_export_zip(
    db_client: httpx.AsyncClient, as_db_user, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr(image_service, "UPLOAD_DIR", uploads)
    created_files: list[Path] = []
    original_create = export_service.create_export

    async def _record(db):
        export = await original_create(db)
        created_files.append(export.path)
        return export

    monkeypatch.setattr(export_service, "create_export", _record)
    admin = await as_db_user("admin")

    with_images = (
        await db_client.post(
            "/api/v1/recipes",
            json={"recipe_name": "../Mit Bildern", "data": {"author": "CI"}, "tags": ["B", "A"]},
        )
    ).json()
    plain = (await db_client.post("/api/v1/recipes", json={"recipe_name": "Ohne Bild"})).json()
    rid = with_images["id"]

    jpeg = _image_bytes("JPEG")
    photo = await _upload(db_client, rid, "../../foto.jpg", jpeg, "image/jpeg", "photo")
    webp = _image_bytes("WEBP")
    source = await _upload(db_client, rid, "seite.webp", webp, "image/webp", "source")
    lost = await _upload(db_client, rid, "weg.png", _image_bytes("PNG"), "image/png", "source")
    for f in (uploads / rid).rglob(f"{lost['id']}.*"):
        f.unlink()

    r = await db_client.get("/api/v1/admin/export")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    assert "attachment" in r.headers["content-disposition"]
    assert "my-cookbook-export-" in r.headers["content-disposition"]
    assert created_files and not created_files[0].exists(), "Temporäre Datei gelöscht"
    assert not uploads.joinpath(created_files[0].name).exists()

    zf = zipfile.ZipFile(io.BytesIO(r.content))
    names = set(zf.namelist())
    assert all(".." not in n and not n.startswith("/") for n in names)

    manifest = json.loads(zf.read("manifest.json"))
    assert manifest["format"] == "my-cookbook-export"
    assert manifest["version"] == 1
    assert manifest["exported_at"].endswith("Z")
    assert manifest["app_commit"] == "dev"
    assert manifest["recipe_count"] >= 2
    assert {"recipe_id": rid, "image_id": lost["id"], "kind": "source"} in manifest[
        "missing_images"
    ]

    assert f"recipes/{plain['id']}.json" in names
    doc = json.loads(zf.read(f"recipes/{rid}.json"))
    assert doc["id"] == rid
    assert doc["recipe_name"] == "../Mit Bildern"
    assert doc["data"]["author"] == "CI"
    assert doc["tags"] == ["A", "B"]
    assert doc["created_by"] == str(admin.oidc_sub)
    for key in ("created_at", "updated_at"):
        assert datetime.fromisoformat(doc[key]) == datetime.fromisoformat(with_images[key])
    by_id = {i["id"]: i for i in doc["images"]}
    assert [i["kind"] for i in doc["images"]] == ["photo", "source", "source"]
    assert by_id[photo["id"]]["sort_order"] == 0
    assert by_id[source["id"]]["sort_order"] == 0
    assert by_id[lost["id"]]["sort_order"] == 1
    assert by_id[photo["id"]]["filename"] == "../../foto.jpg"
    assert by_id[lost["id"]]["file"] is None

    # Original unverändert und unkomprimiert, Pfad nur aus der ID
    photo_file = by_id[photo["id"]]["file"]
    assert photo_file == f"images/{photo['id']}.jpg"
    assert zf.read(photo_file) == jpeg
    assert zf.getinfo(photo_file).compress_type == zipfile.ZIP_STORED
    assert zf.getinfo(f"recipes/{rid}.json").compress_type == zipfile.ZIP_DEFLATED
    # WebP-Upload: Original und optimierte Fassung sind dieselbe Datei
    assert by_id[source["id"]]["file"] == f"images/{source['id']}.webp"
    assert by_id[source["id"]]["file"] in names
    assert f"images/{lost['id']}.png" not in names
    assert not any("thumbnail" in n for n in names)

    for recipe_id in (rid, plain["id"]):
        await db_client.delete(f"/api/v1/recipes/{recipe_id}")


async def test_export_falls_back_to_webp(
    db_client: httpx.AsyncClient, as_db_user, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(image_service, "UPLOAD_DIR", tmp_path)
    await as_db_user("admin")
    rid = (await db_client.post("/api/v1/recipes", json={"recipe_name": "Fallback"})).json()["id"]
    image = await _upload(db_client, rid, "f.jpg", _image_bytes("JPEG"), "image/jpeg", "photo")
    (tmp_path / rid / "originals" / f"{image['id']}.jpg").unlink()

    r = await db_client.get("/api/v1/admin/export")
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    doc = json.loads(zf.read(f"recipes/{rid}.json"))
    assert doc["images"][0]["file"] == f"images/{image['id']}.webp"
    assert zf.read(doc["images"][0]["file"]).startswith(b"RIFF")
    await db_client.delete(f"/api/v1/recipes/{rid}")


async def test_export_reads_one_snapshot(db_session) -> None:
    async with export_service.snapshot_session(db_session) as snapshot:
        isolation = (await snapshot.execute(text("SHOW transaction_isolation"))).scalar()
        read_only = (await snapshot.execute(text("SHOW transaction_read_only"))).scalar()
    assert isolation == "repeatable read"
    assert read_only == "on"
