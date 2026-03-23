import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin
from app.database import get_db
from app.models.site_settings import SiteSettings
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
