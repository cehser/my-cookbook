"""Tag routes — list all tags with recipe counts."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_readonly
from app.database import get_db
from app.models.tag import RecipeTag, Tag
from app.models.user import AppUser

router = APIRouter(prefix="/v1", tags=["tags"])


class TagWithCount(BaseModel):
    name: str
    count: int


@router.get("/tags", response_model=list[TagWithCount])
async def list_tags(
    _user: AppUser = Depends(require_readonly),
    db: AsyncSession = Depends(get_db),
):
    """Return all tags with recipe count, sorted alphabetically.""
    result = await db.execute(
        select(Tag.name, func.count(RecipeTag.recipe_id).label("count"))
        .join(RecipeTag, RecipeTag.tag_id == Tag.id)
        .group_by(Tag.name)
        .order_by(Tag.name)
    )
    return [TagWithCount(name=row.name, count=row.count) for row in result.all()]
