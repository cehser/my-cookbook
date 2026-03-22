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
    db: AsyncSession, sub: str, display_name: str | None
) -> AppUser:
    """Load user from DB. If not found, auto-provision with 'readonly' role."""
    user_uuid = uuid.UUID(sub)
    result = await db.execute(select(AppUser).where(AppUser.oidc_sub == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        user = AppUser(
            oidc_sub=user_uuid,
            display_name=display_name or "Unknown",
            role="readonly",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update last_login
        user.last_login = datetime.now(timezone.utc)
        if display_name and user.display_name != display_name:
            user.display_name = display_name
        await db.commit()

    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> AppUser:
    """Verify OIDC token and return the authenticated user."""
    try:
        payload = verify_oidc_token(credentials.credentials)
    except PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token ungültig: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_or_create_user(
        db, payload["sub"], payload.get("preferred_username")
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
