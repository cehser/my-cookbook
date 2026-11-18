"""Prüfregel gegen das Leeren von Zutaten und Schritten (ohne DB)."""

import pytest

from app.schemas.recipe import RecipeData, normalize_recipe_data, would_empty_recipe

FULL = {"ingredients": [{"name": "Mehl"}], "steps": [{"step": "Kneten"}]}


def _normalized(data: dict) -> dict:
    return normalize_recipe_data(RecipeData.model_validate(data).model_dump())


@pytest.mark.parametrize(
    ("stored", "new", "expected"),
    [
        (FULL, {}, True),
        (FULL, {"author": "x", "sections": [{"section": "A"}]}, True),
        ({"ingredients": [{"name": "Mehl"}]}, {}, True),
        (FULL, {"steps": [{"step": "Kneten"}]}, False),
        (FULL, {"ingredients": [{"name": "Mehl"}]}, False),
        ({}, {}, False),
        ({"sections": [{"section": "A"}]}, {}, False),
    ],
)
def test_would_empty_recipe(stored: dict, new: dict, expected: bool) -> None:
    assert would_empty_recipe(_normalized(stored), _normalized(new)) is expected


def test_stored_none_counts_as_empty() -> None:
    assert would_empty_recipe(None, _normalized({})) is False
