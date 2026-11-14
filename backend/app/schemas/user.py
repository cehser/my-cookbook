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
    """User-specific settings stored in the DB."""

    read_only: bool = True
    expert_mode: bool = False
    # Alte Clients (PWA-Cache) senden noch gpt_model: ignorieren statt 422.
    model_config = {"extra": "ignore"}


class UserSettingsResponse(BaseModel):
    """Full settings response — includes derived fields."""

    read_only: bool
    expert_mode: bool
    role: str

    model_config = {"from_attributes": True}
