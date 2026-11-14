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
- **root_path:** `FastAPI(root_path="/api")` ist deprecated, bleibt aber, die Warnung ist in `main.py` gezielt unterdrückt. `uvicorn --root-path /api` erwartet ein Proxy, das das Präfix entfernt (App läge unter `/health`, geprüft im Container mit uvicorn 0.54); nginx reicht `/api/` mit Präfix durch. Ablösen nur zusammen mit `proxy_pass http://backend:8000/;` in `prod.conf` und Anpassung der Tests (`ASGITransport(root_path=...)`).
- **Logging:** `alembic/env.py` ruft `fileConfig` auf; ohne `disable_existing_loggers=False` würde das den Logger `app` stumm schalten. Der Handler für `app` hängt in `main.py`.
- **openai ≥ 3** nutzt HTTPX2 mit dem OS-Trust-Store statt certifi. Das Image braucht `ca-certificates` (in `python:3.14-slim` enthalten).
