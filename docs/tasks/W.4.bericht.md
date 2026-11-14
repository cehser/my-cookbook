# Bericht W.4: Backend auf uv, Lock, ruff, Smoke-Tests

> Branch `worktree-W.4-backend-uv` · Basis `78f8f63` (+ `d101f5f` docs(roadmap)) · Stand `0c0f76d` · 2026-11-14 · Dauer: 15:47 – 16:04 (17 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Das Backend baut reproduzierbar aus `pyproject.toml` + `uv.lock` (Python 3.14, uv 0.13.8 im Image). ruff ist konfiguriert, der Code ist formatiert und `ruff check` läuft sauber. 64 Smoke-Tests laufen ohne DB und Netz: 63 bestanden, 1 xfail für den bekannten Tags-Doppelhandler aus W.1. Alle vier Majors sind gehoben: cryptography 50, Pillow 13, SQLAlchemy 2.1 und openai 3. `ai.py` blieb dabei unverändert.

### Lock-Versionen

| Paket | Lock-Basis | Endstand | Major |
|---|---|---|---|
| fastapi | 0.162.7 | 0.162.7 | – |
| uvicorn[standard] | 0.54.0 | 0.54.0 | – |
| sqlalchemy[asyncio] | 2.0.57 | 2.1.8 | erledigt |
| asyncpg | 0.32.0 | 0.32.0 | – |
| alembic | 1.20.1 | 1.20.1 | – |
| pyjwt | 2.15.1 | 2.15.1 | – |
| cryptography | 46.0.7 | 50.0.2 | erledigt |
| pydantic | 2.14.3 | 2.14.3 | – |
| pydantic-settings | 2.16.3 | 2.16.3 | – |
| Pillow | 12.3.0 | 13.0.0 | erledigt |
| openai | 2.54.0 | 3.51.0 | erledigt, ohne Änderung an `ai.py` |
| PyYAML | 6.0.3 | 6.0.3 | – |
| python-multipart | 0.0.33 | 0.0.33 | – |
| httpx | 0.28.1 | 0.28.1 | – |
| pytest (dev) | 9.2.0 | 9.2.0 | – |
| ruff (dev) | 0.17.5 | 0.17.5 | – |

Zurückgestellte Majors: keine.

## Commits
- `99ef5a9` build(backend): Backend auf uv-Projekt mit Lock und Smoke-Tests umstellen
- `8d70190` build(backend): Image mit uv aus dem Lock bauen
- `fb64565` build(backend): ruff konfigurieren
- `1d1722d` chore(backend): ruff check --fix und ruff format anwenden
- `3a78793` chore(backend): verbleibende ruff-Funde begründet ausnehmen
- `1daed13` build(backend): cryptography auf 50 heben
- `cb02042` build(backend): Pillow auf 13 heben
- `747aef4` build(backend): SQLAlchemy auf 2.1 heben
- `af107ed` build(backend): openai auf 3 heben
- `d62580b` docs(backend): uv, pytest und ruff in CLAUDE.md, README und Regeln
- `0c0f76d` docs(backend): Lock-Stand nach W.4 im Abhängigkeitsplan nachtragen

## Verifikation
- `uv sync --frozen` → ok (48 Pakete)
- `uv run ruff check` → All checks passed; `uv run ruff format --check` → 45 files already formatted
- `uv run pytest` → 63 passed, 1 xfailed in 0.81 s
- `docker compose build backend` mit einem Wegwerf-Compose (frische PostgreSQL 16) → Build ok. Im Log laufen die Migrationen 001 → 006 durch, `GET /api/health` → 200 `{"status":"ok","database":"connected"}`, `GET /api/v1/recipes` ohne Token → 401. Das Compose lag im Scratchpad, weil das echte `docker-compose.yml` eine `.env` braucht.
- Manuelle Probe für SQLAlchemy 2.1 gegen PostgreSQL 16 (FastAPI 0.162 lief mit):
  - Migrationen und User-Provisionierung (`get_or_create_user`, Neuanlage und Sync)
  - Rezept-CRUD, Volltextsuche, Tag-Filter, Tags, Favoriten
  - Share anlegen, öffentlich abrufen und löschen
  - Admin-Settings und -Users, `/me`, `/me/settings`
  - Ergebnis: alle Status wie erwartet
- Pillow 13: `_process_image` mit JPEG, PNG (RGBA), GIF (P) und WEBP manuell geprüft, Größen 400 px und 1200 px stimmen.
- cryptography 50: PyJWT signiert und prüft RS256 und ES256.
- openai 3:
  - Signaturen von `responses.create` und `chat.completions.create`, der Tool-Typ `web_search_preview` und `Response.output_text` sind geprüft.
  - Im Image funktioniert TLS gegen api.openai.com (401 mit ungültigem Key, kein SSL-Fehler).
  - Ein echter AI-Import (Text, URL, Foto) ist ungetestet, weil kein Key vorliegt.
- Frontend-Verifikation entfällt, das Frontend ist unberührt.
- Sichtprüfung: Diff des Format-Commits auf inhaltliche Änderungen durchgesehen. Entfernt wurden nur ungenutzte Imports und ein lokal neu importiertes `Tag`/`RecipeTag` in `shares.py`. Die übrigen Änderungen sind pyupgrade-Ersetzungen.
- Prüfzeit: ~1 min für die Schlussverifikation; größter Posten war Image-Build und Compose-Start (~16 s).
- Prüfskripte: Integrationsprobe und Compose nur im Scratchpad (`dbcheck.py`, `compose.w4.yml`).

## Struktur und Doku
- Neue Module: `backend/tests/` mit `conftest.py`, `test_app.py`, `test_auth.py` und `test_health.py`, alle unter 100 Zeilen. Keine Duplikate.
- CLAUDE.md: „Befehle“ und „Verifikation“ nachgetragen. README: „Lokale Entwicklung → Backend“ nachgetragen.
- Neu: `.claude/rules/backend-tooling.md` mit der Windows-ARM-Falle, dem Test-Muster, dem FastAPI-Routenbaum, der isort-Einstellung und dem Update-Vorgehen.

## Abweichungen vom Auftrag
- **`.gitignore`:** zusätzlich `__pycache__/`. Ohne den Eintrag wäre Bytecode im ersten Commit gelandet.
- **Lokale Python-Umgebung:** `cryptography` hat kein `win_arm64`-Wheel, `uv sync` mit dem ARM-Python baut aus dem Quellcode und scheitert. Lokal läuft deshalb das x86_64-CPython 3.14 (in der Regeldatei dokumentiert). `.python-version` bleibt `3.14`, der Container ist nicht betroffen.
- **Routen-Inventar:** Seit FastAPI 0.137 liefert `app.routes` eingebundene Router als Baum (`_IncludedRouter`). Die Tests nutzen deshalb die dafür vorgesehene API `fastapi.routing.iter_route_contexts`.
- **Zusätzliche Tests:**
  - `/v1/me` liefert für jede Rolle 200.
  - Eine Matrix prüft `require_readonly`, `require_editor` und `require_admin` gegen alle Rollen, also auch die positive Richtung ohne DB.
- **ruff-Konfiguration über `E,F,I,UP,B` hinaus:**
  - `extend-immutable-calls` für FastAPI-`Depends` u. a. (69 × B008)
  - isort `known-third-party = ["alembic"]`, weil der Ordner `backend/alembic/` sonst als First-Party einsortiert wird
  - `per-file-ignores`: F401 in `scripts/` (bewusster Seiteneffekt-Import), E501 in `alembic/versions/` (Migrationen sind Historie)
  - B904 an zwei Stellen per `noqa`, weil `raise … from` eine Verhaltensänderung wäre
- **Commit-Aufteilung:** Die ruff-Konfiguration ist ein eigener Commit vor dem Format-Commit. Der Format-Commit enthält nur die Ausgabe von `ruff check --fix`/`ruff format` sowie die Verschiebung eines Kommentars in `alembic/env.py`, den die Import-Sortierung vom Modellblock gelöst hatte.

## Nachgetragen in Specs/Plänen
- `docs/plans/abhaengigkeiten.md`: Lock-Stand nach W.4

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **`root_path`-Deprecation:** FastAPI 0.162 warnt `FastAPIDeprecationWarning: The root_path parameter is deprecated` (`app/main.py`). Die Funktion ist intakt, Tests und Container laufen mit `/api`-Präfix. Vorschlag: auf `uvicorn --root-path /api` umstellen und mit den Smoke-Tests absichern. Aufwand S.
- **AI-Import nach Deploy testen:** Text, URL (Responses API mit `web_search_preview`) und Foto mit echtem Key prüfen, weil openai 3 hier nur ohne Live-Aufruf geprüft ist. Danach W.12 ohne SDK-Umbau.
- **Für W.5:** Die Integrationsprobe aus dem Scratchpad ist eine fertige Vorlage für DB-Tests (Overrides und Abfolge der Routen). Dazu ein Smoke-Test für `_process_image`. Aufwand S, innerhalb von W.5.
- **Image verschlanken:** Die apt-Pakete `libjpeg62-turbo-dev`/`libwebp-dev` sind mit den manylinux-Wheels von Pillow vermutlich überflüssig. Unbestätigt, Aufwand S.
- **Migrationslog:** Die Zeile „Database migrations applied successfully.“ erscheint nicht im Log, weil der App-Logger nicht konfiguriert ist. Nur Alembics eigene Zeilen sind sichtbar. Vorschlag mit Logging-Konfiguration, Aufwand S.
- **B904:** zwei Stellen (`auth/dependencies.py`, `routes/images.py`) auf `raise … from` umstellen. Kleiner Aufräumpunkt, Aufwand XS.

## Status je Roadmap-Punkt
- `W.4` fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.4 Backend auf uv, Lock, ruff, Smoke-Tests · 2026-11-14 · 0c0f76d`
