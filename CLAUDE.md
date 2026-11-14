# my-cookbook

## Zweck
Selbst gehostetes Familien-Kochbuch als PWA: Vue-3-SPA (offline-fähig) + FastAPI-Backend + PostgreSQL, OIDC-Login, AI-Import über OpenAI. Betrieb per Docker Compose hinter Reverse-Proxy. Repo auf GitHub. Überblick und Betrieb: [README.md](README.md).

## Befehle
Frontend (`cd frontend`):
- `npm ci` — Abhängigkeiten (richtet auch den husky-Hook ein)
- `npm run dev` — Dev-Server https://localhost:8080 (selbstsigniert)
- `npm run lint` / `npm run lint:check` — ESLint mit/ohne Fix
- `npm run typecheck` — `vue-tsc --noEmit`
- `npm run build` — Production-Build

Backend (`cd backend`, uv-Projekt mit `uv.lock`):
- `uv sync` — Umgebung inkl. Dev-Gruppe (pytest, ruff) aus dem Lock
- `uv run uvicorn app.main:app --reload --port 8000` — braucht PostgreSQL (`DB_*`); Migrationen laufen beim Start automatisch
- `uv run pytest` — Smoke-Tests ohne DB und Netz
- `uv run ruff check` / `uv run ruff format` — Linter / Formatierer
- `uv run alembic revision -m "<text>"` — neue Migration
- `uv lock --upgrade-package <paket>` — gezieltes Update, Majors je eigener Commit

Betrieb (Repo-Root, `docker-compose.yml` aus `.example` kopiert):
- `./scripts/deploy.sh` — Build mit Commit-Hash + `docker compose up -d`
- `./scripts/backup.sh [dir]` — `pg_dump` als `.sql.gz`, behält 30

## Verifikation
- Frontend: `npm run lint:check && npm run typecheck && npm run build`. Der Pre-Commit-Hook prüft nur lint-staged und typecheck.
- Backend: `uv sync --frozen && uv run ruff check && uv run ruff format --check && uv run pytest`. Bei Änderungen an Abhängigkeiten, Dockerfile oder Migrationen zusätzlich Container bauen und starten (`docker compose build backend && docker compose up -d`), im Log die erfolgreiche Migration prüfen, `GET /api/health`. Keine DB-Integrationstests (Roadmap W.5).
- Keine CI (Roadmap W.5).

## Konventionen
- Frontend-Regeln: [docs/DEVELOPMENT-GUIDELINES.md](docs/DEVELOPMENT-GUIDELINES.md) (script setup, Pinia, strict TS, Named Exports, per ESLint durchgesetzt).
- API unter `/api/v1/…` (FastAPI `root_path="/api"`, nginx proxied `/api/`). Rollen: `pending` < `readonly` < `editor` < `admin`.
- AI-System-Prompt: `backend/prompts/system_prompt.md`, liegt im Image (kein Volume), Änderung per Deploy.
- Commit-Bereiche: `frontend`, `backend`, `db`, `auth`, `pwa`, `images`, `ai`, `build`, `deploy`, `roadmap`.

## Branches
- `main` = Produktionsstand, deployt wird von `main`.
- Arbeit in Worktree-Branches (`claude -w <ID>-<stichwort>`), Merge nach `main` nur auf Anfrage.

## Arbeitsablauf
- Roadmap: [ROADMAP.md](ROADMAP.md)
- Aufträge: `docs/tasks/`
- Pläne und Specs: `docs/plans/`
- Ideen ohne Zuschnitt: [docs/IDEAS.md](docs/IDEAS.md)
