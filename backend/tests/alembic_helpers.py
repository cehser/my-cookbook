"""Alembic-Konfiguration für Tests (ohne DB-Fixtures, damit Smoke-Tests sie nutzen können)."""

from pathlib import Path

from alembic.config import Config

BACKEND_DIR = Path(__file__).resolve().parents[1]


def alembic_config() -> Config:
    # Absolute Pfade, damit der Test unabhängig vom Arbeitsverzeichnis läuft
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return cfg
