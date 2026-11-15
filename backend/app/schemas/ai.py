"""Rezeptschema für OpenAI Structured Outputs (strict).

Strict verlangt, dass alle Felder Pflicht sind; fehlende Angaben liefert das
Modell als ``null`` bzw. leere Liste. ``recipe_uuid``, ``lastUpdated`` und
``haccp`` fehlen absichtlich: UUID und Zeitstempel setzt das Frontend
(``initRecipe``), HACCP-Angaben würde das Modell nur erfinden.
"""

from typing import Literal

from pydantic import BaseModel


class AIAmount(BaseModel):
    amount: float | None
    unit: str


class AIIngredient(BaseModel):
    name: str
    amounts: list[AIAmount]
    section: str


class AIStep(BaseModel):
    step: str
    notes: list[str]
    section: str


class AISection(BaseModel):
    section: str


class AIYield(BaseModel):
    unit: str
    value: float


class AIRecipe(BaseModel):
    recipe_name: str
    subtitle: str | None
    author: str | None
    source_url: str | None
    source_book: str | None
    bake_time: str | None
    yields: list[AIYield]
    ingredients: list[AIIngredient]
    steps: list[AIStep]
    sections: list[AISection]
    imageurl: str | None
    recalc_exp: Literal[1, 2]


class AIImportResponse(BaseModel):
    recipe: AIRecipe
    model: str
