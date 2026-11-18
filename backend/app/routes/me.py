from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.user import AppUser
from app.schemas.user import CurrentUserResponse, UserSettings, UserSettingsResponse

router = APIRouter(prefix="/v1", tags=["auth"])


def _build_settings_response(user: AppUser) -> UserSettingsResponse:
    """Einstellungen allein aus der Rolle (U.15).

    ``read_only`` und ``expert_mode`` bleiben nur für alte PWA-Stände in der Antwort:
    ``read_only`` folgt immer der Rolle, ``expert_mode`` ist immer ``false``. Gespeicherte
    Altwerte in ``app_users.settings`` werden nicht mehr gelesen.
    """
    return UserSettingsResponse(
        read_only=user.role not in ("editor", "admin"),
        expert_mode=False,
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
):
    """Nur für alte PWA-Stände: Gesendete Werte werden ignoriert (kein 422, nichts gespeichert)."""
    del payload
    return _build_settings_response(user)
