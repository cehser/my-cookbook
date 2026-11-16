"""Löschen von Bilddateien: Fehler werden geloggt, fehlende Dateien sind kein Fehler."""

import logging
import os
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services import images as image_service

LOGGER = image_service.log.name


@pytest.fixture
def upload_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(image_service, "UPLOAD_DIR", tmp_path)
    return tmp_path


@pytest.fixture
def warnings_log(caplog: pytest.LogCaptureFixture):
    with caplog.at_level(logging.WARNING, logger=LOGGER):
        yield caplog


def _image(upload_dir: Path) -> SimpleNamespace:
    recipe_id, image_id = uuid.uuid4(), uuid.uuid4()
    originals = upload_dir / str(recipe_id) / "originals"
    thumbs = upload_dir / str(recipe_id) / "thumbnails"
    originals.mkdir(parents=True)
    thumbs.mkdir(parents=True)
    for path in (originals / f"{image_id}.jpg", originals / f"{image_id}.webp"):
        path.write_bytes(b"x")
    (thumbs / f"{image_id}.webp").write_bytes(b"x")
    return SimpleNamespace(
        id=image_id,
        recipe_id=recipe_id,
        file_path=f"{recipe_id}/originals/{image_id}.webp",
        thumbnail_path=f"{recipe_id}/thumbnails/{image_id}.webp",
    )


def test_delete_image_files_removes_all_variants(upload_dir: Path, warnings_log) -> None:
    img = _image(upload_dir)
    image_service.delete_image_files(img)
    assert not list(upload_dir.rglob(f"{img.id}.*"))
    assert warnings_log.records == []


def test_delete_image_files_missing_files_are_no_error(upload_dir: Path, warnings_log) -> None:
    img = _image(upload_dir)
    for path in upload_dir.rglob(f"{img.id}.*"):
        path.unlink()
    image_service.delete_image_files(img)
    assert warnings_log.records == []


def test_delete_image_files_logs_failure_with_path(
    upload_dir: Path, warnings_log, monkeypatch: pytest.MonkeyPatch
) -> None:
    img = _image(upload_dir)
    real_unlink = Path.unlink

    def _unlink(self: Path, missing_ok: bool = False) -> None:
        if self.name == f"{img.id}.jpg":
            raise PermissionError("gesperrt")
        real_unlink(self, missing_ok=missing_ok)

    monkeypatch.setattr(Path, "unlink", _unlink)
    image_service.delete_image_files(img)

    assert [r.levelno for r in warnings_log.records] == [logging.WARNING]
    assert f"{img.id}.jpg" in warnings_log.text
    assert "gesperrt" in warnings_log.text
    assert not (upload_dir / img.file_path).exists(), "übrige Dateien trotzdem gelöscht"


def test_delete_recipe_files_missing_dir_is_no_error(upload_dir: Path, warnings_log) -> None:
    image_service.delete_recipe_files(uuid.uuid4())
    assert warnings_log.records == []


def test_delete_recipe_files_logs_failure_with_path(
    upload_dir: Path, warnings_log, monkeypatch: pytest.MonkeyPatch
) -> None:
    img = _image(upload_dir)
    # Name nur im Ordner originals vorhanden (.webp gibt es auch als Thumbnail)
    locked = upload_dir / str(img.recipe_id) / "originals" / f"{img.id}.jpg"
    real_unlink = os.unlink

    # rmtree löscht Dateien über os.unlink (Linux: nur Dateiname mit dir_fd);
    # eine gesperrte Datei simulieren, Abgleich daher nur über den Namen
    def _os_unlink(path, *args, **kwargs):
        if Path(path).name == locked.name:
            raise PermissionError("gesperrt")
        return real_unlink(path, *args, **kwargs)

    monkeypatch.setattr(os, "unlink", _os_unlink)
    image_service.delete_recipe_files(img.recipe_id)

    assert warnings_log.records, "Fehler beim Löschen geloggt"
    assert all(r.levelno == logging.WARNING for r in warnings_log.records)
    assert locked.name in warnings_log.text
    assert "gesperrt" in warnings_log.text
    assert not (upload_dir / img.thumbnail_path).exists(), "übrige Dateien trotzdem gelöscht"
