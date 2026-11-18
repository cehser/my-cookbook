"""Gesamtexport aller Rezepte als ZIP (Format ``my-cookbook-export``, Version 1).

Aufbau, beschrieben in ``docs/plans/export-import.md``:

- ``manifest.json``: Format, Version, Zeitpunkt, App-Commit, Anzahlen, fehlende Bilddateien
- ``recipes/<recipe_id>.json``: Rezept mit Tags und Bildliste (``file`` = Pfad im ZIP)
- ``images/<image_id>.<ext>``: Original, sonst die optimierte WebP-Fassung; keine Thumbnails

Pfade im ZIP entstehen nur aus IDs, nie aus ``filename`` oder ``recipe_name``. Das ZIP wird
in eine temporäre Datei außerhalb von ``UPLOAD_DIR`` geschrieben (``zipfile`` braucht ``seek``);
der Aufrufer löscht sie nach dem Ausliefern.
"""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import uuid
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.models.image import RecipeImage
from app.models.recipe import Recipe
from app.models.tag import RecipeTag, Tag
from app.services import images as image_service

log = logging.getLogger(__name__)

EXPORT_FORMAT = "my-cookbook-export"
EXPORT_VERSION = 1

# Die Endung des Originals stammt aus dem Dateinamen des Uploads; nur harmlose übernehmen
_SAFE_EXT = re.compile(r"^\.[a-z0-9]{1,10}$")


@dataclass(frozen=True)
class ExportFile:
    """Fertiges ZIP in einer temporären Datei; ``path`` löscht der Aufrufer."""

    path: Path
    filename: str
    manifest: dict[str, Any]


@dataclass
class _ImageEntry:
    row: RecipeImage
    source: Path | None
    arcname: str | None


@dataclass
class _Plan:
    recipes: list[Recipe]
    tags: dict[uuid.UUID, list[str]]
    images: dict[uuid.UUID, list[_ImageEntry]] = field(default_factory=dict)
    missing: list[dict[str, str]] = field(default_factory=list)


def find_image_source(img: RecipeImage) -> Path | None:
    """Original eines Bildes, sonst die optimierte WebP-Fassung, sonst ``None``.

    Das Original liegt als ``originals/<id>.<ext>`` neben ``originals/<id>.webp``; die DB kennt
    nur den WebP-Pfad, ``mime_type`` ist immer ``image/webp``. Bei einem WebP-Upload ist das
    Original dieselbe Datei wie die optimierte Fassung (beim Verarbeiten überschrieben).
    """
    originals_dir = image_service.UPLOAD_DIR / str(img.recipe_id) / "originals"
    if originals_dir.is_dir():
        for candidate in sorted(originals_dir.glob(f"{img.id}.*")):
            if candidate.suffix.lower() != ".webp" and candidate.is_file():
                return candidate
    optimised = image_service.upload_path(img.file_path)
    return optimised if optimised.is_file() else None


def _image_arcname(img: RecipeImage, source: Path) -> str:
    ext = source.suffix.lower()
    if not _SAFE_EXT.match(ext):
        ext = ".bin"
    return f"images/{img.id}{ext}"


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _str(value: uuid.UUID | None) -> str | None:
    return str(value) if value else None


def _recipe_document(recipe: Recipe, plan: _Plan) -> dict[str, Any]:
    return {
        "id": str(recipe.id),
        "recipe_name": recipe.recipe_name,
        "data": recipe.data or {},
        "tags": plan.tags.get(recipe.id, []),
        "created_at": _iso(recipe.created_at),
        "updated_at": _iso(recipe.updated_at),
        "created_by": _str(recipe.created_by),
        "updated_by": _str(recipe.updated_by),
        "images": [
            {
                "id": str(e.row.id),
                "kind": e.row.kind,
                "sort_order": e.row.sort_order,
                "filename": e.row.filename,
                "mime_type": e.row.mime_type,
                "file": e.arcname,
            }
            for e in plan.images.get(recipe.id, [])
        ],
    }


async def _load_plan(db: AsyncSession) -> _Plan:
    recipes = list(
        (await db.execute(select(Recipe).order_by(Recipe.created_at, Recipe.id))).scalars()
    )

    tags: dict[uuid.UUID, list[str]] = defaultdict(list)
    tag_rows = await db.execute(
        select(RecipeTag.recipe_id, Tag.name)
        .join(Tag, RecipeTag.tag_id == Tag.id)
        .order_by(RecipeTag.recipe_id, Tag.name)
    )
    for recipe_id, name in tag_rows.all():
        tags[recipe_id].append(name)

    plan = _Plan(recipes=recipes, tags=tags)
    image_rows = await db.execute(
        select(RecipeImage).order_by(
            RecipeImage.recipe_id, RecipeImage.kind, RecipeImage.sort_order, RecipeImage.id
        )
    )
    for img in image_rows.scalars():
        plan.images.setdefault(img.recipe_id, []).append(_ImageEntry(img, None, None))
    return plan


def _resolve_files(plan: _Plan) -> None:
    """Bilddateien suchen; fehlende ins Manifest und ins Log, der Export läuft weiter."""
    for entries in plan.images.values():
        for entry in entries:
            source = find_image_source(entry.row)
            if source is None:
                log.warning(
                    "Export: Bilddatei fehlt (Rezept %s, Bild %s, %s)",
                    entry.row.recipe_id,
                    entry.row.id,
                    entry.row.kind,
                )
                plan.missing.append(
                    {
                        "recipe_id": str(entry.row.recipe_id),
                        "image_id": str(entry.row.id),
                        "kind": entry.row.kind,
                    }
                )
                continue
            entry.source = source
            entry.arcname = _image_arcname(entry.row, source)


def _json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, indent=2).encode("utf-8")


def _write_zip(target: Path, plan: _Plan, manifest: dict[str, Any]) -> None:
    with zipfile.ZipFile(target, "w") as zf:
        zf.writestr("manifest.json", _json_bytes(manifest), compress_type=zipfile.ZIP_DEFLATED)
        for recipe in plan.recipes:
            zf.writestr(
                f"recipes/{recipe.id}.json",
                _json_bytes(_recipe_document(recipe, plan)),
                compress_type=zipfile.ZIP_DEFLATED,
            )
        for entries in plan.images.values():
            for entry in entries:
                if entry.source is not None and entry.arcname is not None:
                    # Bilder sind schon komprimiert: unverändert ablegen
                    zf.write(entry.source, entry.arcname, compress_type=zipfile.ZIP_STORED)


def _build(plan: _Plan, exported_at: datetime) -> ExportFile:
    _resolve_files(plan)
    exported_images = sum(
        1 for entries in plan.images.values() for e in entries if e.source is not None
    )
    manifest: dict[str, Any] = {
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        "exported_at": exported_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "app_commit": settings.commit_hash or "dev",
        "recipe_count": len(plan.recipes),
        "image_count": exported_images,
        "missing_images": plan.missing,
    }

    fd, name = tempfile.mkstemp(prefix="my-cookbook-export-", suffix=".zip")
    os.close(fd)
    path = Path(name)
    try:
        _write_zip(path, plan, manifest)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    return ExportFile(
        path=path,
        filename=f"my-cookbook-export-{exported_at:%Y-%m-%d}.zip",
        manifest=manifest,
    )


async def create_export(db: AsyncSession) -> ExportFile:
    """Rezepte laden und das ZIP im Threadpool schreiben (Datei-I/O blockiert sonst die Loop)."""
    plan = await _load_plan(db)
    return await run_in_threadpool(_build, plan, datetime.now(UTC))
