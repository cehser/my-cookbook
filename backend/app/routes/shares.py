"""Share-Link endpoints: create, list, revoke, and public access."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_editor
from app.database import get_db
from app.models.image import RecipeImage
from app.models.recipe import Recipe
from app.models.site_settings import SiteSettings
from app.models.tag import RecipeShare, Tag, RecipeTag
from app.models.user import AppUser


# --- Schemas ---

class ShareCreateRequest(BaseModel):
    expires_in_days: int | None = None


class ShareResponse(BaseModel):
    id: uuid.UUID
    recipe_id: uuid.UUID
    token: str
    created_by: uuid.UUID
    created_at: datetime
    expires_at: datetime | None
    is_active: bool

    model_config = {"from_attributes": True}


class ShareConfigResponse(BaseModel):
    max_share_days: int


class SharedRecipeResponse(BaseModel):
    recipe_name: str
    data: dict
    tags: list[str] = []
    shared_by: str
    shared_at: datetime
    first_image_id: uuid.UUID | None = None


# --- Helpers ---

async def _get_max_share_days(db: AsyncSession) -> int:
    """Return the max share days from site settings (default 30)."""
    result = await db.execute(select(SiteSettings).where(SiteSettings.id == 1))
    row = result.scalar_one_or_none()
    if row and row.data:
        return row.data.get("max_share_days", 30)
    return 30


# --- Routers ---

router = APIRouter(prefix="/v1", tags=["shares"])
public_router = APIRouter(prefix="/v1", tags=["public-shares"])


# ---------------------------------------------------------------------------
# Authenticated endpoints (require editor+)
# ---------------------------------------------------------------------------

@router.get("/shares/config", response_model=ShareConfigResponse)
async def get_share_config(
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return share configuration (max expiry days)."""
    max_days = await _get_max_share_days(db)
    return ShareConfigResponse(max_share_days=max_days)


@router.post(
    "/recipes/{recipe_id}/share",
    response_model=ShareResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_share_link(
    recipe_id: uuid.UUID,
    body: ShareCreateRequest | None = None,
    user: AppUser = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
):
    """Create a new share link for a recipe."""
    # Verify recipe exists
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")

    max_days = await _get_max_share_days(db)
    expires_in_days = (body.expires_in_days if body else None) or max_days

    if expires_in_days < 1 or expires_in_days > max_days:
        raise HTTPException(
            status_code=400,
            detail=f"Laufzeit muss zwischen 1 und {max_days} Tagen liegen",
        )

    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    share = RecipeShare(
        recipe_id=recipe_id,
        token=secrets.token_urlsafe(32),
        created_by=user.oidc_sub,
        expires_at=expires_at,
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)
    return share


@router.get("/recipes/{recipe_id}/shares", response_model=list[ShareResponse])
async def list_share_links(
    recipe_id: uuid.UUID,
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active share links for a recipe."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(RecipeShare)
        .where(
            RecipeShare.recipe_id == recipe_id,
            RecipeShare.is_active == True,  # noqa: E712
        )
        .order_by(RecipeShare.created_at.desc())
    )
    shares = result.scalars().all()
    # Filter out expired ones on the fly
    return [s for s in shares if s.expires_at is None or s.expires_at > now]


@router.delete("/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share_link(
    share_id: uuid.UUID,
    user: AppUser = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate (revoke) a share link."""
    result = await db.execute(select(RecipeShare).where(RecipeShare.id == share_id))
    share = result.scalar_one_or_none()
    if share is None:
        raise HTTPException(status_code=404, detail="Share-Link nicht gefunden")

    share.is_active = False
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Public endpoints (no auth required)
# ---------------------------------------------------------------------------

async def _get_active_share(token: str, db: AsyncSession) -> RecipeShare:
    """Resolve token to active, non-expired share or raise 404."""
    result = await db.execute(
        select(RecipeShare).where(
            RecipeShare.token == token,
            RecipeShare.is_active == True,  # noqa: E712
        )
    )
    share = result.scalar_one_or_none()
    if share is None:
        raise HTTPException(status_code=404, detail="Link ungültig oder abgelaufen")
    # Check expiry
    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Dieser Share-Link ist abgelaufen")
    return share


@public_router.get("/shared/{token}", response_model=SharedRecipeResponse)
async def get_shared_recipe(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Public: read a recipe via share token (no auth)."""
    share = await _get_active_share(token, db)

    # Load recipe
    result = await db.execute(select(Recipe).where(Recipe.id == share.recipe_id))
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Rezept nicht mehr vorhanden")

    # Load tags
    from app.models.tag import Tag, RecipeTag
    tag_result = await db.execute(
        select(Tag.name)
        .join(RecipeTag, RecipeTag.tag_id == Tag.id)
        .where(RecipeTag.recipe_id == recipe.id)
        .order_by(Tag.name)
    )
    tags = list(tag_result.scalars().all())

    # Load creator display name
    creator_result = await db.execute(
        select(AppUser.display_name).where(AppUser.oidc_sub == share.created_by)
    )
    shared_by = creator_result.scalar_one_or_none() or "Unbekannt"

    # First image
    img_result = await db.execute(
        select(RecipeImage.id)
        .where(RecipeImage.recipe_id == recipe.id)
        .order_by(RecipeImage.sort_order)
        .limit(1)
    )
    first_image_id = img_result.scalar_one_or_none()

    return SharedRecipeResponse(
        recipe_name=recipe.recipe_name,
        data=recipe.data or {},
        tags=tags,
        shared_by=shared_by,
        shared_at=share.created_at,
        first_image_id=first_image_id,
    )
