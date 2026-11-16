"""Image upload, listing, serving, and deletion routes.

Dateiablage und Verarbeitung: ``app.services.images``; Admin-Wartung: ``routes/admin_images.py``.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_editor, require_readonly
from app.config import settings
from app.database import get_db
from app.models.image import IMAGE_KIND_PHOTO, ImageKind, RecipeImage
from app.models.recipe import Recipe
from app.models.user import AppUser
from app.services import images as image_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["images"])


def _image_to_dict(img: RecipeImage) -> dict:
    return {
        "id": str(img.id),
        "recipe_id": str(img.recipe_id),
        "filename": img.filename,
        "mime_type": img.mime_type,
        "file_size": img.file_size,
        "sort_order": img.sort_order,
        "kind": img.kind,
        "created_at": img.created_at.isoformat(),
    }


async def _get_recipe_or_404(recipe_id: uuid.UUID, db: AsyncSession) -> Recipe:
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")
    return recipe


async def _get_image_or_404(image_id: uuid.UUID, db: AsyncSession) -> RecipeImage:
    result = await db.execute(select(RecipeImage).where(RecipeImage.id == image_id))
    img = result.scalar_one_or_none()
    if img is None:
        raise HTTPException(status_code=404, detail="Bild nicht gefunden")
    return img


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
    kind: ImageKind = Form(IMAGE_KIND_PHOTO),
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_editor),
):
    """Upload an image for a recipe. Generates thumbnail + optimised WebP.

    ``kind=source`` speichert eine Vorlage des Foto-Imports (nie Titelbild).
    """
    await _get_recipe_or_404(recipe_id, db)

    if file.content_type not in image_service.ALLOWED_MIME:
        allowed = ", ".join(image_service.ALLOWED_MIME)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ungültiger Dateityp: {file.content_type}. Erlaubt: {allowed}",
        )

    content = await file.read()
    if len(content) > image_service.MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Datei zu groß. Maximum: {settings.max_upload_size_mb} MB",
        )

    next_order = await image_service.next_sort_order(recipe_id, kind, db)
    ext = Path(file.filename or "upload.jpg").suffix.lower() or ".jpg"

    try:
        stored = image_service.store_image_files(recipe_id, content, ext)
    except Exception as err:
        log.exception("Image processing failed for recipe %s", recipe_id)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Bildverarbeitung fehlgeschlagen. Bitte ein anderes Format versuchen.",
        ) from err

    db_image = RecipeImage(
        id=stored.image_id,
        recipe_id=recipe_id,
        filename=file.filename or stored.base_name,
        mime_type="image/webp",
        file_path=stored.file_path,
        thumbnail_path=stored.thumbnail_path,
        file_size=len(content),
        sort_order=next_order,
        kind=kind,
        uploaded_by=user.oidc_sub,
    )
    db.add(db_image)
    await db.commit()
    await db.refresh(db_image)

    return _image_to_dict(db_image)


# ---------------------------------------------------------------------------
# List images for a recipe
# ---------------------------------------------------------------------------


@router.get("/recipes/{recipe_id}/images")
async def list_images(
    recipe_id: uuid.UUID,
    kind: ImageKind | None = Query(None, description="Nur Bilder dieser Art"),
    db: AsyncSession = Depends(get_db),
    _user: AppUser = Depends(require_readonly),
):
    """List all images for a recipe (optional nur eine Bildart)."""
    await _get_recipe_or_404(recipe_id, db)

    query = select(RecipeImage).where(RecipeImage.recipe_id == recipe_id)
    if kind is not None:
        query = query.where(RecipeImage.kind == kind)
    result = await db.execute(query.order_by(RecipeImage.kind, RecipeImage.sort_order))
    return [_image_to_dict(img) for img in result.scalars().all()]


# ---------------------------------------------------------------------------
# Serve image file
# ---------------------------------------------------------------------------


@router.get("/images/{image_id}")
async def get_image(
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Serve the optimised image. No auth required for caching."""
    img = await _get_image_or_404(image_id, db)

    file_path = image_service.upload_path(img.file_path)
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
    img = await _get_image_or_404(image_id, db)

    if not img.thumbnail_path:
        raise HTTPException(status_code=404, detail="Kein Thumbnail vorhanden")

    thumb_path = image_service.upload_path(img.thumbnail_path)
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

    await db.execute(delete(RecipeImage).where(RecipeImage.id == image_id))
    await db.commit()
    # Dateien erst nach dem Commit; Fehler dabei loggt der Service
    image_service.delete_image_files(img)
