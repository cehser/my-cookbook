import re
import uuid
from datetime import datetime

import openai
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models.recipe import Recipe
from app.models.site_settings import SiteSettings
from app.models.tag import RecipeShare
from app.models.user import AppUser
from app.schemas.user import UserResponse, UserRoleUpdate
from app.services.openai_client import (
    get_client,
    openai_errors,
    openai_key_configured,
    require_openai_key,
)
from app.services.site_settings import SITE_DEFAULTS, get_site_settings

router = APIRouter(prefix="/v1/admin", tags=["admin"])

VALID_ROLES = {"pending", "readonly", "editor", "admin"}

MODEL_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$")


class SiteSettingsResponse(BaseModel):
    max_share_days: int
    ai_model_text: str
    ai_model_image: str
    openai_key_configured: bool


class SiteSettingsUpdate(BaseModel):
    """Nur gesetzte Felder werden gespeichert (``exclude_unset``)."""

    max_share_days: int | None = Field(default=None, ge=1, le=365)
    ai_model_text: str | None = None
    ai_model_image: str | None = None


def _settings_response(data: dict) -> SiteSettingsResponse:
    return SiteSettingsResponse(
        max_share_days=data["max_share_days"],
        ai_model_text=data["ai_model_text"],
        ai_model_image=data["ai_model_image"],
        openai_key_configured=openai_key_configured(),
    )


async def _check_model_available(model: str) -> None:
    """Raise 422 if the model is unknown to the OpenAI key, or map other OpenAI errors."""
    if not MODEL_ID_PATTERN.match(model):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"Ungültige Modell-ID: '{model}'"
        )
    client = get_client()
    try:
        with openai_errors(model):
            await client.models.retrieve(model)
    except HTTPException as exc:
        # Modell unbekannt: für den Admin ein 422 an der Eingabe statt eines 503.
        if isinstance(exc.__cause__, openai.NotFoundError):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"Modell '{model}' ist mit dem konfigurierten OpenAI-Key nicht verfügbar.",
            ) from exc
        raise


@router.get("/settings", response_model=SiteSettingsResponse)
async def get_settings_route(
    _: AppUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return _settings_response(await get_site_settings(db))


@router.put("/settings", response_model=SiteSettingsResponse)
async def update_site_settings(
    body: SiteSettingsUpdate,
    _: AppUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    for field in ("ai_model_text", "ai_model_image"):
        if field in changes:
            changes[field] = changes[field].strip()
            await _check_model_available(changes[field])

    await get_site_settings(db)  # legt die Zeile bei Bedarf an
    result = await db.execute(select(SiteSettings).where(SiteSettings.id == 1))
    row = result.scalar_one()
    row.data = {**(row.data or {}), **changes}
    await db.commit()
    await db.refresh(row)
    return _settings_response({**SITE_DEFAULTS, **row.data})


class AIModelCheck(BaseModel):
    purpose: str
    model: str
    available: bool


class AIConnectionTestResponse(BaseModel):
    ok: bool
    models: list[AIModelCheck]


@router.post("/ai/test", response_model=AIConnectionTestResponse)
async def test_ai_connection(
    _: AppUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Prüft Key und Erreichbarkeit der konfigurierten Modelle (kostenlos: models.retrieve)."""
    data = await get_site_settings(db)
    require_openai_key()
    checks: list[AIModelCheck] = []
    for purpose, field in (("Text/URL", "ai_model_text"), ("Foto", "ai_model_image")):
        model = data[field]
        try:
            await _check_model_available(model)
            available = True
        except HTTPException as exc:
            if exc.status_code != status.HTTP_422_UNPROCESSABLE_CONTENT:
                raise
            available = False
        checks.append(AIModelCheck(purpose=purpose, model=model, available=available))
    return AIConnectionTestResponse(ok=all(c.available for c in checks), models=checks)


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
    result = await db.execute(select(RecipeShare).order_by(RecipeShare.created_at.desc()))
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
        u = await db.execute(
            select(AppUser.oidc_sub, AppUser.display_name).where(AppUser.oidc_sub.in_(user_ids))
        )
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
