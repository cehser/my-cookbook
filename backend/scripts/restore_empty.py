"""
Restore recipes that have empty data in DB from the original cookbook.yaml.

Usage (inside backend container):
  python -m scripts.restore_empty /data/cookbook.yaml
"""

import argparse
import asyncio
import json
import sys
import uuid
from pathlib import Path

import yaml
from sqlalchemy import select, update

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import async_session  # noqa: E402
from app.models.recipe import Recipe     # noqa: E402
from app.models import Base              # noqa: E402


TOP_LEVEL_COLS = {"recipe_uuid", "recipe_name", "lastUpdated"}


def build_data_blob(entry: dict) -> dict:
    return {k: v for k, v in entry.items() if k not in TOP_LEVEL_COLS}


async def restore(yaml_path: str) -> None:
    path = Path(yaml_path)
    if not path.exists():
        print(f"ERROR: File not found: {path}")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        recipes = yaml.safe_load(f)

    if not isinstance(recipes, list):
        print("ERROR: Expected a YAML list of recipes.")
        sys.exit(1)

    # Build lookup by UUID
    yaml_lookup: dict[uuid.UUID, dict] = {}
    for entry in recipes:
        rid = uuid.UUID(str(entry["recipe_uuid"]))
        yaml_lookup[rid] = entry

    async with async_session() as session:
        # Find recipes with empty ingredients
        result = await session.execute(
            select(Recipe.id, Recipe.recipe_name, Recipe.data)
        )
        rows = result.all()

        restored = 0
        for recipe_id, name, data in rows:
            ingredients = (data or {}).get("ingredients", [])
            steps = (data or {}).get("steps", [])

            if ingredients or steps:
                continue  # has data, skip

            if recipe_id not in yaml_lookup:
                print(f"  ! {name} ({recipe_id}) — not found in YAML, skipping")
                continue

            new_data = build_data_blob(yaml_lookup[recipe_id])
            await session.execute(
                update(Recipe)
                .where(Recipe.id == recipe_id)
                .values(data=new_data)
            )
            restored += 1
            print(f"  ✓ {name} ({recipe_id}) — restored")

        await session.commit()
        print(f"\nDone: {restored} recipes restored.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Restore empty recipes from YAML")
    parser.add_argument("yaml_file", help="Path to cookbook.yaml")
    args = parser.parse_args()
    asyncio.run(restore(args.yaml_file))


if __name__ == "__main__":
    main()
