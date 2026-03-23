"""Recipe CRUD routes with fulltext search, pagination, and tag management."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin, require_editor
from app.database import get_db
from app.models.image import RecipeImage
from app.models.recipe import Recipe
from app.models.tag import RecipeTag, Tag
from app.models.user import AppUser
from app.routes.images import download_and_store_image
from app.schemas.recipe import (
    RecipeCreate,
    RecipeListItem,
    RecipeListResponse,
    RecipeResponse,
    RecipeUpdate,
    TagResponse,
)

router = APIRouter(prefix="/v1", tags=["recipes"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_recipe_or_404(
    recipe_id: uuid.UUID, db: AsyncSession
) -> Recipe:
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Rezept nicht gefunden")
    return recipe


async def _get_tags_for_recipe(recipe_id: uuid.UUID, db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(Tag.name)
        .join(RecipeTag, RecipeTag.tag_id == Tag.id)
        .where(RecipeTag.recipe_id == recipe_id)
        .order_by(Tag.name)
    )
    return list(result.scalars().all())


async def _sync_tags(recipe_id: uuid.UUID, tag_names: list[str], db: AsyncSession) -> None:
    """Replace all tags for a recipe with the given list."""
    # Remove existing
    await db.execute(delete(RecipeTag).where(RecipeTag.recipe_id == recipe_id))

    if not tag_names:
        return

    # Deduplicate and normalise
    unique_names = list(dict.fromkeys(name.strip() for name in tag_names if name.strip()))

    for name in unique_names:
        # Get or create tag
        result = await db.execute(select(Tag).where(Tag.name == name))
        tag = result.scalar_one_or_none()
        if tag is None:
            tag = Tag(name=name)
            db.add(tag)
            await db.flush()

        db.add(RecipeTag(recipe_id=recipe_id, tag_id=tag.id))


async def _get_first_image_id(
    recipe_id: uuid.UUID, db: AsyncSession
) -> uuid.UUID | None:
    result = await db.execute(
        select(RecipeImage.id)
        .where(RecipeImage.recipe_id == recipe_id)
        .order_by(RecipeImage.sort_order)
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _auto_download_imageurl(
    recipe: Recipe, db: AsyncSession, uploaded_by: uuid.UUID | None = None
) -> None:
    """If recipe.data contains an http(s) imageurl, download it and clear the field."""
    data = recipe.data or {}
    url = data.get("imageurl")
    if not url or not isinstance(url, str) or not url.startswith("http"):
        return

    img = await download_and_store_image(url, recipe.id, db, uploaded_by=uploaded_by)
    if img:
        # Clear imageurl + cloud_images since the image is now stored
        data = dict(data)
        data["imageurl"] = None
        data.pop("cloud_images", None)
        recipe.data = data


def _recipe_to_list_item(recipe: Recipe, tags: list[str], first_image_id: uuid.UUID | None = None) -> RecipeListItem:
    data = recipe.data or {}
    return RecipeListItem(
        id=recipe.id,
        recipe_name=recipe.recipe_name,
        author=data.get("author"),
        subtitle=data.get("subtitle"),
        imageurl=data.get("imageurl"),
        tags=tags,
        first_image_id=first_image_id,
        updated_at=recipe.updated_at,
        created_by=recipe.created_by,
    )


def _recipe_to_response(
    recipe: Recipe, tags: list[str], first_image_id: uuid.UUID | None = None
) -> RecipeResponse:
    return RecipeResponse(
        id=recipe.id,
        recipe_name=recipe.recipe_name,
        data=recipe.data or {},
        tags=tags,
        first_image_id=first_image_id,
        created_by=recipe.created_by,
        updated_by=recipe.updated_by,
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
    )


# ---------------------------------------------------------------------------
# GET /recipes — List with search, filter, sort, pagination
# ---------------------------------------------------------------------------

@router.get("/recipes", response_model=RecipeListResponse)
async def list_recipes(
    q: str | None = Query(None, description="Volltextsuche (deutsch)"),
    tag: str | None = Query(None, description="Nach Tag filtern"),
    sort: str = Query("updated", description="Sort: updated, name, created"),
    order: str = Query("desc", description="asc oder desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Recipe)
    count_query = select(func.count()).select_from(Recipe)

    # Fulltext search
    if q and q.strip():
        ts_query = func.plainto_tsquery("german", q.strip())
        query = query.where(Recipe.search_vector.op("@@")(ts_query))
        count_query = count_query.where(Recipe.search_vector.op("@@")(ts_query))

    # Tag filter
    if tag and tag.strip():
        tag_sub = (
            select(RecipeTag.recipe_id)
            .join(Tag, Tag.id == RecipeTag.tag_id)
            .where(Tag.name == tag.strip())
        )
        query = query.where(Recipe.id.in_(tag_sub))
        count_query = count_query.where(Recipe.id.in_(tag_sub))

    # Sorting
    sort_col = {
        "updated": Recipe.updated_at,
        "name": Recipe.recipe_name,
        "created": Recipe.created_at,
    }.get(sort, Recipe.updated_at)

    if order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    # Count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    recipes = result.scalars().all()

    # Fetch tags and first image for each recipe
    items = []
    # Batch fetch first image IDs for all recipes
    recipe_ids = [r.id for r in recipes]
    first_images: dict[uuid.UUID, uuid.UUID] = {}
    if recipe_ids:
        # Use DISTINCT ON to get the image with lowest sort_order per recipe
        img_result = await db.execute(
            select(RecipeImage.recipe_id, RecipeImage.id)
            .where(RecipeImage.recipe_id.in_(recipe_ids))
            .order_by(RecipeImage.recipe_id, RecipeImage.sort_order)
            .distinct(RecipeImage.recipe_id)
        )
        for row in img_result:
            first_images[row[0]] = row[1]

    for recipe in recipes:
        tags = await _get_tags_for_recipe(recipe.id, db)
        items.append(_recipe_to_list_item(recipe, tags, first_images.get(recipe.id)))

    return RecipeListResponse(items=items, total=total, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# GET /recipes/:id — Single recipe
# ---------------------------------------------------------------------------

@router.get("/recipes/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: uuid.UUID,
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await _get_recipe_or_404(recipe_id, db)
    tags = await _get_tags_for_recipe(recipe_id, db)
    first_image_id = await _get_first_image_id(recipe_id, db)
    return _recipe_to_response(recipe, tags, first_image_id)


# ---------------------------------------------------------------------------
# POST /recipes — Create
# ---------------------------------------------------------------------------

@router.post("/recipes", response_model=RecipeResponse, status_code=201)
async def create_recipe(
    body: RecipeCreate,
    user: AppUser = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
):
    data = body.data if isinstance(body.data, dict) else body.data.model_dump(exclude_none=True)

    recipe = Recipe(
        recipe_name=body.recipe_name,
        data=data,
        created_by=user.oidc_sub,
        updated_by=user.oidc_sub,
    )
    db.add(recipe)
    await db.flush()

    # Auto-download imageurl if present
    await _auto_download_imageurl(recipe, db, user.oidc_sub)

    if body.tags:
        await _sync_tags(recipe.id, body.tags, db)

    await db.commit()
    await db.refresh(recipe)

    tags = await _get_tags_for_recipe(recipe.id, db)
    first_image_id = await _get_first_image_id(recipe.id, db)
    return _recipe_to_response(recipe, tags, first_image_id)


# ---------------------------------------------------------------------------
# PUT /recipes/:id — Update
# ---------------------------------------------------------------------------

@router.put("/recipes/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(
    recipe_id: uuid.UUID,
    body: RecipeUpdate,
    user: AppUser = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
):
    recipe = await _get_recipe_or_404(recipe_id, db)

    if body.recipe_name is not None:
        recipe.recipe_name = body.recipe_name
    if body.data is not None:
        recipe.data = body.data if isinstance(body.data, dict) else body.data.model_dump(exclude_none=True)

    recipe.updated_by = user.oidc_sub
    recipe.updated_at = func.now()

    # Auto-download imageurl if present
    await _auto_download_imageurl(recipe, db, user.oidc_sub)

    if body.tags is not None:
        await _sync_tags(recipe_id, body.tags, db)

    await db.commit()
    await db.refresh(recipe)

    tags = await _get_tags_for_recipe(recipe_id, db)
    first_image_id = await _get_first_image_id(recipe_id, db)
    return _recipe_to_response(recipe, tags, first_image_id)


# ---------------------------------------------------------------------------
# DELETE /recipes/:id — Admin only
# ---------------------------------------------------------------------------

@router.delete("/recipes/{recipe_id}", status_code=204)
async def delete_recipe(
    recipe_id: uuid.UUID,
    user: AppUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    recipe = await _get_recipe_or_404(recipe_id, db)
    await db.delete(recipe)
    await db.commit()


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

@router.get("/tags", response_model=list[TagResponse])
async def list_tags(
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tag).order_by(Tag.name))
    return result.scalars().all()


@router.post("/recipes/{recipe_id}/tags", response_model=list[str])
async def set_recipe_tags(
    recipe_id: uuid.UUID,
    tags: list[str],
    user: AppUser = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
):
    await _get_recipe_or_404(recipe_id, db)
    await _sync_tags(recipe_id, tags, db)
    await db.commit()
    return await _get_tags_for_recipe(recipe_id, db)
