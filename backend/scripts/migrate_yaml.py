"""
Migrate recipes from cookbook.yaml into PostgreSQL.

Usage (inside backend container):
  python -m scripts.migrate_yaml /data/cookbook.yaml [--owner OIDC_SUB]

Without --owner the recipes are inserted with created_by = NULL.
You can assign them to a user later via:
  UPDATE recipes SET created_by = '<oidc_sub>' WHERE created_by IS NULL;
"""

import argparse
import asyncio
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import yaml
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

# Ensure the app package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import async_session                       # noqa: E402
from app.models.recipe import Recipe                         # noqa: E402
from app.models import Base  # ensure all models imported    # noqa: E402


def parse_last_updated(raw: str | datetime | None) -> datetime:
    """Parse lastUpdated from YAML (ISO string or datetime)."""
    if raw is None:
        return datetime.now(timezone.utc)
    if isinstance(raw, datetime):
        if raw.tzinfo is None:
            return raw.replace(tzinfo=timezone.utc)
        return raw
    # ISO-8601 string
    s = str(raw).replace("Z", "+00:00")
    return datetime.fromisoformat(s)


def build_data_blob(entry: dict) -> dict:
    """Build the JSONB `data` column from the YAML entry.

    Everything except the columns stored directly on the recipes table
    goes into the JSONB blob.  This preserves the full original structure
    so nothing is lost.
    """
    top_level_cols = {"recipe_uuid", "recipe_name", "lastUpdated"}
    return {k: v for k, v in entry.items() if k not in top_level_cols}


async def migrate(yaml_path: str, owner_sub: str | None = None) -> None:
    path = Path(yaml_path)
    if not path.exists():
        print(f"ERROR: File not found: {path}")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        recipes = yaml.safe_load(f)

    if not isinstance(recipes, list):
        print("ERROR: Expected a YAML list of recipes.")
        sys.exit(1)

    owner_uuid = uuid.UUID(owner_sub) if owner_sub else None
    inserted = 0
    skipped = 0

    async with async_session() as session:
        for entry in recipes:
            recipe_id = uuid.UUID(str(entry["recipe_uuid"]))
            recipe_name = entry.get("recipe_name", "Unbenannt")
            updated_at = parse_last_updated(entry.get("lastUpdated"))
            data = build_data_blob(entry)

            # Upsert: insert or skip on conflict (idempotent)
            stmt = (
                pg_insert(Recipe)
                .values(
                    id=recipe_id,
                    recipe_name=recipe_name,
                    data=data,
                    created_by=owner_uuid,
                    updated_by=owner_uuid,
                    created_at=updated_at,
                    updated_at=updated_at,
                )
                .on_conflict_do_nothing(index_elements=["id"])
            )
            result = await session.execute(stmt)
            if result.rowcount:
                inserted += 1
                print(f"  + {recipe_name} ({recipe_id})")
            else:
                skipped += 1
                print(f"  ~ SKIP (exists): {recipe_name} ({recipe_id})")

        await session.commit()

        # Refresh search vectors for newly inserted rows
        await session.execute(text("""
            UPDATE recipes SET search_vector =
                setweight(to_tsvector('german', coalesce(recipe_name, '')), 'A') ||
                setweight(to_tsvector('german', coalesce(data->>'author', '')), 'B') ||
                setweight(to_tsvector('german', coalesce(data->>'notes', '')), 'C')
            WHERE search_vector IS NULL
        """))
        await session.commit()

    print(f"\nDone: {inserted} inserted, {skipped} skipped (already existed).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate cookbook.yaml → PostgreSQL")
    parser.add_argument("yaml_file", help="Path to cookbook.yaml")
    parser.add_argument("--owner", default=None, help="OIDC sub (UUID) of the recipe owner")
    args = parser.parse_args()
    asyncio.run(migrate(args.yaml_file, args.owner))


if __name__ == "__main__":
    main()
