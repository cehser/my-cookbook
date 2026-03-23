"""Favorites API — per-user recipe favorites, synced server-side."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.favorite import Favorite
from app.models.recipe import Recipe
from app.models.user import AppUser

router = APIRouter(prefix="/v1", tags=["favorites"])


@router.get("/favorites", response_model=list[str])
async def list_favorites(
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return list of recipe UUIDs the current user has favorited."""
    result = await db.execute(
        select(Favorite.recipe_id).where(Favorite.user_id == user.oidc_sub)
    )
    return [str(row) for row in result.scalars().all()]


@router.post("/favorites/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_favorite(
    recipe_id: uuid.UUID,
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a recipe to the current user's favorites."""
    # Verify recipe exists
    recipe = await db.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")

    # Check if already favorited (idempotent)
    existing = await db.get(Favorite, (user.oidc_sub, recipe_id))
    if existing:
        return

    db.add(Favorite(user_id=user.oidc_sub, recipe_id=recipe_id))
    await db.commit()


@router.delete("/favorites/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    recipe_id: uuid.UUID,
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a recipe from the current user's favorites."""
    await db.execute(
        delete(Favorite).where(
            Favorite.user_id == user.oidc_sub,
            Favorite.recipe_id == recipe_id,
        )
    )
    await db.commit()
