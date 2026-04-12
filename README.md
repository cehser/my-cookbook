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
├── docker-compose.yml    # Production-Setup (Frontend + Backend + DB)
├── scripts/
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
```

Die `.env`-Datei bearbeiten:

```env
# OIDC-Provider (Pflicht)
OIDC_AUTHORITY=https://auth.example.com/realms/myrealm
OIDC_CLIENT_ID=my-cookbook

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
docker compose up -d
```

Die App ist unter `http://localhost:8080` erreichbar. In Production einen Reverse-Proxy mit HTTPS davor schalten.

### 4. Datenbank-Migrationen

Beim ersten Start oder nach Updates:

```bash
docker compose exec backend alembic upgrade head
```

## Lokale Entwicklung

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Der Dev-Server startet auf `https://localhost:5173` (mit selbstsigniertem SSL für PWA/OIDC).

Weitere Befehle:

| Befehl | Beschreibung |
|--------|-------------|
| `npm run build` | Production-Build |
| `npm run lint` | ESLint mit Auto-Fix |
| `npm run lint:check` | ESLint ohne Auto-Fix |
| `npm run preview` | Production-Build lokal vorschauen |

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Das Backend erwartet eine laufende PostgreSQL-Instanz (siehe `DB_*`-Variablen).

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
| Rezepte | `GET/POST /v1/recipes`, `GET/PUT/DELETE /v1/recipes/{id}` | Editor+ |
| Bilder | `POST /v1/recipes/{id}/images`, `GET /v1/images/{id}` | Editor+ / Öffentlich |
| AI-Import | `POST /v1/ai/import`, `POST /v1/ai/import/image` | Editor+ |
| Favoriten | `GET/POST/DELETE /v1/favorites` | Readonly+ |
| Tags | `GET /v1/tags` | Readonly+ |
| Share-Links | `POST /v1/recipes/{id}/share`, `GET /v1/shared/{token}` | Editor+ / Öffentlich |
| User | `GET /v1/me`, `PUT /v1/me/settings` | Auth |
| Admin | `GET /v1/admin/users`, `PUT /v1/admin/users/{id}/role` | Admin |

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
gunzip -c backups/cookbook_20260405_030000.sql.gz | docker compose exec -T db psql -U cookbook cookbook
```

## Umgebungsvariablen

| Variable | Pflicht | Default | Beschreibung |
|----------|---------|---------|-------------|
| `OIDC_AUTHORITY` | Ja | — | URL des OIDC-Providers |
| `OIDC_CLIENT_ID` | Ja | — | Client-ID der SPA beim IdP |
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

## Lizenz

Privates Projekt.
