"""Gesamtexport ohne DB: Aufräumen beim Start, Datei verschwindet vor dem Schreiben."""

import json
import tempfile
import uuid
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.models.image import RecipeImage
from app.models.recipe import Recipe
from app.services import export as export_service
from app.services import images as image_service


def test_remove_stale_exports(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    stale = tmp_path / f"{export_service.TEMP_PREFIX}abc123.zip"
    others = [tmp_path / "anderes.zip", tmp_path / f"{export_service.TEMP_PREFIX}x.txt"]
    for path in (stale, *others):
        path.write_bytes(b"x")

    assert export_service.remove_stale_exports() == 1
    assert not stale.exists()
    assert all(p.exists() for p in others)
    assert export_service.remove_stale_exports() == 0


def test_build_uses_temp_prefix(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # Die Aufräumfunktion findet nur, was _build mit dem Präfix anlegt
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    plan = export_service._Plan(recipes=[], tags={})
    export = export_service._build(plan, datetime.now(UTC))
    assert export.path.parent == tmp_path
    assert export.path.name.startswith(export_service.TEMP_PREFIX)
    assert export.path.suffix == ".zip"
    assert export_service.remove_stale_exports() == 1


def test_file_vanishing_before_write_is_reported_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    uploads = tmp_path / "uploads"
    monkeypatch.setattr(image_service, "UPLOAD_DIR", uploads)
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    now = datetime.now(UTC)
    recipe = Recipe(id=uuid.uuid4(), recipe_name="R", data={}, created_at=now, updated_at=now)
    images = []
    for name in ("bleibt", "weg"):
        img = RecipeImage(
            id=uuid.uuid4(),
            recipe_id=recipe.id,
            filename=f"{name}.jpg",
            mime_type="image/webp",
            file_path=f"{recipe.id}/originals/{name}.webp",
            sort_order=len(images),
            kind="photo",
        )
        original = uploads / str(recipe.id) / "originals" / f"{img.id}.jpg"
        original.parent.mkdir(parents=True, exist_ok=True)
        original.write_bytes(name.encode())
        images.append(img)
    keep, gone = images

    real_find = export_service.find_image_source

    def _find_then_delete(img: RecipeImage) -> Path | None:
        # Attrappe: Datei wird gefunden und verschwindet vor zf.write (z. B. paralleles Löschen)
        source = real_find(img)
        if img.id == gone.id and source is not None:
            source.unlink()
        return source

    monkeypatch.setattr(export_service, "find_image_source", _find_then_delete)
    plan = export_service._Plan(recipes=[recipe], tags={})
    plan.images[recipe.id] = [export_service._ImageEntry(i, None, None) for i in images]

    export = export_service._build(plan, now)

    with zipfile.ZipFile(export.path) as zf:
        assert zf.testzip() is None
        names = set(zf.namelist())
        manifest = json.loads(zf.read("manifest.json"))
        doc = json.loads(zf.read(f"recipes/{recipe.id}.json"))
    export.path.unlink()

    assert f"images/{keep.id}.jpg" in names
    assert not any(str(gone.id) in n for n in names)
    assert manifest["image_count"] == 1
    assert manifest["missing_images"] == [
        {"recipe_id": str(recipe.id), "image_id": str(gone.id), "kind": "photo"}
    ]
    files = {i["id"]: i["file"] for i in doc["images"]}
    assert files == {str(keep.id): f"images/{keep.id}.jpg", str(gone.id): None}
