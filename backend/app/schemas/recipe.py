"""Pydantic schemas for Recipe CRUD."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# --- Nested data structures (matching frontend Recipe type) ---

class Amount(BaseModel):
    amount: str | float | int
    unit: str = ""


class Ingredient(BaseModel):
    """Flexible ingredient: name → amounts mapping + section."""
    name: str
    amounts: list[Amount] = []
    notes: str | None = None
    section: str = ""


class Step(BaseModel):
    step: str
    haccp: dict[str, str] | None = None
    notes: list[str] | None = None
    section: str = ""


class YieldEntry(BaseModel):
    unit: str
    value: float | int | str


class RecipeData(BaseModel):
    """The full recipe body stored in the JSONB `data` column."""
    author: str | None = None
    source_url: str | None = None
    source_book: str | None = None
    prep_time: str | None = None
    cook_time: str | None = None
    total_time: str | None = None
    bake_time: str | None = None
    servings: str | None = None
    difficulty: str | None = None
    notes: str | None = None
    subtitle: str | None = None
    yields: list[YieldEntry] | list[dict] | None = None
    ingredients: list[Ingredient | dict] = []
    steps: list[Step | dict] = []
    sections: list[dict] | None = None
    imageurl: str | None = None
    recalc_exp: float | None = None
    cloud_images: list[str] | None = None

    model_config = {"extra": "allow"}


# --- Request schemas ---

class RecipeCreate(BaseModel):
    recipe_name: str = Field(..., min_length=1, max_length=500)
    data: RecipeData | dict = Field(default_factory=dict)
    tags: list[str] | None = None


class RecipeUpdate(BaseModel):
    recipe_name: str | None = Field(None, min_length=1, max_length=500)
    data: RecipeData | dict | None = None
    tags: list[str] | None = None


# --- Response schemas ---

class TagResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class RecipeListItem(BaseModel):
    """Slim recipe for gallery/list views."""
    id: uuid.UUID
    recipe_name: str
    author: str | None = None
    subtitle: str | None = None
    tags: list[str] = []
    imageurl: str | None = None
    updated_at: datetime
    created_by: uuid.UUID | None = None

    model_config = {"from_attributes": True}


class RecipeResponse(BaseModel):
    """Full recipe detail."""
    id: uuid.UUID
    recipe_name: str
    data: dict
    tags: list[str] = []
    created_by: uuid.UUID | None = None
    updated_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecipeListResponse(BaseModel):
    items: list[RecipeListItem]
    total: int
    page: int
    page_size: int
