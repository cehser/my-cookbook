# Auftrag W.4: Backend auf uv, Lock, ruff, Smoke-Tests

> Erstellt 2026-11-14 vom Master · Roadmap: `ROADMAP.md` Punkt W.4 · Basis: `main@78f8f63` · Aufwand: M · Modell: Opus

## Ziel
Das Backend baut reproduzierbar aus `pyproject.toml` und `uv.lock`, statt bei jedem Build die neuesten Versionen zu ziehen. Es gibt einen Linter (ruff) und Smoke-Tests (pytest), die ohne Datenbank laufen. Major-Updates kommen einzeln und nachvollziehbar. DB-gestützte Integrationstests und CI sind nicht Teil dieses Auftrags (W.5).

## Erst lesen
1. `docs/plans/abhaengigkeiten.md` – Abschnitt „Backend (gehört zu W.4)“ und Entscheidung zur Lock-Basis
2. `backend/requirements.txt`, `backend/Dockerfile`
3. `backend/app/main.py` – Migrationen im `lifespan`
4. `backend/app/auth/dependencies.py`, `auth/oidc.py` – Rollenprüfung und JWT-Validierung
5. `backend/app/routes/ai.py` – nutzt OpenAI Chat Completions und Responses API mit `web_search_preview`

## Auftrag
1. **uv-Projekt:**
   - `backend/pyproject.toml` mit `requires-python = ">=3.14,<3.15"` und `.python-version` (3.14).
   - Laufzeit-Abhängigkeiten aus `requirements.txt` übernehmen (Extras `uvicorn[standard]`, `sqlalchemy[asyncio]` beibehalten).
   - Dev-Gruppe: `pytest`, `ruff`. Weitere Pakete nur nach Rückfrage; für async-Tests das `anyio`-Plugin nutzen (kommt über Starlette mit, kein `pytest-asyncio`).
   - `requirements.txt` löschen.
2. **Lock-Basis:** neueste Version je bisheriger Major-Linie: `openai<3`, `Pillow<13`, `cryptography<47`, `sqlalchemy<2.1`. Alle übrigen (0.x-Pakete eingeschlossen) auf den neuesten Stand. `uv lock`, Smoke-Tests grün → Commit.
3. **Dockerfile:**
   - uv aus dem offiziellen Image mit fester Version kopieren.
   - `uv sync --frozen --no-dev`, Start über die Projekt-Umgebung.
   - Base-Image bleibt `python:3.14-slim`.
   - Layer-Reihenfolge so, dass Abhängigkeiten gecacht werden.
4. **ruff:**
   - Konfiguration in `pyproject.toml` (Zielversion 3.14, moderater Regelsatz wie `E,F,I,UP,B`).
   - `ruff check --fix` und `ruff format` über `backend/` als **eigener Commit** ohne inhaltliche Änderungen.
   - Danach `ruff check` sauber; verbleibende Funde begründet per `noqa` oder in der Config.
5. **Smoke-Tests** (`backend/tests/`), ohne Datenbank und ohne Netz:
   - App importiert, OpenAPI-Schema baut.
   - Routen-Inventar: jede Route aus der API-Tabelle der README ist registriert. Den doppelten Handler `GET /v1/tags` (W.1) nur als bekannten Befund markieren (`xfail`), nicht beheben.
   - Auth: ohne Token 401; mit überschriebenem `get_current_user` je Rolle (`pending`, `readonly`, `editor`, `admin`) die erwarteten 403 an je einer Route pro Stufe.
   - `health` mit überschriebenem `get_db`.
6. **Majors einzeln**, je ein Commit, nach jedem Smoke-Tests und `ruff check`:
   - `cryptography` (bis 50), `Pillow` 13, `SQLAlchemy` 2.1.
   - `openai` 3 **nur**, wenn `ai.py` dafür nicht geändert werden muss. Sonst bei 2.x bleiben und die nötigen Änderungen im Bericht für W.12 beschreiben.
   - Bricht ein anderer Major etwas, das sich nicht in wenigen Zeilen beheben lässt: zurücknehmen und im Bericht begründen.
7. **Doku:**
   - Projekt-CLAUDE.md, Abschnitte „Befehle“ und „Verifikation“: `uv sync`, `uv run uvicorn …`, `uv run pytest`, `uv run ruff check`.
   - README, Abschnitt „Lokale Entwicklung → Backend“ entsprechend.
   - `.gitignore` um `.venv/` ergänzen.

## Ablage
- Neu: `backend/pyproject.toml`, `backend/uv.lock`, `backend/.python-version`, `backend/tests/` (`conftest.py`, Testmodule)
- Geändert: `backend/Dockerfile`, `CLAUDE.md`, `README.md`, `.gitignore`; Formatänderungen in `backend/**/*.py`

## Nicht in diesem Auftrag
- Fachliche Codeänderungen, auch der Tags-Doppelhandler (W.1) und `ai.py` (W.12)
- DB-Integrationstests, CI (W.5)
- `docker-compose.yml.example`, Frontend (W.14 und W.11 laufen parallel)
- Die Migrationsskripte unter `backend/scripts/` entfallen mit W.8: nur formatieren, nicht anpassen

## Entscheidungen, die ich treffe
- keine. Neue Abhängigkeiten `pytest` und `ruff` sind freigegeben, uv als Werkzeug ebenso.

## Fallstricke
- Der `lifespan` führt Alembic-Migrationen aus. Tests dürfen ihn nicht starten: `httpx.AsyncClient` mit `ASGITransport` statt `TestClient` als Context-Manager.
- `app.database` erzeugt die Engine beim Import. Das ist unkritisch, weil sie erst bei der ersten Abfrage verbindet; Tests dürfen keine Abfrage ohne Override auslösen.
- `get_current_user` legt unbekannte User in der DB an. In Tests immer überschreiben.
- FastAPI springt von 0.135 auf 0.16x, in 0.x sind Breaking Changes in Minor-Versionen möglich. Die Smoke-Tests sind die Absicherung, im Zweifel Changelog lesen.
- Alembic findet `alembic.ini` relativ zum Arbeitsverzeichnis `/app`. Das WORKDIR im Dockerfile nicht ändern.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `uv sync --frozen` und `uv run pytest` grün, `uv run ruff check` und `ruff format --check` sauber
- `docker compose build backend` erfolgreich. Container startet, Log zeigt erfolgreiche Migration, `GET /api/health` → 200 (falls Docker und DB verfügbar, sonst im Bericht vermerken)
- Bericht nennt je Paket Lock-Version und erledigte bzw. zurückgestellte Majors
- Verifikation gemäß Projekt-CLAUDE.md (nach deren Aktualisierung)
