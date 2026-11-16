"""Bilddateien: Verarbeitung (WebP + Thumbnail), Ablage, Download und Löschen.

Ablage je Rezept unter ``UPLOAD_DIR/<recipe_id>/``: ``originals/<image_id>.<ext>`` (Original),
``originals/<image_id>.webp`` (optimiert) und ``thumbnails/<image_id>.webp``. In der DB stehen
die Pfade von WebP und Thumbnail relativ zu ``UPLOAD_DIR``.
"""

from __future__ import annotations

import logging
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

import httpx
from PIL import Image as PILImage
from PIL import ImageOps
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.image import IMAGE_KIND_PHOTO, ImageKind, RecipeImage

log = logging.getLogger(__name__)

UPLOAD_DIR = Path(settings.upload_dir)
MAX_BYTES = settings.max_upload_size_mb * 1024 * 1024
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MIME_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

# Thumbnail / optimised sizes
THUMB_SIZE = (400, 400)
OPTIMISED_MAX = 1200


def upload_path(rel_path: str) -> Path:
    """Absoluter Pfad zu einem in der DB gespeicherten (relativen) Dateipfad."""
    return UPLOAD_DIR / rel_path


def process_image(src_path: Path, thumb_path: Path, optimised_path: Path) -> None:
    """Generate thumbnail (400px WebP) and optimised version (1200px WebP)."""
    with PILImage.open(src_path) as img:
        # EXIF-Ausrichtung anwenden, sonst liegen Hochformatfotos von Handys quer
        img = ImageOps.exif_transpose(img).convert("RGB")

        # Thumbnail
        thumb = img.copy()
        thumb.thumbnail(THUMB_SIZE, PILImage.Resampling.LANCZOS)
        thumb.save(thumb_path, "WEBP", quality=80)

        # Optimised (max 1200px on longest side)
        if max(img.size) > OPTIMISED_MAX:
            img.thumbnail((OPTIMISED_MAX, OPTIMISED_MAX), PILImage.Resampling.LANCZOS)
        img.save(optimised_path, "WEBP", quality=85)


@dataclass(frozen=True)
class StoredImage:
    """Abgelegte Dateien eines Bildes; Pfade relativ zu ``UPLOAD_DIR`` für die DB."""

    image_id: uuid.UUID
    base_name: str
    file_path: str
    thumbnail_path: str


def store_image_files(recipe_id: uuid.UUID, content: bytes, ext: str) -> StoredImage:
    """Original speichern und WebP-Fassungen erzeugen.

    Scheitert die Verarbeitung, werden die Dateien entfernt und der Fehler weitergereicht.
    """
    image_id = uuid.uuid4()
    base_name = f"{image_id}{ext}"

    base = UPLOAD_DIR / str(recipe_id)
    originals_dir = base / "originals"
    thumbs_dir = base / "thumbnails"
    originals_dir.mkdir(parents=True, exist_ok=True)
    thumbs_dir.mkdir(parents=True, exist_ok=True)

    original_path = originals_dir / base_name
    original_path.write_bytes(content)

    webp_name = f"{image_id}.webp"
    thumb_path = thumbs_dir / webp_name
    optimised_path = originals_dir / webp_name

    try:
        process_image(original_path, thumb_path, optimised_path)
    except Exception:
        for path in (original_path, thumb_path, optimised_path):
            _unlink(path)
        raise

    return StoredImage(
        image_id=image_id,
        base_name=base_name,
        file_path=str(optimised_path.relative_to(UPLOAD_DIR)),
        thumbnail_path=str(thumb_path.relative_to(UPLOAD_DIR)),
    )


async def next_sort_order(recipe_id: uuid.UUID, kind: ImageKind, db: AsyncSession) -> int:
    """Nächste ``sort_order`` je Rezept und Bildart (Vorlagen verschieben keine Fotos)."""
    result = await db.execute(
        select(func.coalesce(func.max(RecipeImage.sort_order), -1)).where(
            RecipeImage.recipe_id == recipe_id, RecipeImage.kind == kind
        )
    )
    return result.scalar() + 1


async def download_and_store_image(
    url: str,
    recipe_id: uuid.UUID,
    db: AsyncSession,
    uploaded_by: uuid.UUID | None = None,
) -> RecipeImage | None:
    """Download an image from a URL, process it, and store in the DB.

    Returns the RecipeImage row on success, None on failure (non-fatal).
    """
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except Exception as e:
        log.warning("Image download failed for %s: %s", url, e)
        return None

    content = resp.content
    if len(content) > MAX_BYTES:
        log.warning("Downloaded image too large (%d bytes) for %s", len(content), url)
        return None

    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
    if content_type not in ALLOWED_MIME:
        log.warning("Unsupported MIME %s for %s", content_type, url)
        return None

    try:
        stored = store_image_files(recipe_id, content, MIME_EXTENSIONS[content_type])
    except Exception as e:
        log.warning("Image processing failed for %s: %s", url, e)
        return None

    db_image = RecipeImage(
        id=stored.image_id,
        recipe_id=recipe_id,
        filename=stored.base_name,
        mime_type="image/webp",
        file_path=stored.file_path,
        thumbnail_path=stored.thumbnail_path,
        file_size=len(content),
        sort_order=await next_sort_order(recipe_id, IMAGE_KIND_PHOTO, db),
        kind=IMAGE_KIND_PHOTO,
        uploaded_by=uploaded_by,
    )
    db.add(db_image)
    await db.flush()
    return db_image


# ---------------------------------------------------------------------------
# Löschen: Fehler werden geloggt, nicht geworfen (die DB-Zeilen sind dann schon weg)
# ---------------------------------------------------------------------------


def _unlink(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError as e:
        log.warning("Bilddatei nicht gelöscht: %s (%s)", path, e)


def delete_image_files(img: RecipeImage) -> None:
    """Optimiertes Bild, Thumbnail und Original eines Bildes von der Platte löschen."""
    for rel_path in (img.file_path, img.thumbnail_path):
        if rel_path:
            _unlink(UPLOAD_DIR / rel_path)
    originals_dir = UPLOAD_DIR / str(img.recipe_id) / "originals"
    if originals_dir.is_dir():
        for f in originals_dir.glob(f"{img.id}.*"):
            _unlink(f)


def delete_recipe_files(recipe_id: uuid.UUID) -> None:
    """Alle Bilddateien eines Rezepts löschen (nach dem Löschen der DB-Zeilen)."""

    def _log_error(_func: object, path: str, exc: BaseException) -> None:
        if not isinstance(exc, FileNotFoundError):
            log.warning("Bilddatei nicht gelöscht: %s (%s)", path, exc)

    recipe_dir = UPLOAD_DIR / str(recipe_id)
    if recipe_dir.exists():
        shutil.rmtree(recipe_dir, onexc=_log_error)
