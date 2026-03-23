"""Image upload, serving, and management routes."""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from PIL import Image as PILImage
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin, require_editor
from app.config import settings
from app.database import get_db
from app.models.image import RecipeImage
from app.models.recipe import Recipe
from app.models.user import AppUser

log = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["images"])

UPLOAD_DIR = Path(settings.upload_dir)
MAX_BYTES = settings.max_upload_size_mb * 1024 * 1024
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Thumbnail / optimised sizes
THUMB_SIZE = (400, 400)
OPTIMISED_MAX = 1200


def _ensure_dirs(recipe_id: uuid.UUID) -> tuple[Path, Path]:
    """Create upload directories and return (originals_dir, thumbs_dir)."""
    base = UPLOAD_DIR / str(recipe_id)
    originals = base / "originals"
    thumbs = base / "thumbnails"
    originals.mkdir(parents=True, exist_ok=True)
    thumbs.mkdir(parents=True, exist_ok=True)
    return originals, thumbs


def _process_image(src_path: Path, thumb_path: Path, optimised_path: Path) -> None:
    """Generate thumbnail (400px WebP) and optimised version (1200px WebP)."""
    with PILImage.open(src_path) as img:
        img = img.convert("RGB")

        # Thumbnail
        thumb = img.copy()
        thumb.thumbnail(THUMB_SIZE, PILImage.Resampling.LANCZOS)
        thumb.save(thumb_path, "WEBP", quality=80)

        # Optimised (max 1200px on longest side)
        if max(img.size) > OPTIMISED_MAX:
            img.thumbnail((OPTIMISED_MAX, OPTIMISED_MAX), PILImage.Resampling.LANCZOS)
        img.save(optimised_path, "WEBP", quality=85)


async def _get_recipe_or_404(recipe_id: uuid.UUID, db: AsyncSession) -> Recipe:
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")
    return recipe


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

    image_id = uuid.uuid4()
    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    ext = ext_map.get(content_type, ".jpg")
    base_name = f"{image_id}{ext}"

    originals_dir, thumbs_dir = _ensure_dirs(recipe_id)
    original_path = originals_dir / base_name
    original_path.write_bytes(content)

    webp_name = f"{image_id}.webp"
    thumb_path = thumbs_dir / webp_name
    optimised_path = originals_dir / webp_name

    try:
        _process_image(original_path, thumb_path, optimised_path)
    except Exception as e:
        log.warning("Image processing failed for %s: %s", url, e)
        original_path.unlink(missing_ok=True)
        thumb_path.unlink(missing_ok=True)
        optimised_path.unlink(missing_ok=True)
        return None

    # Determine sort_order
    result = await db.execute(
        select(func.coalesce(func.max(RecipeImage.sort_order), -1))
        .where(RecipeImage.recipe_id == recipe_id)
    )
    next_order = result.scalar() + 1

    db_image = RecipeImage(
        id=image_id,
        recipe_id=recipe_id,
        filename=base_name,
        mime_type="image/webp",
        file_path=str(optimised_path.relative_to(UPLOAD_DIR)),
        thumbnail_path=str(thumb_path.relative_to(UPLOAD_DIR)),
        file_size=len(content),
        sort_order=next_order,
        uploaded_by=uploaded_by,
    )
    db.add(db_image)
    await db.flush()
    return db_image


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@router.post(
    "/recipes/{recipe_id}/images",
    status_code=status.HTTP_201_CREATED,
)
async def upload_image(
    recipe_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_editor),
):
    """Upload an image for a recipe. Generates thumbnail + optimised WebP."""
    await _get_recipe_or_404(recipe_id, db)

    # Validate MIME type
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ungültiger Dateityp: {file.content_type}. Erlaubt: {', '.join(ALLOWED_MIME)}",
        )

    # Read file with size limit
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Datei zu groß. Maximum: {settings.max_upload_size_mb} MB",
        )

    # Determine next sort_order
    result = await db.execute(
        select(func.coalesce(func.max(RecipeImage.sort_order), -1))
        .where(RecipeImage.recipe_id == recipe_id)
    )
    next_order = result.scalar() + 1

    # Generate unique filename
    image_id = uuid.uuid4()
    ext = Path(file.filename or "upload.jpg").suffix.lower() or ".jpg"
    base_name = f"{image_id}{ext}"

    originals_dir, thumbs_dir = _ensure_dirs(recipe_id)

    # Save original
    original_path = originals_dir / base_name
    original_path.write_bytes(content)

    # Generate WebP variants
    webp_name = f"{image_id}.webp"
    thumb_path = thumbs_dir / webp_name
    optimised_path = originals_dir / webp_name

    try:
        _process_image(original_path, thumb_path, optimised_path)
    except Exception as e:
        # Clean up on failure
        original_path.unlink(missing_ok=True)
        thumb_path.unlink(missing_ok=True)
        optimised_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Bildverarbeitung fehlgeschlagen: {e}",
        )

    # Store in DB
    db_image = RecipeImage(
        id=image_id,
        recipe_id=recipe_id,
        filename=file.filename or base_name,
        mime_type="image/webp",
        file_path=str(optimised_path.relative_to(UPLOAD_DIR)),
        thumbnail_path=str(thumb_path.relative_to(UPLOAD_DIR)),
        file_size=len(content),
        sort_order=next_order,
        uploaded_by=user.oidc_sub,
    )
    db.add(db_image)
    await db.commit()
    await db.refresh(db_image)

    return {
        "id": str(db_image.id),
        "recipe_id": str(recipe_id),
        "filename": db_image.filename,
        "mime_type": db_image.mime_type,
        "file_size": db_image.file_size,
        "sort_order": db_image.sort_order,
        "created_at": db_image.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# List images for a recipe
# ---------------------------------------------------------------------------

@router.get("/recipes/{recipe_id}/images")
async def list_images(
    recipe_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: AppUser = Depends(get_current_user),
):
    """List all images for a recipe."""
    await _get_recipe_or_404(recipe_id, db)

    result = await db.execute(
        select(RecipeImage)
        .where(RecipeImage.recipe_id == recipe_id)
        .order_by(RecipeImage.sort_order)
    )
    images = result.scalars().all()

    return [
        {
            "id": str(img.id),
            "recipe_id": str(img.recipe_id),
            "filename": img.filename,
            "mime_type": img.mime_type,
            "file_size": img.file_size,
            "sort_order": img.sort_order,
            "created_at": img.created_at.isoformat(),
        }
        for img in images
    ]


# ---------------------------------------------------------------------------
# Serve image file
# ---------------------------------------------------------------------------

@router.get("/images/{image_id}")
async def get_image(
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Serve the optimised image. No auth required for caching."""
    result = await db.execute(
        select(RecipeImage).where(RecipeImage.id == image_id)
    )
    img = result.scalar_one_or_none()
    if img is None:
        raise HTTPException(status_code=404, detail="Bild nicht gefunden")

    file_path = UPLOAD_DIR / img.file_path
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Bilddatei nicht gefunden")

    return FileResponse(
        path=file_path,
        media_type=img.mime_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.get("/images/{image_id}/thumbnail")
async def get_thumbnail(
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Serve the thumbnail variant."""
    result = await db.execute(
        select(RecipeImage).where(RecipeImage.id == image_id)
    )
    img = result.scalar_one_or_none()
    if img is None:
        raise HTTPException(status_code=404, detail="Bild nicht gefunden")

    if not img.thumbnail_path:
        raise HTTPException(status_code=404, detail="Kein Thumbnail vorhanden")

    thumb_path = UPLOAD_DIR / img.thumbnail_path
    if not thumb_path.is_file():
        raise HTTPException(status_code=404, detail="Thumbnail-Datei nicht gefunden")

    return FileResponse(
        path=thumb_path,
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


# ---------------------------------------------------------------------------
# Delete image
# ---------------------------------------------------------------------------

@router.delete(
    "/recipes/{recipe_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_image(
    recipe_id: uuid.UUID,
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: AppUser = Depends(require_editor),
):
    """Delete an image and its files from disk."""
    result = await db.execute(
        select(RecipeImage).where(
            RecipeImage.id == image_id,
            RecipeImage.recipe_id == recipe_id,
        )
    )
    img = result.scalar_one_or_none()
    if img is None:
        raise HTTPException(status_code=404, detail="Bild nicht gefunden")

    # Delete files from disk
    for rel_path in (img.file_path, img.thumbnail_path):
        if rel_path:
            full = UPLOAD_DIR / rel_path
            full.unlink(missing_ok=True)

    # Also remove the original if it exists
    originals_dir = UPLOAD_DIR / str(recipe_id) / "originals"
    for f in originals_dir.glob(f"{image_id}.*"):
        f.unlink(missing_ok=True)

    await db.execute(
        delete(RecipeImage).where(RecipeImage.id == image_id)
    )
    await db.commit()


# ---------------------------------------------------------------------------
# Admin: migrate imageurl → backend storage
# ---------------------------------------------------------------------------

@router.post("/admin/migrate-images")
async def migrate_image_urls(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_admin),
):
    """Download all imageurl references and store them as recipe_images.

    Skips recipes that already have at least one stored image.
    """
    # Find recipes with imageurl in JSONB data but no recipe_images row
    result = await db.execute(
        select(Recipe)
        .where(
            Recipe.data["imageurl"].astext.isnot(None),
            Recipe.data["imageurl"].astext != "",
            Recipe.data["imageurl"].astext != "null",
            ~Recipe.id.in_(
                select(RecipeImage.recipe_id).distinct()
            ),
        )
    )
    recipes = result.scalars().all()

    migrated = 0
    failed = 0
    for recipe in recipes:
        url = (recipe.data or {}).get("imageurl")
        if not url or not isinstance(url, str) or not url.startswith("http"):
            continue

        img = await download_and_store_image(
            url, recipe.id, db, uploaded_by=user.oidc_sub
        )
        if img:
            # Clear imageurl from recipe data since we now have a stored image
            data = dict(recipe.data or {})
            data["imageurl"] = None
            recipe.data = data
            migrated += 1
        else:
            failed += 1

    await db.commit()

    return {
        "total_candidates": len(recipes),
        "migrated": migrated,
        "failed": failed,
    }
