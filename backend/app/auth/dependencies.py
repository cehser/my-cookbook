"""Auth dependencies for FastAPI route protection."""

import logging
import uuid
from datetime import UTC, datetime

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import PyJWTError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.oidc import verify_oidc_token
from app.config import settings
from app.database import get_db
from app.models.user import AppUser

logger = logging.getLogger(__name__)

security = HTTPBearer()


async def get_or_create_user(db: AsyncSession, payload: dict) -> AppUser:
    """Load user from DB. If not found, auto-provision with 'pending' role.

    Syncs OIDC profile claims (display_name, email, given_name, family_name)
    on every login. Matches the verified token e-mail against ``ADMIN_EMAIL``
    and promotes the user to 'admin' (never demotes).
    """
    user_uuid = uuid.UUID(payload["sub"])
    display_name = payload.get("preferred_username") or "Unknown"
    email = payload.get("email")
    given_name = payload.get("given_name")
    family_name = payload.get("family_name")

    result = await db.execute(select(AppUser).where(AppUser.oidc_sub == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        # ON CONFLICT: parallele erste Requests desselben Users dürfen keine
        # UniqueViolation auslösen; wer verliert, liest den Gewinner-Datensatz.
        await db.execute(
            pg_insert(AppUser)
            .values(
                oidc_sub=user_uuid,
                display_name=display_name,
                email=email,
                given_name=given_name,
                family_name=family_name,
                role="pending",
            )
            .on_conflict_do_nothing(index_elements=[AppUser.oidc_sub])
        )
        result = await db.execute(select(AppUser).where(AppUser.oidc_sub == user_uuid))
        user = result.scalar_one()
    else:
        # Sync profile fields from OIDC on every login
        user.last_login = datetime.now(UTC)
        if display_name and user.display_name != display_name:
            user.display_name = display_name
        if email is not None:
            user.email = email
        if given_name is not None:
            user.given_name = given_name
        if family_name is not None:
            user.family_name = family_name

    if user.role != "admin" and _is_admin_email(payload):
        logger.info("ADMIN_EMAIL stimmt überein: User %s wird zum Admin heraufgestuft", user_uuid)
        user.role = "admin"

    await db.commit()
    return user


def _is_admin_email(payload: dict) -> bool:
    """True, wenn die E-Mail des Tokens ADMIN_EMAIL entspricht und verifiziert ist."""
    admin_email = settings.admin_email
    email = payload.get("email")
    if not admin_email or not isinstance(email, str):
        return False
    # Ohne bestätigtes email_verified-Claim keine Heraufstufung
    if payload.get("email_verified") is not True:
        return False
    return email.strip().casefold() == admin_email.strip().casefold()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> AppUser:
    """Verify OIDC token and return the authenticated user."""
    try:
        payload = verify_oidc_token(credentials.credentials)
    except PyJWTError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ungültig oder abgelaufen",
            headers={"WWW-Authenticate": "Bearer"},
        ) from err

    user = await get_or_create_user(db, payload)
    return user


async def require_readonly(
    user: AppUser = Depends(get_current_user),
) -> AppUser:
    """Require at least 'readonly' role (blocks 'pending' users)."""
    if user.role not in ("readonly", "editor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dein Account wurde registriert. Ein Admin muss dir noch Zugriff gewähren.",
        )
    return user


async def require_editor(
    user: AppUser = Depends(get_current_user),
) -> AppUser:
    """Require at least 'editor' role."""
    if user.role not in ("editor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Editor- oder Admin-Rolle erforderlich",
        )
    return user


def can_delete_recipe(user: AppUser, created_by: uuid.UUID | None) -> bool:
    """Admins löschen alle Rezepte, Editoren nur eigene (ohne ``created_by`` nur Admins)."""
    if user.role == "admin":
        return True
    return user.role == "editor" and created_by is not None and created_by == user.oidc_sub


async def require_admin(
    user: AppUser = Depends(get_current_user),
) -> AppUser:
    """Require 'admin' role."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin-Rolle erforderlich",
        )
    return user
