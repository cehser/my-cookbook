# Bericht W.5: CI mit GitHub Actions, Migrations-Test gegen PostgreSQL

> Branch `worktree-W.5-ci` · Basis `cad08e8` (Auftrag nennt `58686bc`, dazwischen nur `docs(roadmap)`) · Stand `d0818e9` · 2026-11-15 · Dauer: 00:25 – 00:36 (11 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
`.github/workflows/ci.yml` prüft bei Push auf `main` und bei Pull Requests Frontend, Backend, DB-Tests (PostgreSQL 16) und beide Image-Builds. Neue DB-Tests in `backend/tests/db/` decken Migrationen (upgrade, downgrade base, upgrade), Rezept-API und `/me` ab. Das Frontend-Dockerfile baut ohne `--legacy-peer-deps`. Noch nicht auf GitHub gelaufen.

## Commits
- `6af09a3` build(frontend): --legacy-peer-deps im Dockerfile entfernen
- `74edd49` test(db): DB-Tests für Migrationen, Rezept-API und /me
- `a526002` ci: GitHub-Actions-Workflow für Frontend, Backend, DB-Tests und Images
- `d0818e9` docs(ci): Verifikation, Regeln und README auf CI umgestellt

## Verifikation
- Frontend: `npm ci` (ohne Flag), `lint:check` (0 Fehler, 1 Warnung in `AIRecipeImport.vue:375`, bestand schon), `typecheck`, `build`, `npm audit --audit-level=high` (Exit 0; 12 Funde low/moderate) → grün
- Backend: `uv sync --frozen`, `ruff check`, `ruff format --check` → grün; `pytest` ohne DB → 64 passed, 5 skipped
- DB-Tests gegen `postgres:16-alpine` (Container): `pytest -m db` → 5 passed, auch mit `CI=true`; `pytest -m "not db"` mit `CI=true` ohne DB → 64 passed
- `docker build --pull frontend` und `backend` → beide Exit 0
- `actionlint` (per `uvx --from actionlint-py`, nur ephemer) → ohne Befund
- Alle Actions per SHA gepinnt: `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0, `astral-sh/setup-uv` v10.3.3 (Versionen per `git ls-remote --tags` ermittelt; keine `docker/*`-Actions, nur `docker build`)
- Sichtprüfung: keine
- Prüfzeit: ~8 min; größter Posten: `npm ci` plus Docker-Builds
- Prüfskripte: nur Scratchpad

## Struktur und Doku
- Neue Dateien: `tests/db/conftest.py` (~115 Zeilen), `test_api.py` (~100), `test_migrations.py` (~50); kein bewusstes Duplikat
- CLAUDE.md (Verifikation) und `.claude/rules/frontend.md` nachgetragen; README um Badge und `-m db`-Zeile ergänzt. Die Rules `backend-tooling.md` und `backend-db.md` stimmen noch; ein Hinweis auf `tests/db/` dort wäre möglich, liegt nicht im Auftrag.

## Abweichungen vom Auftrag
- **`/me`-Test:** Der Auftrag nennt `get_current_user` überschrieben und zugleich „`/me` legt einen neuen User an“. Beides geht nicht gleichzeitig. Rezepttests überschreiben `get_current_user` (User liegt in der DB, wegen FK), der `/me`-Test ersetzt nur `verify_oidc_token` und prüft so den echten User-Anlegepfad.
- **Zusatzschutz:** DB-Tests laufen nur mit `DB_HOST` und `DB_NAME` mit Präfix `test`, weil sie das Schema leeren. In der CI (`CI=true`) ist Überspringen ein Fehler, damit eine falsch konfigurierte DB nicht still grün bleibt. Deshalb führt der Job `backend` `pytest -m "not db"` aus.
- **Migrationstest startet mit geleertem Schema** (`DROP SCHEMA public CASCADE`), nicht mit `downgrade base`: Downgrade 006 scheitert, sobald Nutzer mit Rolle `pending` existieren (Constraint ohne `pending`). Das ist erwartetes Verhalten, kein Migrationsfehler; die Downgrades laufen auf leerer DB bis `base` durch.
- Workflow zusätzlich: `concurrency` (laufende Läufe pro Ref abbrechen), `persist-credentials: false`. `OIDC_AUTHORITY`/`OIDC_CLIENT_ID` stehen als Dummy-Werte im Workflow, wie gefordert.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Erst nach dem Push sichtbar:** erster CI-Lauf auf GitHub (Runner-Verhalten von `setup-node` mit Node 26, `setup-uv`-Cache, Service-Container, Badge). Branch-Schutz/Required Checks stellst du selbst ein.
- **Hinweis auf `uv run pytest`-Warnungen:** `SADeprecationWarning` für `.distinct(RecipeImage.recipe_id)` in `routes/recipes.py:207` (auf `postgresql.distinct_on` umstellen) und Alembic-Warnung `path_separator` in `alembic.ini`. Aufwand XS.
- **Lint-Warnung** `AIRecipeImport.vue:375` (prettier) per `npm run lint` beheben. Aufwand XS.
- **Smoke-Test für `_process_image`** (Folgepunkt aus W.4) nicht Teil des Auftrags und nicht gemacht. Aufwand S.

## Status je Roadmap-Punkt
- `W.5` fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.5 CI mit GitHub Actions, Migrations-Test gegen PostgreSQL · 2026-11-15 · d0818e9`
