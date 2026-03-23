import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin
from app.database import get_db
from app.models.user import AppUser
from app.schemas.user import CurrentUserResponse, UserResponse, UserRoleUpdate

router = APIRouter(prefix="/v1/admin", tags=["admin"])

VALID_ROLES = {"pending", "readonly", "editor", "admin"}


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
