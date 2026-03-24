import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin
from app.database import get_db
from app.models.recipe import Recipe
from app.models.site_settings import SiteSettings
from app.models.tag import RecipeShare
from app.models.user import AppUser
from app.schemas.user import CurrentUserResponse, UserResponse, UserRoleUpdate

router = APIRouter(prefix="/v1/admin", tags=["admin"])

VALID_ROLES = {"pending", "readonly", "editor", "admin"}

# Default site settings
SITE_DEFAULTS = {"max_share_days": 30}


class SiteSettingsResponse(BaseModel):
    max_share_days: int = 30


class SiteSettingsUpdate(BaseModel):
    max_share_days: int = 30


async def _get_site_settings(db: AsyncSession) -> dict:
    """Return the site settings dict, creating the row if missing."""
    result = await db.execute(select(SiteSettings).where(SiteSettings.id == 1))
    row = result.scalar_one_or_none()
    if row is None:
        row = SiteSettings(id=1, data=SITE_DEFAULTS)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return {**SITE_DEFAULTS, **(row.data or {})}


@router.get("/settings", response_model=SiteSettingsResponse)
async def get_site_settings(
    _: AppUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await _get_site_settings(db)
    return SiteSettingsResponse(**data)


@router.put("/settings", response_model=SiteSettingsResponse)
async def update_site_settings(
    body: SiteSettingsUpdate,
    _: AppUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SiteSettings).where(SiteSettings.id == 1))
    row = result.scalar_one_or_none()
    new_data = body.model_dump()
    if row is None:
        row = SiteSettings(id=1, data=new_data)
        db.add(row)
    else:
        row.data = {**(row.data or {}), **new_data}
    await db.commit()
    await db.refresh(row)
    return SiteSettingsResponse(**row.data)


class AdminShareResponse(BaseModel):
    id: uuid.UUID
    recipe_id: uuid.UUID
    recipe_name: str
    token: str
    created_by: uuid.UUID
    created_by_name: str
    created_at: datetime
    expires_at: datetime | None
    is_active: bool


@router.get("/shares", response_model=list[AdminShareResponse])
async def list_all_shares(
    _: AppUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all share links (active + inactive) for admin overview."""
    result = await db.execute(
        select(RecipeShare).order_by(RecipeShare.created_at.desc())
    )
    shares = result.scalars().all()

    # Batch-load recipe names and user names
    recipe_ids = {s.recipe_id for s in shares}
    user_ids = {s.created_by for s in shares}

    recipe_names: dict[uuid.UUID, str] = {}
    if recipe_ids:
        r = await db.execute(select(Recipe.id, Recipe.recipe_name).where(Recipe.id.in_(recipe_ids)))
        recipe_names = {row.id: row.recipe_name for row in r.all()}

    user_names: dict[uuid.UUID, str] = {}
    if user_ids:
        u = await db.execute(select(AppUser.oidc_sub, AppUser.display_name).where(AppUser.oidc_sub.in_(user_ids)))
        user_names = {row.oidc_sub: row.display_name for row in u.all()}

    return [
        AdminShareResponse(
            id=s.id,
            recipe_id=s.recipe_id,
            recipe_name=recipe_names.get(s.recipe_id, "(gelöscht)"),
            token=s.token,
            created_by=s.created_by,
            created_by_name=user_names.get(s.created_by, "Unbekannt"),
            created_at=s.created_at,
            expires_at=s.expires_at,
            is_active=s.is_active,
        )
        for s in shares
    ]


@router.delete("/shares/{share_id}", status_code=204)
async def admin_revoke_share(
    share_id: uuid.UUID,
    _: AppUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: deactivate any share link."""
    result = await db.execute(select(RecipeShare).where(RecipeShare.id == share_id))
    share = result.scalar_one_or_none()
    if share is None:
        raise HTTPException(status_code=404, detail="Share-Link nicht gefunden")
    share.is_active = False
    await db.commit()


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    _: AppUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AppUser).order_by(AppUser.created_at))
    return result.scalars().all()


@router.put("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: uuid.UUID,
    body: UserRoleUpdate,
    _: AppUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ungültige Rolle: '{body.role}'. Erlaubt: {VALID_ROLES}",
        )

    result = await db.execute(select(AppUser).where(AppUser.oidc_sub == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User nicht gefunden")

    user.role = body.role
    await db.commit()
    await db.refresh(user)
    return user
