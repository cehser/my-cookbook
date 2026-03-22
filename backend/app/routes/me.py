from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import AppUser
from app.schemas.user import CurrentUserResponse, UserSettings, UserSettingsResponse

router = APIRouter(prefix="/v1", tags=["auth"])


def _build_settings_response(user: AppUser) -> UserSettingsResponse:
    """Build settings response from user model, deriving read_only from role."""
    can_edit = user.role in ("editor", "admin")
    raw = user.settings or {}
    return UserSettingsResponse(
        read_only=raw.get("read_only", not can_edit),
        expert_mode=raw.get("expert_mode", False),
        gpt_model=raw.get("gpt_model", "gpt-4o-mini"),
        role=user.role,
    )


@router.get("/me", response_model=CurrentUserResponse)
async def get_me(user: AppUser = Depends(get_current_user)):
    """Return the currently authenticated user's profile and role."""
    return user


@router.get("/me/settings", response_model=UserSettingsResponse)
async def get_settings(user: AppUser = Depends(get_current_user)):
    """Return the current user's settings."""
    return _build_settings_response(user)


@router.put("/me/settings", response_model=UserSettingsResponse)
async def update_settings(
    payload: UserSettings,
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's settings."""
    user.settings = payload.model_dump()
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _build_settings_response(user)
