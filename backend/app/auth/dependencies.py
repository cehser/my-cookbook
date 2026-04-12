"""Auth dependencies for FastAPI route protection."""

import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import PyJWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.oidc import verify_oidc_token
from app.database import get_db
from app.models.user import AppUser

security = HTTPBearer()


async def get_or_create_user(
    db: AsyncSession, payload: dict
) -> AppUser:
    """Load user from DB. If not found, auto-provision with 'pending' role.

    Syncs OIDC profile claims (display_name, email, given_name, family_name)
    on every login.
    """
    user_uuid = uuid.UUID(payload["sub"])
    display_name = payload.get("preferred_username") or "Unknown"
    email = payload.get("email")
    given_name = payload.get("given_name")
    family_name = payload.get("family_name")

    result = await db.execute(select(AppUser).where(AppUser.oidc_sub == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        user = AppUser(
            oidc_sub=user_uuid,
            display_name=display_name,
            email=email,
            given_name=given_name,
            family_name=family_name,
            role="pending",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Sync profile fields from OIDC on every login
        user.last_login = datetime.now(timezone.utc)
        if display_name and user.display_name != display_name:
            user.display_name = display_name
        if email is not None:
            user.email = email
        if given_name is not None:
            user.given_name = given_name
        if family_name is not None:
            user.family_name = family_name
        await db.commit()

    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> AppUser:
    """Verify OIDC token and return the authenticated user."""
    try:
        payload = verify_oidc_token(credentials.credentials)
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ungültig oder abgelaufen",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
