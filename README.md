# my-cookbook

[![CI](https://github.com/cehser/my-cookbook/actions/workflows/ci.yml/badge.svg)](https://github.com/cehser/my-cookbook/actions/workflows/ci.yml)

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
| **AI** | OpenAI API (Responses API, Structured Outputs, Websuche) |
| **Deployment** | Docker Compose (nginx + uvicorn + PostgreSQL), Images aus ghcr.io |

## Projektstruktur

```
my-cookbook/
├── .env                  # Zentrale Konfiguration (nicht eingecheckt)
├── .env.example          # Vorlage für .env
├── docker-compose.yml.example  # Vorlage Production-Setup (Kopie nicht eingecheckt)
├── docker-compose.build.yml    # Override: lokal aus dem Quellcode bauen
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
│   └── prompts/          # AI System-Prompt (liegt im Image)
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
docker compose pull && docker compose up -d
```

Frontend und Backend kommen als fertige Images aus der GitHub Container Registry (`ghcr.io/cehser/my-cookbook-frontend`, `…-backend`). Die CI baut sie nach jedem grünen Lauf auf `main` und taggt sie mit dem kurzen Commit-SHA und `main`. Die Images sind instanzneutral: OIDC-Werte, Domains und Geheimnisse kommen zur Laufzeit aus der `.env`.

**Update:** derselbe Befehl. `pull` ist nötig, weil `docker compose up -d` ein vorhandenes Tag `main` nicht neu zieht; mit neuem Image erzeugt Compose die Container selbst neu.

**Rollback:** auf einen älteren Stand per Commit-SHA (7 Zeichen, siehe Commit-Historie oder Paketseite auf GitHub):

```bash
export IMAGE_TAG=abc1234
docker compose pull && docker compose up -d
```

Die Variable gilt nur in dieser Shell; ein späteres `up` ohne sie kehrt zu `main` zurück. Dauerhaft: `IMAGE_TAG=abc1234` in die `.env` schreiben, zurück zu `main` durch Entfernen der Zeile und erneutes `pull`/`up`. Ein Rollback über eine Migration hinweg setzt die Datenbank nicht zurück; das ältere Backend findet die neuere Revision nicht und startet nicht. Dann das Backup von vor dem Update einspielen.

**Lokal bauen** (statt ziehen, z. B. für einen ungemergten Stand):

```bash
COMMIT_HASH=$(git rev-parse --short HEAD) \
  docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

Der Override baut aus `frontend/` und `backend/` und taggt lokal als `my-cookbook-*:local`, überschreibt also die gezogenen Images nicht. Zurück auf die CI-Images: `docker compose pull && docker compose up -d` ohne Override.

Die App ist unter `http://localhost:8080` erreichbar. In Production einen Reverse-Proxy mit HTTPS davor schalten.

Der äußere Reverse-Proxy darf den Pfad `/api/v1/ai/` nicht enger begrenzen als der mitgelieferte nginx: **Request-Body mindestens 20 MB** (AI-Foto-Import mit bis zu 10 Seiten) und **Lese-/Sende-Timeout mindestens 150 s** (Modellaufrufe dauern). Für den Rest von `/api/` genügen 10 MB.

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
| `uv run pytest` | Smoke-Tests (ohne Datenbank und Netz); DB-Tests werden übersprungen |
| `uv run pytest -m db` | DB-Tests gegen PostgreSQL, braucht `DB_HOST` und `DB_NAME=test…` (leert das Schema), siehe `backend/tests/db/conftest.py` |
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
- **AI-Import:** Das Modell wählt der Admin in der Administration (Text/URL und Foto getrennt, Default `gpt-6-luna`). Die Antwort kommt per Structured Outputs als Rezeptschema (`backend/app/schemas/ai.py`); URLs liest das Modell über die Websuche.
- **AI System-Prompt** liegt als Markdown-Datei im Repo (`backend/prompts/system_prompt.md`) und im Backend-Image — Änderung per Deploy, nicht extern änderbar

## API-Übersicht

Das Backend stellt eine REST-API unter `/api` bereit:

| Bereich | Endpunkte | Auth |
|---------|-----------|------|
| Health | `GET /health` | Nein |
| Rezepte | `GET /v1/recipes`, `GET /v1/recipes/{id}` | Readonly+ |
| | `POST /v1/recipes`, `PUT /v1/recipes/{id}`, `POST /v1/recipes/{id}/tags` | Editor+ |
| | `DELETE /v1/recipes/{id}` | Admin, Editor nur eigene |
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
| | `GET /v1/admin/export` (Gesamtexport als ZIP) | Admin |

`POST /v1/recipes` nimmt optional eine vom Client vergebene `id` (UUID) an. Existiert sie bereits, antwortet die API mit `409` (Rezept existiert, unverändert); der Client gleicht dann per `GET /v1/recipes/{id}` ab, statt `409` blind als Erfolg zu werten. Die Nil-UUID ergibt `422`.

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

### Gesamtexport (ZIP)

In der Verwaltung lädt ein Admin mit „Gesamtexport (ZIP)“ alle Rezepte mit Tags und Bildern (Fotos und Vorlagen, jeweils das Original) herunter (`GET /api/v1/admin/export`). Das ZIP enthält `manifest.json` (Formatversion, Zeitpunkt, App-Commit, Anzahlen, fehlende Bilddateien), `recipes/<id>.json` und `images/<id>.<ext>`; das Format beschreibt [docs/plans/export-import.md](docs/plans/export-import.md). Nutzer, Favoriten, Share-Links und Einstellungen sind nicht enthalten.

Der Export ergänzt `backup.sh`, ersetzt es aber nicht: Das SQL-Dump sichert die ganze Datenbank, aber keine Bilddateien; die liegen im Volume `recipe_uploads`. Das Wiedereinspielen eines Exports folgt mit Roadmap 11.2.

Das Backend schreibt das ZIP zunächst in sein temporäres Verzeichnis (`/tmp` im Container) und löscht es nach dem Ausliefern (nach einem Abbruch beim nächsten Start); dort muss Platz für den gesamten Bildbestand sein.

### Backup einspielen

```bash
gunzip -c backups/cookbook_20260405_030000.sql.gz | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

## Upgrade-Hinweise

`docker-compose.yml` und `.env` sind nicht versioniert. Änderungen an `docker-compose.yml.example` und neue Pflichtvariablen vor `docker compose pull && docker compose up -d` von Hand nachziehen. Vorher ein Backup erstellen.

Ein neuer Major von PostgreSQL (`db`-Dienst) geht nicht per Pull: Das Datenformat ändert sich, es braucht Dump und Restore. Die Anleitung kommt mit dem Upgrade auf PostgreSQL 18 (Roadmap W.21); bis dahin das Major in der Compose-Datei nicht ändern.

**Umstieg von lokalem Build auf Pull (ghcr.io):**

1. **Paket öffentlich stellen (einmalig, auf GitHub):** Der erste CI-Lauf auf `main` legt die Pakete `my-cookbook-frontend` und `my-cookbook-backend` privat an. Je Paket unter *Profil → Packages → Paket → Package settings → Danger Zone → Change visibility* auf *Public* stellen und mit dem Paketnamen bestätigen. **Nicht umkehrbar:** Ein öffentliches Paket lässt sich nicht wieder privat stellen. Ohne diesen Schritt braucht der Server `docker login ghcr.io` mit einem Token (`read:packages`).
2. **Compose-Datei** mit `docker-compose.yml.example` abgleichen: bei `frontend` und `backend` den Block `build:` durch die Zeile `image: ghcr.io/cehser/my-cookbook-<dienst>:${IMAGE_TAG:-main}` ersetzen. `COMMIT_HASH` wird nicht mehr gebraucht (steckt im Image).
3. **Erster Pull und Start:** `docker compose pull && docker compose up -d`. Im Profil steht danach der Commit-Hash des CI-Builds.
4. **Alte, lokal gebaute Images aufräumen:** `docker image ls` zeigt sie als `<projekt>-frontend` und `<projekt>-backend` (Projekt = Verzeichnisname, z. B. `my-cookbook`); `docker image rm my-cookbook-frontend my-cookbook-backend`, danach optional `docker image prune`.
5. Das bisherige Deploy-Skript entfällt; Deploy, Rollback und lokales Bauen siehe [Starten](#3-starten).

**Upgrade von Ständen vor November 2026:**

1. **Compose-Datei** mit `docker-compose.yml.example` abgleichen:
   - Mount und Volume `recipe_prompts` entfernen (der AI-Prompt liegt jetzt im Image), danach `docker volume rm <projekt>_recipe_prompts`.
   - `POSTGRES_PASSWORD=${DB_PASSWORD:?…}` übernehmen (kein Default `changeme` mehr).
2. **`.env`:** `OIDC_AUTHORITY`, `OIDC_CLIENT_ID` und `DB_PASSWORD` sind Pflicht; ohne sie startet das Backend nicht. Optional `ADMIN_EMAIL` (siehe [Erster Admin](#erster-admin)).
3. **`DB_PASSWORD`:** `POSTGRES_PASSWORD` wirkt nur beim ersten Anlegen des Datenbank-Volumes. Lief die Datenbank bisher ohne gesetztes Passwort (also mit `changeme`), zuerst genau diesen Wert in die `.env` eintragen und deployen. Ein neues Passwort danach in PostgreSQL setzen und erst dann in der `.env` ändern (`<db-user>` = `DB_USER`):

   ```bash
   docker compose exec db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
   # in psql:
   \password <db-user>
   ```

   `\password` fragt das Passwort ab, ohne Shell-Quoting und ohne Eintrag in der Shell-History. Steht das bisherige Passwort **ohne** Anführungszeichen in der `.env` und enthält es `$` oder ` #`, hat Compose es schon beim Anlegen der Datenbank verändert; den Wert dann nicht nachträglich in Anführungszeichen setzen, sondern das Passwort wie oben neu vergeben.

4. **Reverse-Proxy:** für `/api/v1/ai/` Request-Body ≥ 20 MB und Lese-/Sende-Timeout ≥ 150 s.
5. **Installierte PWAs** (Homescreen) einmal vollständig schließen und neu öffnen: Der Service Worker wechselt von automatischem auf gesteuertes Update; alte Clients übernehmen ihn erst, wenn kein Fenster der App mehr offen ist.

## Umgebungsvariablen

| Variable | Pflicht | Default | Beschreibung |
|----------|---------|---------|-------------|
| `OIDC_AUTHORITY` | Ja | — | URL des OIDC-Providers (kein Default; Backend startet ohne) |
| `OIDC_CLIENT_ID` | Ja | — | Client-ID der SPA beim IdP (kein Default; Backend startet ohne) |
| `ADMIN_EMAIL` | Nein | — | E-Mail des ersten Admins, siehe „Erster Admin“ |
| `DB_NAME` | Nein | `cookbook` | PostgreSQL-Datenbankname |
| `DB_USER` | Nein | `cookbook` | PostgreSQL-Benutzer |
| `DB_PASSWORD` | Ja | — | PostgreSQL-Passwort; Sonderzeichen erlaubt, in `.env` in einfache Anführungszeichen setzen (Compose wertet `$` sonst aus) |
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
