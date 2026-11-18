import uuid
from datetime import datetime

from pydantic import BaseModel


class UserResponse(BaseModel):
    oidc_sub: uuid.UUID
    display_name: str
    email: str | None = None
    given_name: str | None = None
    family_name: str | None = None
    role: str
    created_at: datetime
    last_login: datetime | None

    model_config = {"from_attributes": True}


class UserRoleUpdate(BaseModel):
    role: str

    model_config = {
        "json_schema_extra": {
            "examples": [{"role": "editor"}],
        }
    }


class CurrentUserResponse(BaseModel):
    oidc_sub: uuid.UUID
    display_name: str
    role: str

    model_config = {"from_attributes": True}


class UserSettings(BaseModel):
    """Body von ``PUT /me/settings`` alter PWA-Stände; wird ignoriert (U.15)."""

    read_only: bool = True
    expert_mode: bool = False
    # Alte Clients (PWA-Cache) senden noch gpt_model: ignorieren statt 422.
    model_config = {"extra": "ignore"}


class UserSettingsResponse(BaseModel):
    """Antwort von ``/me/settings``: ``read_only`` aus der Rolle, ``expert_mode`` immer
    ``false``; beide nur für alte PWA-Stände."""

    read_only: bool
    expert_mode: bool
    role: str

    model_config = {"from_attributes": True}
