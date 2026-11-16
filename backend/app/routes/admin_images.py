"""Admin-Wartung der Bilder: imageurl migrieren, verwaiste Zeilen und Altlasten bereinigen."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models.image import IMAGE_KIND_PHOTO, RecipeImage
from app.models.recipe import Recipe
from app.models.user import AppUser
from app.services import images as image_service

# Tag "images" wie vor dem Herauslösen aus routes/images.py (OpenAPI unverändert)
router = APIRouter(prefix="/v1/admin", tags=["images"])


# ---------------------------------------------------------------------------
# imageurl → backend storage
# ---------------------------------------------------------------------------


@router.post("/migrate-images")
async def migrate_image_urls(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_admin),
):
    """Download all imageurl references and store them as recipe_images.

    Skips recipes that already have at least one stored photo (Vorlagen zählen nicht).
    """
    result = await db.execute(
        select(Recipe).where(
            Recipe.data["imageurl"].astext.isnot(None),
            Recipe.data["imageurl"].astext != "",
            Recipe.data["imageurl"].astext != "null",
            ~Recipe.id.in_(
                select(RecipeImage.recipe_id).where(RecipeImage.kind == IMAGE_KIND_PHOTO).distinct()
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

        img = await image_service.download_and_store_image(
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


# ---------------------------------------------------------------------------
# Cleanup orphaned recipe_images (file missing on disk)
# ---------------------------------------------------------------------------


@router.post("/cleanup-images")
async def cleanup_orphaned_images(
    db: AsyncSession = Depends(get_db),
    _user: AppUser = Depends(require_admin),
):
    """Find recipe_images rows whose files no longer exist on disk and delete them."""
    result = await db.execute(select(RecipeImage))
    images = result.scalars().all()

    orphans: list[RecipeImage] = []
    for img in images:
        file_exists = img.file_path and image_service.upload_path(img.file_path).is_file()
        thumb_exists = (
            img.thumbnail_path and image_service.upload_path(img.thumbnail_path).is_file()
        )
        if not file_exists and not thumb_exists:
            await db.execute(delete(RecipeImage).where(RecipeImage.id == img.id))
            orphans.append(img)

    await db.commit()
    # Restliche Dateien (z. B. Original) jeder Bildart erst nach dem Commit
    for img in orphans:
        image_service.delete_image_files(img)

    return {
        "checked": len(images),
        "removed": len(orphans),
        "remaining": len(images) - len(orphans),
    }


# ---------------------------------------------------------------------------
# Strip stale first_image_id from recipe JSONB data
# ---------------------------------------------------------------------------


@router.post("/strip-image-ids")
async def strip_image_ids_from_data(
    db: AsyncSession = Depends(get_db),
    _user: AppUser = Depends(require_admin),
):
    """Remove first_image_id keys that were accidentally saved into recipe.data JSONB."""
    result = await db.execute(
        select(Recipe).where(Recipe.data["first_image_id"].astext.isnot(None))
    )
    recipes = result.scalars().all()

    cleaned = 0
    for recipe in recipes:
        data = dict(recipe.data or {})
        if "first_image_id" in data:
            del data["first_image_id"]
            recipe.data = data
            cleaned += 1

    await db.commit()

    return {"cleaned": cleaned}
