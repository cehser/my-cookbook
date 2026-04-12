"""Normalize recipe data: dynamic keys → fixed keys.

Ingredients:  {"Rosinen": {"amounts": [...]}, "section": ""}
           → {"name": "Rosinen", "amounts": [...], "section": ""}

Yields:       {"Portionen": 4}
           → {"unit": "Portionen", "value": 4}

Revision ID: 005_normalize_recipe_data
Revises: 004_site_settings
"""

from alembic import op

revision = "005_normalize_recipe_data"
down_revision = "004_site_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- 1. Normalize ingredients: dynamic key → "name" field ---
    op.execute(r"""
        UPDATE recipes
        SET data = jsonb_set(
            data,
            '{ingredients}',
            (
                SELECT COALESCE(jsonb_agg(
                    CASE
                        -- Already migrated (has "name" key) → keep as-is
                        WHEN ing ? 'name' THEN ing
                        ELSE (
                            SELECT jsonb_build_object(
                                'name', dyn.key,
                                'amounts', COALESCE(dyn.value -> 'amounts', '[]'::jsonb),
                                'notes', COALESCE(dyn.value -> 'notes', '[]'::jsonb),
                                'processing', COALESCE(dyn.value -> 'processing', '[]'::jsonb),
                                'substitutions', COALESCE(dyn.value -> 'substitutions', '[]'::jsonb),
                                'section', COALESCE(ing -> 'section', '""'::jsonb)
                            )
                            FROM jsonb_each(ing) AS dyn
                            WHERE dyn.key != 'section'
                            LIMIT 1
                        )
                    END
                ), '[]'::jsonb)
                FROM jsonb_array_elements(data -> 'ingredients') AS ing
            )
        )
        WHERE data ? 'ingredients'
          AND jsonb_array_length(data -> 'ingredients') > 0;
    """)

    # --- 2. Normalize yields: {"Portionen": 4} → {"unit": "Portionen", "value": 4} ---
    op.execute(r"""
        UPDATE recipes
        SET data = jsonb_set(
            data,
            '{yields}',
            (
                SELECT COALESCE(jsonb_agg(
                    CASE
                        -- Already migrated (has "unit" key) → keep as-is
                        WHEN yld ? 'unit' THEN yld
                        ELSE (
                            SELECT jsonb_build_object(
                                'unit', kv.key,
                                'value', CASE
                                    WHEN jsonb_typeof(kv.value) = 'number' THEN kv.value
                                    WHEN jsonb_typeof(kv.value) = 'string' THEN
                                        to_jsonb(NULLIF(kv.value #>> '{}', '')::numeric)
                                    ELSE kv.value
                                END
                            )
                            FROM jsonb_each(yld) AS kv
                            LIMIT 1
                        )
                    END
                ), '[]'::jsonb)
                FROM jsonb_array_elements(data -> 'yields') AS yld
            )
        )
        WHERE data ? 'yields'
          AND jsonb_typeof(data -> 'yields') = 'array'
          AND jsonb_array_length(data -> 'yields') > 0;
    """)

    # --- 3. Coerce string amounts to numbers in ingredients ---
    op.execute(r"""
        UPDATE recipes
        SET data = jsonb_set(
            data,
            '{ingredients}',
            (
                SELECT COALESCE(jsonb_agg(
                    CASE
                        WHEN (ing -> 'amounts' -> 0 ->> 'amount') IS NOT NULL
                             AND jsonb_typeof(ing -> 'amounts' -> 0 -> 'amount') = 'string'
                        THEN jsonb_set(
                            ing,
                            '{amounts,0,amount}',
                            CASE
                                WHEN (ing -> 'amounts' -> 0 ->> 'amount') = '' THEN 'null'::jsonb
                                ELSE to_jsonb((ing -> 'amounts' -> 0 ->> 'amount')::numeric)
                            END
                        )
                        ELSE ing
                    END
                ), '[]'::jsonb)
                FROM jsonb_array_elements(data -> 'ingredients') AS ing
            )
        )
        WHERE data ? 'ingredients'
          AND jsonb_array_length(data -> 'ingredients') > 0;
    """)


def downgrade() -> None:
    # --- Revert ingredients: "name" field → dynamic key ---
    op.execute(r"""
        UPDATE recipes
        SET data = jsonb_set(
            data,
            '{ingredients}',
            (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        ing ->> 'name',
                        jsonb_build_object(
                            'amounts', COALESCE(ing -> 'amounts', '[]'::jsonb),
                            'notes', COALESCE(ing -> 'notes', '[]'::jsonb),
                            'processing', COALESCE(ing -> 'processing', '[]'::jsonb),
                            'substitutions', COALESCE(ing -> 'substitutions', '[]'::jsonb)
                        ),
                        'section', COALESCE(ing -> 'section', '""'::jsonb)
                    )
                ), '[]'::jsonb)
                FROM jsonb_array_elements(data -> 'ingredients') AS ing
            )
        )
        WHERE data ? 'ingredients'
          AND jsonb_array_length(data -> 'ingredients') > 0;
    """)

    # --- Revert yields: {"unit": "Portionen", "value": 4} → {"Portionen": 4} ---
    op.execute(r"""
        UPDATE recipes
        SET data = jsonb_set(
            data,
            '{yields}',
            (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(yld ->> 'unit', yld -> 'value')
                ), '[]'::jsonb)
                FROM jsonb_array_elements(data -> 'yields') AS yld
            )
        )
        WHERE data ? 'yields'
          AND jsonb_typeof(data -> 'yields') = 'array'
          AND jsonb_array_length(data -> 'yields') > 0;
    """)
