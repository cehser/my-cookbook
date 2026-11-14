---
paths:
  - backend/pyproject.toml
  - backend/uv.lock
  - backend/Dockerfile
  - backend/tests/**
---

# Backend: uv, Tests, ruff

- **Windows on ARM:** `cryptography` hat kein `win_arm64`-Wheel, `uv sync` mit dem ARM-Python baut aus dem Quellcode und scheitert. Lokal das x86_64-CPython nehmen: `uv sync --python cpython-3.14-windows-x86_64-none`. Der Container (Linux) ist nicht betroffen.
- **Tests ohne lifespan:** `httpx.AsyncClient` mit `ASGITransport` (Fixture `client`), nie `TestClient` als Context-Manager – der `lifespan` würde Alembic-Migrationen starten. Requests mit Präfix `/api` wie hinter nginx.
- **Overrides:** `get_current_user` immer überschreiben (legt sonst User in der DB an), `get_db` durch `FakeSession` (Fixtures `as_role`, `override_db` in `tests/conftest.py`).
- **Routen aufzählen:** Seit FastAPI 0.137 enthält `app.routes` eingebundene Router als Baum. Flach über `fastapi.routing.iter_route_contexts(app.routes)`.
- **ruff/isort:** `alembic` ist als Third-Party konfiguriert, weil der Ordner `backend/alembic/` es sonst als First-Party einsortiert.
- **Updates:** Majors einzeln per `uv lock --upgrade-package <paket>` nach Anheben der Untergrenze in `pyproject.toml`, je ein Commit mit Smoke-Tests und `ruff check`.
- **openai ≥ 3** nutzt HTTPX2 mit dem OS-Trust-Store statt certifi. Das Image braucht `ca-certificates` (in `python:3.14-slim` enthalten).
