"""Pydantic schemas for Recipe CRUD."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_number(val: object) -> float | int | None:
    """Coerce a value to a number.  Return None if not possible."""
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        return val
    if isinstance(val, str):
        try:
            f = float(val)
            return int(f) if f == int(f) else f
        except (ValueError, OverflowError):
            return None
    return None


# ---------------------------------------------------------------------------
# Nested data structures – fixed-key format (Sprint D1)
#
#   Ingredient: {"name": "Rosinen", "amounts": [...], "section": ""}
#   YieldEntry: {"unit": "Portionen", "value": 4}
# ---------------------------------------------------------------------------

class Amount(BaseModel):
    amount: float | int | None = None
    unit: str = ""


class Section(BaseModel):
    section: str = ""


class Ingredient(BaseModel):
    """Single ingredient with an explicit ``name`` field."""
    name: str
    amounts: list[Amount] = Field(default_factory=lambda: [Amount()])
    section: str = ""
    notes: list[str] = Field(default_factory=list)
    processing: list[str] = Field(default_factory=list)
    substitutions: list[Any] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def coerce_amounts(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        data.setdefault("section", "")
        if not isinstance(data["section"], str):
            data["section"] = str(data["section"] or "")
        for amt in data.get("amounts", []):
            if isinstance(amt, dict):
                amt["amount"] = _to_number(amt.get("amount"))
                amt.setdefault("unit", "")
        return data


class YieldEntry(BaseModel):
    """A single yield entry, e.g. ``{"unit": "Portionen", "value": 4}``."""
    unit: str = "Portionen"
    value: float | int = 1

    @model_validator(mode="before")
    @classmethod
    def coerce_value(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        num = _to_number(data.get("value"))
        if num is not None:
            data["value"] = num
        return data


class Step(BaseModel):
    step: str
    haccp: dict[str, Any] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)
    section: str = ""


class RecipeData(BaseModel):
    """The full recipe body stored in the JSONB ``data`` column."""
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
    yields: list[YieldEntry] | None = None
    ingredients: list[Ingredient] = []
    steps: list[Step] = []
    sections: list[Section] = Field(default_factory=lambda: [Section()])
    imageurl: str | None = None
    recalc_exp: float | None = None
    model_config = {"extra": "allow"}

    @model_validator(mode="before")
    @classmethod
    def ensure_sections(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        if not data.get("sections"):
            data["sections"] = [{"section": ""}]
        return data


# ---------------------------------------------------------------------------
# Normalisation – safety net that runs on the plain dict before DB storage
# ---------------------------------------------------------------------------

def normalize_recipe_data(data: dict) -> dict:
    """Normalise a recipe data dict in-place and return it."""
    # --- ingredients ---
    for ing in data.get("ingredients", []):
        if not isinstance(ing, dict):
            continue
        ing.setdefault("name", "")
        ing.setdefault("section", "")
        if not isinstance(ing["section"], str):
            ing["section"] = str(ing["section"] or "")
        for amt in ing.get("amounts", []):
            if isinstance(amt, dict):
                amt["amount"] = _to_number(amt.get("amount"))
                amt.setdefault("unit", "")

    # --- steps ---
    for step in data.get("steps", []):
        if not isinstance(step, dict):
            continue
        step.setdefault("section", "")
        if not isinstance(step["section"], str):
            step["section"] = str(step["section"] or "")
        step.setdefault("haccp", {})
        step.setdefault("notes", [])

    # --- yields ---
    for yld in data.get("yields", []) or []:
        if not isinstance(yld, dict):
            continue
        yld.setdefault("unit", "Portionen")
        num = _to_number(yld.get("value"))
        if num is not None:
            yld["value"] = num

    # --- sections ---
    if not data.get("sections"):
        data["sections"] = [{"section": ""}]

    return data


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class RecipeCreate(BaseModel):
    recipe_name: str = Field(..., min_length=1, max_length=500)
    data: RecipeData = Field(default_factory=RecipeData)
    tags: list[str] | None = None


class RecipeUpdate(BaseModel):
    recipe_name: str | None = Field(None, min_length=1, max_length=500)
    data: RecipeData | None = None
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
    first_image_id: uuid.UUID | None = None
    updated_at: datetime
    created_by: uuid.UUID | None = None

    model_config = {"from_attributes": True}


class RecipeResponse(BaseModel):
    """Full recipe detail."""
    id: uuid.UUID
    recipe_name: str
    data: dict
    tags: list[str] = []
    first_image_id: uuid.UUID | None = None
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
