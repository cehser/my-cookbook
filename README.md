# my-cookbook

Ein persönliches Kochbuch als Progressive Web App — selbst gehostet, offline-fähig, mit AI-Import.

## Features

- **PWA** — installierbar auf Handy und Desktop, funktioniert offline
- **Rezeptverwaltung** — erstellen, bearbeiten, suchen (Volltextsuche), Mengen umrechnen
- **AI-Import** — Rezepte aus Freitext, URLs oder Fotos per OpenAI extrahieren
- **Bilder** — Upload mit serverseitiger Optimierung (WebP, Thumbnails)
- **Share-Links** — Rezepte per Link teilen (zeitlich begrenzt, widerrufbar)
- **Favoriten & Tags** — Rezepte organisieren und filtern
- **Benutzerverwaltung** — Rollen (Admin, Editor, Readonly, Pending) via OIDC
- **Offline-Cache** — Rezepte und Bilder werden lokal in IndexedDB + Service Worker vorgehalten

## Tech-Stack

| Komponente | Technologie |
|------------|-------------|
| **Frontend** | Vue 3.5, Pinia, Vue Router 5, TypeScript, Vite 8, bootstrap-vue-next |
| **Backend** | Python 3.14, FastAPI, SQLAlchemy 2 (async), Alembic |
| **Datenbank** | PostgreSQL 16 |
| **Auth** | OIDC (Keycloak oder kompatibler IdP) |
| **AI** | OpenAI API (Chat Completions + Vision) |
| **Deployment** | Docker Compose (nginx + uvicorn + PostgreSQL) |

## Projektstruktur

```
my-cookbook/
├── .env                  # Zentrale Konfiguration (nicht eingecheckt)
├── .env.example          # Vorlage für .env
├── docker-compose.yml.example  # Vorlage Production-Setup (Kopie nicht eingecheckt)
├── scripts/
│   ├── deploy.sh         # Build mit Commit-Hash + Start
│   └── backup.sh         # DB-Backup mit Rotation
├── frontend/             # Vue 3 SPA
│   ├── Dockerfile        # Multi-Stage: Node Build → nginx
│   ├── src/
│   └── .docker/nginx/    # nginx-Config + Runtime-Config-Injection
├── backend/              # FastAPI REST-API
│   ├── Dockerfile        # Python 3.14-slim + Pillow
│   ├── app/              # Anwendungscode
│   ├── alembic/          # DB-Migrationen
│   └── prompts/          # AI System-Prompt (extern änderbar)
└── docs/                 # Planungsdokumente
```

## Schnellstart (Docker)

### 1. Repository klonen

```bash
git clone <repo-url>
cd my-cookbook
```

### 2. Konfiguration anlegen

```bash
cp .env.example .env
cp docker-compose.yml.example docker-compose.yml
```

Die `.env`-Datei bearbeiten:

```env
# OIDC-Provider (Pflicht)
OIDC_AUTHORITY=https://auth.example.com/realms/myrealm
OIDC_CLIENT_ID=my-cookbook

# Erster Admin (optional, siehe „Erster Admin“)
ADMIN_EMAIL=admin@example.com

# Datenbank
DB_NAME=cookbook
DB_USER=cookbook
DB_PASSWORD=ein-sicheres-passwort

# AI-Import (optional — leer lassen zum Deaktivieren)
OPENAI_API_KEY=sk-...

# CORS
CORS_ORIGINS=["https://cookbook.example.com"]
```

### 3. Starten

```bash
./scripts/deploy.sh
```

Das Skript übergibt den aktuellen Commit-Hash an den Frontend-Build (Anzeige im Profil) und startet per `docker compose up -d`.

Die App ist unter `http://localhost:8080` erreichbar. In Production einen Reverse-Proxy mit HTTPS davor schalten.

### 4. Datenbank-Migrationen

Das Backend führt ausstehende Alembic-Migrationen beim Start automatisch aus (`alembic upgrade head`). Schlägt eine Migration fehl, startet das Backend nicht; Ursache im Log (`docker compose logs backend`).

## Lokale Entwicklung

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Der Dev-Server startet auf `https://localhost:8080` (mit selbstsigniertem SSL für PWA/OIDC).

OIDC-Werte liest der Dev-Server aus `frontend/.env.local` (gitignored). Vorlage:

```bash
cp .env.example .env.local   # in frontend/, dann VITE_OIDC_AUTHORITY und VITE_OIDC_CLIENT_ID setzen
```

`public/config.js` ist im Dev-Server bewusst leer; im Container wird sie beim Start aus `OIDC_AUTHORITY`/`OIDC_CLIENT_ID` erzeugt.

Weitere Befehle:

| Befehl | Beschreibung |
|--------|-------------|
| `npm run build` | Production-Build |
| `npm run lint` | ESLint mit Auto-Fix |
| `npm run lint:check` | ESLint ohne Auto-Fix |
| `npm run preview` | Production-Build lokal vorschauen |

### Backend

Voraussetzung: [uv](https://docs.astral.sh/uv/). Abhängigkeiten sind in `backend/uv.lock` gepinnt, Python 3.14 holt uv bei Bedarf selbst. Auf Windows on ARM fehlt für `cryptography` ein Wheel; dort das x86_64-Python nutzen: `uv sync --python cpython-3.14-windows-x86_64-none`.

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Das Backend erwartet eine laufende PostgreSQL-Instanz (siehe `DB_*`-Variablen) und `OIDC_AUTHORITY` sowie `OIDC_CLIENT_ID` in der Umgebung; ohne beide startet es nicht.

| Befehl | Beschreibung |
|--------|-------------|
| `uv run pytest` | Smoke-Tests (ohne Datenbank und Netz) |
| `uv run ruff check` | Linter |
| `uv run ruff format` | Formatierer |
| `uv lock --upgrade-package <paket>` | Einzelnes Paket im Lock aktualisieren |

## Architektur

```
Browser ──→ nginx (:80)
              ├── /        → SPA (statische Dateien)
              └── /api/*   → FastAPI (:8000)
                               └── PostgreSQL (:5432)
```

- **nginx** liefert das Frontend aus und proxied `/api/`-Requests ans Backend
- **Runtime-Config:** OIDC-Einstellungen werden beim Container-Start per `envsubst` in `/config.js` injiziert — kein Rebuild bei Config-Änderung nötig
- **AI System-Prompt** liegt als Markdown-Datei im Docker-Volume `recipe_prompts` — änderbar ohne Rebuild

## API-Übersicht

Das Backend stellt eine REST-API unter `/api` bereit:

| Bereich | Endpunkte | Auth |
|---------|-----------|------|
| Health | `GET /health` | Nein |
| Rezepte | `GET /v1/recipes`, `GET /v1/recipes/{id}` | Readonly+ |
| | `POST /v1/recipes`, `PUT /v1/recipes/{id}`, `POST /v1/recipes/{id}/tags` | Editor+ |
| | `DELETE /v1/recipes/{id}` | Admin |
| Bilder | `GET /v1/recipes/{id}/images` | Readonly+ |
| | `POST /v1/recipes/{id}/images`, `DELETE /v1/recipes/{id}/images/{image_id}` | Editor+ |
| | `GET /v1/images/{id}`, `GET /v1/images/{id}/thumbnail` | Öffentlich |
| AI-Import | `POST /v1/ai/import`, `POST /v1/ai/import/image` | Editor+ |
| Favoriten | `GET /v1/favorites`, `POST/DELETE /v1/favorites/{recipe_id}` | Readonly+ |
| Tags | `GET /v1/tags` | Readonly+ |
| Share-Links | `GET /v1/shares/config`, `GET /v1/recipes/{id}/shares` | Readonly+ |
| | `POST /v1/recipes/{id}/share`, `DELETE /v1/shares/{id}` | Editor+ |
| | `GET /v1/shared/{token}` | Öffentlich |
| User | `GET /v1/me`, `GET/PUT /v1/me/settings` | Angemeldet (auch `pending`) |
| Admin | `GET /v1/admin/users`, `PUT /v1/admin/users/{id}/role` | Admin |
| | `GET/PUT /v1/admin/settings`, `GET /v1/admin/shares`, `DELETE /v1/admin/shares/{id}` | Admin |
| | `POST /v1/admin/migrate-images`, `/cleanup-images`, `/strip-image-ids` (Wartung) | Admin |

## Backup & Restore

### Backup erstellen

```bash
./scripts/backup.sh
```

Erstellt ein gezipptes SQL-Dump unter `./backups/` mit Zeitstempel. Automatische Rotation behält die letzten 30 Backups.

Für automatische Backups einen Cronjob einrichten:

```bash
# Täglich um 3:00 Uhr
0 3 * * * cd /path/to/my-cookbook && ./scripts/backup.sh
```

### Backup einspielen

```bash
gunzip -c backups/cookbook_20260405_030000.sql.gz | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

## Umgebungsvariablen

| Variable | Pflicht | Default | Beschreibung |
|----------|---------|---------|-------------|
| `OIDC_AUTHORITY` | Ja | — | URL des OIDC-Providers (kein Default; Backend startet ohne) |
| `OIDC_CLIENT_ID` | Ja | — | Client-ID der SPA beim IdP (kein Default; Backend startet ohne) |
| `ADMIN_EMAIL` | Nein | — | E-Mail des ersten Admins, siehe „Erster Admin“ |
| `DB_NAME` | Nein | `cookbook` | PostgreSQL-Datenbankname |
| `DB_USER` | Nein | `cookbook` | PostgreSQL-Benutzer |
| `DB_PASSWORD` | Ja | — | PostgreSQL-Passwort |
| `OPENAI_API_KEY` | Nein | — | OpenAI API-Key (leer = AI deaktiviert) |
| `CORS_ORIGINS` | Nein | `["http://localhost:8080"]` | Erlaubte Origins (JSON-Array) |

## OIDC-Konfiguration

Die App benötigt einen OIDC-kompatiblen Identity Provider (z.B. Keycloak):

1. Einen **Public Client** anlegen (SPA, keine Client-Secret)
2. **Redirect URI:** `https://cookbook.example.com/callback`
3. **Post-Logout Redirect URI:** `https://cookbook.example.com/`
4. **Web Origins:** `https://cookbook.example.com`
5. Optional: `offline_access`-Scope aktivieren (für Token-Refresh bei langer Nutzung)

Neue Benutzer erhalten automatisch die Rolle `pending` und müssen von einem Admin freigeschaltet werden.

## Erster Admin

Damit der erste Admin nicht per SQL gesetzt werden muss, `ADMIN_EMAIL` in der `.env` setzen und das Backend neu starten. Beim Login wird ein User zum `admin`, wenn seine E-Mail aus dem Access-Token (ohne Beachtung der Groß-/Kleinschreibung) mit `ADMIN_EMAIL` übereinstimmt **und** das Claim `email_verified` wahr ist. Das gilt auch für bereits angelegte User. Es wird nur heraufgestuft, nie herabgestuft.

Voraussetzung: Der Access-Token enthält `email` und `email_verified` (bei Keycloak über den Client-Scope `email`). Fehlt `email_verified`, passiert nichts. Nach dem ersten Login `ADMIN_EMAIL` wieder entfernen: Solange der Wert gesetzt ist, wird dieser User bei jedem Login erneut zum Admin, auch nach einer bewussten Herabstufung. Als Rettungsweg (Admin ausgesperrt) lässt er sich jederzeit wieder setzen.

## Lizenz

Privates Projekt.
