# Backend-Migrationsplan: WebDAV → Python/FastAPI

> **Planungsnotizen:** Entstanden aus Architektur-Diskussion (März 2026)  
> **Letzte Aktualisierung:** 23. März 2026  
> **Status:** 🚧 Sprint B3 abgeschlossen — Sprint B4 steht an

---

## 📊 Übersicht

**Ziel:** Ablösung der WebDAV-basierten Client-only-Architektur durch ein echtes Backend mit Benutzerverwaltung, REST-API und zentraler Datenbank.

**Motivation:**
- Security: OpenAI-Key + WebDAV-Credentials liegen im Klartext im Browser (IndexedDB)
- Kein echtes User-Management, keine Zugriffskontrolle (nur Client-Side `read_only`-Toggle)
- Alle Rezepte als eine YAML-Datei → kein Concurrent-Editing, naiver Timestamp-Merge
- CORS-Proxies (corsproxy.io) für Bild-Downloads = externes Security-Risiko
- Keine server-seitige Bildverarbeitung (keine Thumbnails, keine Komprimierung)
- Favoriten nur lokal → nicht geräteübergreifend

---

## 🏗️ Ist-Zustand (Architektur vor Migration)

```
┌──────────────────────┐        ┌───────────────┐
│    Vue.js SPA (PWA)  │  HTTP  │  WebDAV-Server│
│  ┌────────────────┐  │◄──────►│  (extern)     │
│  │  IndexedDB     │  │        │               │
│  │  - recipes     │  │  PUT/  │  cookbook.yaml │
│  │  - pictures    │  │  GET   │  pictures/    │
│  │  - settings    │  │        │    {uuid}/    │
│  │  - favorites   │  │        └───────────────┘
│  └────────────────┘  │
│                      │        ┌───────────────┐
│  OpenAI API Key      │  HTTP  │  OpenAI API   │
│  (im Browser!)       │───────►│  (direkt)     │
│                      │        └───────────────┘
├──────────────────────┤
│  nginx (Static SPA)  │
│  Port 8080           │
└──────────────────────┘
```

**Probleme im Detail:**

| Problem | Auswirkung |
|---------|-----------|
| Eine YAML-Datei für alle Rezepte | Kein Einzelzugriff, keine Pagination, keine DB-Suche |
| WebDAV Basic Auth im Browser | Credentials in IndexedDB, kein Token-Expiry |
| OpenAI-Key client-seitig | Jeder User braucht eigenen Key, Key leicht extrahierbar |
| Naiver Merge (`lastUpdated`) | Bei gleichzeitiger Bearbeitung gewinnt Remote ohne Warnung |
| Öffentliche CORS-Proxies | Drittanbieter sehen Bild-URLs, keine Kontrolle |
| Bilder unverarbeitet | Kein Resize, kein WebP, kein Thumbnail |
| Favoriten nur in IDB | Nicht geräteübergreifend, gehen bei Browser-Reset verloren |

---

## 🎯 Soll-Zustand (Architektur nach Migration)

```
┌──────────────┐     OIDC/Token      ┌──────────────────┐
│  OIDC IdP    │◄────────────────────│   Vue.js SPA     │
│  (z.B. Key-  │─────────────────────│   (PWA)          │
│  cloak, Auth-│   Access Token      │                  │
│  entik, etc.)│                     │  + IndexedDB     │
└──────────────┘                     │    (Offline-     │
                                     │    (Offline-     │
                                     │     Read-Cache)  │
                                     └────────┬─────────┘
                                              │ REST API
                                              │ Bearer Token
                                     ┌────────▼─────────┐
                                     │   FastAPI Backend │
                                     │   (Python 3.14)  │
                                     ├──────────────────┤
                                     │ • JWT-Verify     │
                                     │ • Rollen-Check   │
                                     │ • Recipe CRUD    │
                                     │ • Image Upload   │
                                     │ • AI-Proxy       │
                                     │ • Bild-Prozess.  │
                                     └──┬───────────┬───┘
                                        │           │
                               ┌────────▼───┐  ┌───▼───────────┐
                               │ PostgreSQL  │  │ Filesystem    │
                               │ (Rezepte,   │  │ (Docker Vol.) │
                               │  User-Daten,│  │               │
                               │  Favoriten, │  │ /uploads/     │
                               │  Tags)      │  │   {uuid}/     │
                               └─────────────┘  │   originals/  │
                                                │   thumbnails/ │
                                                └───────────────┘
```

---

## 🔧 Tech-Stack

| Bereich | Technologie | Version | Begründung |
|---------|------------|---------|------------|
| **Backend-Framework** | FastAPI + uvicorn | ≥0.135 / ≥0.42 | Async, Pydantic-Validierung, Auto-OpenAPI-Docs |
| **Python** | 3.14 | 3.14-slim | Aktuellste stabile Version, Support bis Okt 2030 |
| **ORM** | SQLAlchemy 2.0 (async) | 2.x | Type-safe, async-fähig, ausgereift |
| **DB-Migrationen** | Alembic | latest | Standard für SQLAlchemy |
| **Datenbank** | PostgreSQL | 16+ | JSONB für flexible Rezeptdaten, Volltextsuche, zuverlässig |
| **Auth** | Keycloak (OIDC IdP) | — | `auth.cehser.de/realms/cehser`, Client-ID `cookbook.cehser.de` |
| **JWT-Verify** | PyJWT + cryptography | ≥2.12 / ≥46.0 | Token-Validierung gegen JWKS Public Key des IdP |
| **Bildverarbeitung** | Pillow | latest | Resize, Thumbnails, WebP-Konvertierung |
| **AI-Proxy** | openai (Python SDK) | ≥2.29 | Chat Completions API (Text/Bild), Responses API mit `web_search_preview` (URL-Import) |
| **YAML-Migration** | PyYAML | latest | Import bestehender cookbook.yaml |
| **Validation** | Pydantic v2 | (in FastAPI) | Automatische Request/Response-Validierung |
| **ASGI-Server** | uvicorn | latest | Performant, Standard für FastAPI |

### Warum PostgreSQL?

- **JSONB**: Rezeptdaten haben variable Struktur (Sections, Ingredients mit optionalen Feldern) → JSONB ist ideal
- **Volltextsuche**: `tsvector` + `tsquery` direkt in der DB, kein Elasticsearch nötig
- **Relationen**: User ↔ Favoriten, Rezept ↔ Tags, Rezept ↔ Bilder → sauber relational
- **Bewährt**: Läuft problemlos in Docker, `pg_dump` für Backups

### Was bewusst NICHT verwendet wird

| Technologie | Grund |
|------------|-------|
| GraphQL | Overkill für Familien-App, REST reicht |
| Redis | Bei der Nutzerzahl unnötig, kein Caching-Layer nötig |
| Microservices | Ein Monolith-Backend ist wartbar und ausreichend |
| WebSockets | Kein Real-Time-Use-Case (Polling/Reload reicht) |
| MinIO / S3 | Filesystem-Volume reicht, S3 wäre Over-Engineering |
| Celery / Task Queue | Synchrone Bildverarbeitung reicht bei dieser Last |

---

## 🗄️ Datenbank-Schema

### Entity-Relationship

```
app_users 1───∞ recipes        (created_by)
app_users 1───∞ recipes        (updated_by)
app_users ∞───∞ recipes        (favorites)
recipes   1───∞ recipe_images
recipes   1───∞ recipe_shares  (öffentliche Share-Links)
recipes   ∞───∞ tags           (recipe_tags)
```

### Tabellen

```sql
-- ============================================================
-- User (App-spezifische Daten, IdP verwaltet Identität)
-- ============================================================
CREATE TABLE app_users (
    oidc_sub        UUID PRIMARY KEY,              -- OIDC Subject ID (vom IdP)
    display_name    TEXT NOT NULL,                  -- z.B. "preferred_username" aus Token
    role            TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'readonly' | 'editor' | 'admin'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login      TIMESTAMPTZ,
    
    CONSTRAINT valid_role CHECK (role IN ('pending', 'readonly', 'editor', 'admin'))
);

-- ============================================================
-- Rezepte
-- ============================================================
CREATE TABLE recipes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_name     TEXT NOT NULL,
    data            JSONB NOT NULL,                -- Vollständige Rezeptdaten (flexibel)
    created_by      UUID REFERENCES app_users(oidc_sub),
    updated_by      UUID REFERENCES app_users(oidc_sub),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    search_vector   TSVECTOR                       -- Für Volltextsuche
);

-- Indizes
CREATE INDEX idx_recipes_search ON recipes USING GIN (search_vector);
CREATE INDEX idx_recipes_name ON recipes (recipe_name);
CREATE INDEX idx_recipes_data_gin ON recipes USING GIN (data);  -- JSONB-Queries
CREATE INDEX idx_recipes_updated ON recipes (updated_at DESC);

-- Auto-Update search_vector via Trigger
CREATE OR REPLACE FUNCTION recipes_search_update() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('german', COALESCE(NEW.recipe_name, '')), 'A') ||
        setweight(to_tsvector('german', COALESCE(NEW.data->>'author', '')), 'B') ||
        setweight(to_tsvector('german', COALESCE(NEW.data->>'notes', '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recipes_search
    BEFORE INSERT OR UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION recipes_search_update();

-- ============================================================
-- Bilder
-- ============================================================
CREATE TABLE recipe_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,                  -- Originalname
    mime_type       TEXT NOT NULL,
    file_path       TEXT NOT NULL,                  -- Pfad: uploads/{recipe_id}/originals/{filename}
    thumbnail_path  TEXT,                           -- Pfad: uploads/{recipe_id}/thumbnails/{filename}.webp
    file_size       INTEGER,                        -- Bytes
    sort_order      INTEGER NOT NULL DEFAULT 0,
    uploaded_by     UUID REFERENCES app_users(oidc_sub),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_images_recipe ON recipe_images (recipe_id, sort_order);

-- ============================================================
-- Favoriten (pro User)
-- ============================================================
CREATE TABLE favorites (
    user_id         UUID NOT NULL REFERENCES app_users(oidc_sub) ON DELETE CASCADE,
    recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, recipe_id)
);

-- ============================================================
-- Tags (normalisiert)
-- ============================================================
CREATE TABLE tags (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE
);

CREATE TABLE recipe_tags (
    recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, tag_id)
);

CREATE INDEX idx_tags_name ON tags (name);

-- ============================================================
-- Share-Links (öffentlicher Zugriff ohne Anmeldung)
-- ============================================================
CREATE TABLE recipe_shares (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE,           -- Kryptographisch sicheres Token (secrets.token_urlsafe)
    created_by      UUID NOT NULL REFERENCES app_users(oidc_sub),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,                    -- Optional: Ablaufdatum (NULL = unbegrenzt)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE   -- Soft-Deaktivierung
);

CREATE UNIQUE INDEX idx_shares_token ON recipe_shares (token) WHERE is_active = TRUE;
CREATE INDEX idx_shares_recipe ON recipe_shares (recipe_id);
```

### Was in `data` (JSONB) gespeichert wird

Das `data`-Feld enthält die flexible Rezeptstruktur — im Wesentlichen das bestehende Recipe-Interface minus die Felder, die in eigene Spalten/Tabellen gewandert sind:

```jsonc
{
  // Metadaten
  "author": "Oma",
  "source_url": "https://...",
  "source_book": "Backen wie früher",
  "subtitle": "Klassisch mit Streuseln",
  "notes": "Am besten mit Boskop-Äpfeln",
  "difficulty": "medium",

  // Zeiten
  "prep_time": "30 min",
  "cook_time": "15 min",
  "bake_time": "45 min",
  "total_time": "1h 30min",

  // Portionen & Skalierung
  "servings": "4",
  "yields": [{"Portionen": 4}],
  "recalc_exp": 1,

  // Abschnitte (Struktur)
  "sections": [
    {"section": "Teig"},
    {"section": "Streusel"}
  ],

  // Zutaten
  "ingredients": [
    {
      "amounts": [{"amount": 200, "unit": "g"}],
      "ingredient": "Mehl",
      "section": "Teig",
      "processing": "gesiebt",
      "notes": "Type 405"
    }
  ],

  // Schritte
  "steps": [
    {
      "step": "Mehl und Zucker vermengen.",
      "section": "Teig",
      "notes": "Nicht zu lange kneten"
    }
  ]
}
```

**Warum Hybrid (Spalten + JSONB)?**
- `recipe_name`, `created_by`, `updated_at` → eigene Spalten für effiziente Queries/Sortierung
- Tags, Bilder, Favoriten → eigene Tabellen für Relationen
- Rest (Zutaten, Schritte, Zeiten etc.) → JSONB, weil flexibel und selten direkt gequeried

---

## 🔐 Authentifizierung & Autorisierung

### Auth-Flow

```
1. User öffnet App
2. SPA prüft: Token vorhanden + gültig?
   ├─ Nein → Redirect zu OIDC IdP Login
   │         → IdP authentifiziert
   │         → Redirect zurück mit Auth Code
   │         → SPA tauscht Code gegen Token (PKCE)
   └─ Ja  → Weiter
3. SPA sendet API-Requests mit Bearer Token
4. Backend validiert Token (JWKS Public Key vom IdP)
5. Backend prüft Rolle aus app_users-Tabelle
```

### OIDC-Anbindung (Client-Seite)

```
OIDC-Config (Env-Variablen / Config-Datei):
  OIDC_AUTHORITY:   https://idp.example.com/realms/my-cookbook  (Issuer-URL)
  OIDC_CLIENT_ID:   my-cookbook-spa
  Client Type:      Public (SPA)
  Auth Flow:        Authorization Code + PKCE
  Redirect URI:     https://cookbook.example.com/callback
  Post-Logout URI:  https://cookbook.example.com/
```

> **Hinweis:** Die `OIDC_AUTHORITY` muss ein `.well-known/openid-configuration` Endpoint bereitstellen.
> Kompatibel mit: Keycloak, Authentik, Zitadel, Auth0, Azure AD, Google Identity u.a.

Vue-Integration via `oidc-client-ts` (generische OIDC-Bibliothek):
```
npm install oidc-client-ts
```

### OIDC-Anbindung (Backend-Seite)

Das Backend verifiziert Tokens **ohne IdP-Roundtrip** (offline validation):

```python
# Vereinfachte Darstellung
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> AppUser:
    """Token verifizieren, User aus DB laden (oder Auto-Create)."""
    payload = verify_oidc_token(credentials.credentials)  # JWT decode + verify via JWKS
    user = await get_or_create_user(db, payload["sub"], payload.get("preferred_username"))
    return user

async def require_role(*roles: str):
    """Dependency: Mindestens eine der Rollen erforderlich."""
    async def check(user: AppUser = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(403, f"Rolle '{user.role}' nicht ausreichend")
        return user
    return check
```

### Rollen-Konzept

| Rolle | Profil/Settings | Rezepte lesen | Favoriten | Erstellen/Bearbeiten | Löschen | User verwalten |
|-------|----------------|---------------|-----------|---------------------|---------|---------------|
| **pending** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **readonly** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **editor** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Rollen-Zuweisung:**
- Neuer User → automatisch `pending` (**kein Zugriff** auf Rezepte)
- `pending`-User können nur ihr Profil (`/v1/me`) und Settings (`/v1/me/settings`) sehen
- Admin muss erst mindestens `readonly` vergeben, damit Rezepte sichtbar werden
- Admin kann Rollen über Admin-Seite verwalten (User-Liste + Rollenänderung)
- Rolle steht in `app_users.role`, **nicht** im IdP (einfacher, keine IdP-Admin-API nötig)

**Warum `pending` statt `readonly` als Default?**
- Jeder mit Zugang zum OIDC-IdP könnte sich einloggen
- Ohne explizite Freigabe soll niemand Rezepte sehen können
- Admin behält volle Kontrolle, wer Zugriff erhält

### Admin: User- & Rechteverwaltung

Der Admin verwaltet User und Rollen über die Admin-Seite (`/administration`):

- **User-Übersicht:** Liste aller registrierten User mit Rolle, letztem Login, Erstelldatum
- **Rolle ändern:** Dropdown pro User → `pending` | `readonly` | `editor` | `admin`
- **Neue User freigeben:** Pendente User werden hervorgehoben (Badge/Hinweis)
- **Optional (B4+):** User löschen, User sperren (Rolle zurück auf `pending`)

Endpunkte:
- `GET /v1/admin/users` — Alle User mit Rollen (bereits implementiert)
- `PUT /v1/admin/users/{id}/role` — Rolle ändern (bereits implementiert)

### Auto-User-Provisioning

Beim ersten API-Request eines neuen OIDC-Users:
1. Token ist gültig → `sub` (UUID) ist bekannt
2. User existiert nicht in `app_users` → Auto-Create mit Rolle `pending`
3. `display_name` aus `preferred_username` Claim
4. Admin wird per Toast/Hinweis benachrichtigt: "Neuer Nutzer wartet auf Freigabe"
5. User sieht Hinweis: "Dein Account wurde registriert. Ein Admin muss dir noch Zugriff gewähren."

---

## 🌐 API-Design

### Endpunkte

```
Basis-URL: /api  (root_path)
API-Version: /v1

── System ───────────────────────────────────────────────
GET    /health                    → Health-Check (kein Auth)          ✅
GET    /docs                      → Swagger UI (Auto-generiert)      ✅

── User ─────────────────────────────────────────────────
GET    /v1/me                     → Aktueller User (aus Token)       ✅
GET    /v1/me/settings            → User-Settings laden              ✅
PUT    /v1/me/settings            → User-Settings speichern          ✅

── Rezepte ──────────────────────────────────────────────
GET    /v1/recipes                → Liste (Suche, Sortierung, Pagination) [readonly+]  ✅
GET    /v1/recipes/:id            → Einzelnes Rezept (mit first_image_id) [readonly+]  ✅
POST   /v1/recipes                → Neues Rezept [editor, admin]           ✅
PUT    /v1/recipes/:id            → Rezept aktualisieren [editor, admin]   ✅
DELETE /v1/recipes/:id            → Rezept löschen [admin]                 ✅

── Bilder ───────────────────────────────────────────────
POST   /v1/recipes/:id/images     → Bild hochladen [editor, admin]        ✅
GET    /v1/recipes/:id/images     → Bilderliste pro Rezept [readonly+]     ✅
DELETE /v1/recipes/:id/images/:imgId → Bild löschen [editor, admin]        ✅
GET    /v1/images/:id             → Optimiertes Bild ausliefern [readonly+] ✅
GET    /v1/images/:id/thumbnail   → Thumbnail ausliefern [readonly+]       ✅

── AI ───────────────────────────────────────────────────
POST   /v1/ai/import              → Text/URL → Rezept [editor, admin]     ✅
POST   /v1/ai/import/image        → Bild → Rezept [editor, admin]         ✅

── Admin ────────────────────────────────────────────────
GET    /v1/admin/users            → Alle User [admin]                      ✅
PUT    /v1/admin/users/:id/role   → Rolle ändern [admin]                   ✅
POST   /v1/admin/migrate-images   → Bild-Migration von WebDAV [admin]      ✅

── Favoriten ────────────────────────────────────────────
GET    /v1/favorites              → Meine Favoriten (Recipe-IDs)           ✅
POST   /v1/favorites/:recipeId    → Favorit setzen                         ✅
DELETE /v1/favorites/:recipeId    → Favorit entfernen                      ✅

── Tags (B4) ────────────────────────────────────────────
GET    /v1/tags                   → Alle Tags (mit Anzahl)                 ✅

── Share (B4) ───────────────────────────────────────────
POST   /v1/recipes/:id/share      → Share-Link erzeugen [editor, admin]   ⬜
GET    /v1/recipes/:id/shares     → Aktive Links auflisten                 ⬜
DELETE /v1/shares/:shareId        → Share-Link deaktivieren                ⬜
GET    /v1/shared/:token          → Rezept lesen (kein Auth)              ⬜
GET    /v1/shared/:token/images/:imgId → Bild zum Share (kein Auth)       ⬜
```

### Request/Response-Beispiele

**GET /api/v1/recipes?search=apfel&sort=updated_at&order=desc&limit=20&offset=0**
```json
{
  "items": [
    {
      "id": "a1b2c3d4-...",
      "recipe_name": "Apfelkuchen",
      "author": "Oma",
      "difficulty": "medium",
      "tags": ["Kuchen", "Herbst"],
      "thumbnail_url": "/api/v1/images/img-uuid-1?size=thumb",
      "updated_at": "2025-12-29T14:30:00Z",
      "is_favorite": true
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**GET /api/v1/recipes/:id**
```json
{
  "id": "a1b2c3d4-...",
  "recipe_name": "Apfelkuchen",
  "data": { /* vollständiges Rezept-JSONB */ },
  "images": [
    {
      "id": "img-uuid-1",
      "url": "/api/v1/images/img-uuid-1",
      "thumbnail_url": "/api/v1/images/img-uuid-1?size=thumb",
      "filename": "apfelkuchen.jpg"
    }
  ],
  "tags": ["Kuchen", "Herbst"],
  "is_favorite": true,
  "created_by": { "display_name": "Oma" },
  "updated_by": { "display_name": "Papa" },
  "created_at": "2025-12-20T10:00:00Z",
  "updated_at": "2025-12-29T14:30:00Z"
}
```

**POST /api/v1/ai/import** (Body: `{ "text": "Rezept-Text..." }` oder multipart mit Bild)
```json
{
  "recipe": { /* Pydantic-validiertes Rezept */ },
  "confidence": 0.92,
  "message": "Rezept erfolgreich erkannt"
}
```

**POST /api/v1/recipes/:id/share** (Body: `{ "expires_in_days": 30 }` — optional)
```json
{
  "id": "share-uuid-1",
  "token": "Ab3xK9mP...",
  "share_url": "https://cookbook.example.com/s/Ab3xK9mP...",
  "recipe_id": "a1b2c3d4-...",
  "created_at": "2026-03-21T10:00:00Z",
  "expires_at": "2026-04-20T10:00:00Z"
}
```

**GET /api/v1/shared/:token** (kein Auth nötig)
```json
{
  "recipe_name": "Apfelkuchen",
  "data": { /* vollständiges Rezept-JSONB */ },
  "images": [
    {
      "id": "img-uuid-1",
      "url": "/api/v1/shared/Ab3xK9mP.../images/img-uuid-1",
      "thumbnail_url": "/api/v1/shared/Ab3xK9mP.../images/img-uuid-1?size=thumb"
    }
  ],
  "shared_by": "Papa",
  "shared_at": "2026-03-21T10:00:00Z"
}
```

---

## 🖼️ Bildverarbeitung

### Upload-Flow

```
Client: POST /api/v1/recipes/:id/images (multipart/form-data)
  │
  ▼
Backend:
  1. Validierung (Max 5 MB, erlaubte MIME-Types: jpeg, png, webp, heic)
  2. Original speichern → uploads/{recipe_id}/originals/{uuid}.{ext}
  3. Thumbnail generieren (Pillow):
     - Max 400x400px
     - WebP-Format (Quality 80)
     → uploads/{recipe_id}/thumbnails/{uuid}.webp
  4. Großes Bild optimieren:
     - Max 1200x1200px
     - WebP-Format (Quality 85)
     → uploads/{recipe_id}/optimized/{uuid}.webp
  5. DB-Eintrag in recipe_images
  6. Response mit Bild-URLs
```

### Dateistruktur auf Disk

```
/app/uploads/
  {recipe-uuid}/
    originals/
      {image-uuid}.jpg        ← Unverändert (Backup)
    optimized/
      {image-uuid}.webp       ← Max 1200px, WebP
    thumbnails/
      {image-uuid}.webp       ← Max 400px, WebP (Gallery)
```

### Auslieferung

```
GET /api/v1/images/{image-id}              → Optimiertes Bild (Standard)
GET /api/v1/images/{image-id}/thumbnail    → Thumbnail (400px WebP)
```

Caching: `Cache-Control: public, max-age=86400, immutable` (Bilder ändern sich nicht, UUID ist stabil)

---

## 📱 Client-Anpassungen

### Was sich im Frontend ändert

| Bereich | Vorher | Nachher |
|---------|--------|---------|
| **Auth** | WebDAV Basic Auth (manuell in Settings) | OIDC Login (automatisch, `oidc-client-ts`) |
| **Rezepte laden** | IDB → fallback localStorage → Sample | API-Call → IDB-Cache für Offline |
| **Rezepte speichern** | IDB + WebDAV YAML-Sync | API-Call (PUT/POST) |
| **Bilder** | IDB Blobs + WebDAV Upload | API multipart Upload → URL-Referenz |
| **Favoriten** | IDB lokal | API-Call (pro User serverseitig) |
| **AI-Import** | OpenAI direkt vom Browser | API-Call → Backend-Proxy |
| **Suche/Filter** | Client-seitig (Array.filter) | API-Query + Client für Offline-Cache |
| **Settings** | WebDAV-URL, Credentials, API-Key | Nur noch UI-Preferences (Theme, Expert-Mode) |
| **Sync-Logik** | `mergeCookbooks()` alle 60s | Entfällt komplett (eine DB = eine Wahrheit) |

### Was im Client BLEIBT

- **Portionen-Skalierung** (reine UI-Logik)
- **UI-State** (Gallery-Filter, Scroll-Position, Sortierung) → localStorage
- **PWA/Service Worker** (Asset-Caching, Offline-Shell)
- **IndexedDB** als Read-Cache (Rezepte + Thumbnails für Offline)
- **Alle Vue-Komponenten** (kein Rewrite nötig, nur Datenschicht)

### Neue Client-Dateien

```
src/
  api/                             ← ✅ Implementiert
    client.ts              ← Fetch Wrapper mit Bearer-Token-Injection (oidc-client-ts)
    recipes.ts             ← getRecipes(), getRecipe(), createRecipe(), updateRecipe(), deleteRecipe()
    images.ts              ← uploadImage(), getImageUrl(), getThumbnailUrl()
    ai.ts                  ← importText(), importImage() (mit model-Parameter)
    favorites.ts           ← ✅ list(), add(), remove() — API-basiert, IDB-Fallback
    tags.ts                ← ⬜ Noch nicht implementiert
    admin.ts               ← ⬜ Noch nicht implementiert (Admin über bestehende API-Calls)
    shares.ts              ← ⬜ Noch nicht implementiert
  auth/                            ← ✅ Implementiert
    oidc.ts                ← UserManager-Wrapper, Login/Logout, Token-Refresh
    guards.ts              ← requireAuth, requireRole('editor','admin') Route Guards
```

### Zu entfernende Client-Dateien

```
src/js/cloud.ts            ← GELÖSCHT (komplett entfernt in B4-Cleanup)
src/js/recipes.ts          ← mergeCookbooks() entfernt, initRecipe() + Hilfsfunktionen bleiben
src/prompts/SYSTEM_PROMPT.ts ← cloud_images aus Schema entfernt, wird noch für Client-YAML-Anzeige genutzt
```

> **Erledigt:** `webdav` NPM-Dependency wurde in B4 entfernt. `cloud.ts` komplett gelöscht.

### Offline-Strategie

```
Online:
  API-Calls → Response in IndexedDB cachen
  Bilder → Service Worker cached Thumbnails

Offline (Read-Only):
  Rezeptliste → aus IndexedDB
  Rezeptdetails → aus IndexedDB
  Bilder → aus Service Worker Cache
  Suche/Filter → Client-seitig über IDB-Daten
  
Offline (Schreibversuche):
  → Toast: "Offline — Änderungen nicht möglich"
  → Optional (Zukunft): Write-Queue mit Sync bei Reconnect
```

**Bewusste Entscheidung:** Kein Offline-Write in Phase 1. Die App wird primär im WLAN (Küche) genutzt. Read-Cache reicht.

---

## 🐳 Docker-Infrastruktur

### docker-compose.yml (Production)

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile           # Bestehend: Vue Build → nginx
    ports:
      - "8080:80"
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: ./backend/.env           # DATABASE_URL, OIDC, OPENAI_API_KEY, CORS
    environment:
      - UPLOAD_DIR=/app/uploads
      - MAX_UPLOAD_SIZE_MB=5
    volumes:
      - recipe_uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=cookbook
      - POSTGRES_USER=cookbook
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cookbook"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
  recipe_uploads:
```

> **Wichtig:** Secrets (DB-Passwort, OIDC-URLs, OpenAI-Key) liegen in `backend/.env` via `env_file`.  
> Nie dieselbe Variable zusätzlich im `environment`-Block setzen — das überschreibt `env_file` mit dem (leeren) Host-Wert!

### Backend Dockerfile

```dockerfile
FROM python:3.14-slim

WORKDIR /app

# System-Dependencies für Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo-dev libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### nginx-Config (Frontend → API-Proxy)

```nginx
server {
    listen 80;

    # SPA
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # API-Proxy zum Backend
    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;  # Für Bild-Uploads
    }
}
```

---

## 📁 Backend-Projektstruktur

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI App, CORS, Lifespan, root_path="/api"
│   ├── config.py                  # pydantic-settings (OIDC, CORS, Uploads, DB)
│   ├── database.py                # AsyncEngine, AsyncSession Factory
│   │
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── oidc.py                # Token-Verify (JWKS, offline, Keycloak-kompatibel)
│   │   └── dependencies.py        # get_current_user, require_editor, require_admin
│   │
│   ├── models/                    # SQLAlchemy Models
│   │   ├── __init__.py
│   │   ├── base.py                # DeclarativeBase
│   │   ├── user.py                # AppUser (+ settings JSONB)
│   │   ├── recipe.py              # Recipe (+ search_vector TSVECTOR)
│   │   ├── image.py               # RecipeImage
│   │   ├── favorite.py            # Favorite (M:N User↔Recipe)
│   │   └── tag.py                 # Tag, RecipeTag, RecipeShare
│   │
│   ├── schemas/                   # Pydantic Request/Response Models
│   │   ├── __init__.py
│   │   ├── recipe.py              # RecipeCreate, RecipeUpdate, RecipeResponse, RecipeListItem
│   │   └── user.py                # CurrentUserResponse, UserSettings, UserSettingsResponse
│   │
│   ├── routes/                    # API-Router
│   │   ├── __init__.py
│   │   ├── health.py              # GET /health
│   │   ├── me.py                  # GET /me, GET/PUT /me/settings
│   │   ├── admin.py               # GET /v1/admin/users, PUT .../role
│   │   ├── recipes.py             # CRUD + Suche + auto imageurl-Download
│   │   ├── images.py              # Upload, Serve, Thumbnail, Delete, download_and_store_image()
│   │   ├── ai.py                  # Text/URL/Bild → Rezept via OpenAI
│   │   └── favorites.py           # GET/POST/DELETE /v1/favorites (per-user)
│   │
│   └── services/                  # Business-Logik (noch ausbaufähig)
│       └── __init__.py
│
├── alembic/                       # DB-Migrationen
│   ├── env.py
│   └── versions/
│       ├── 001_initial.py         # Alle Tabellen + Fulltext-Trigger
│       └── 002_user_settings.py   # settings JSONB für app_users
│
├── alembic.ini
├── requirements.txt
├── Dockerfile
└── .env                           # DATABASE_URL, OIDC, OPENAI_API_KEY, CORS
```

---

## 📦 requirements.txt

```
# Framework
fastapi>=0.135
uvicorn[standard]>=0.42

# Database
sqlalchemy[asyncio]>=2.0
asyncpg>=0.30
alembic>=1.18

# Auth
PyJWT>=2.12
cryptography>=46.0        # Für RS256 Key-Handling

# Validation & Settings
pydantic>=2.12
pydantic-settings>=2.13

# Image Processing
Pillow>=12.1

# AI
openai>=2.29

# YAML (Migration)
PyYAML>=6.0

# Utils
python-multipart>=0.0.18  # File-Uploads in FastAPI
httpx>=0.28               # Async HTTP (OIDC JWKS fetch, Bild-Downloads)
```

---

## 🔄 Datenmigration

### Migrations-Script: YAML → PostgreSQL

```
Ablauf:
1. cookbook.yaml einlesen (PyYAML)
2. Für jedes Rezept:
   a. recipe_uuid übernehmen als id (UUIDs bleiben stabil!)
   b. recipe_name → eigene Spalte
   c. Rest → data (JSONB)
   d. tags aus data extrahieren → tags + recipe_tags Tabellen
   e. imageurl → serverseitig herunterladen via download_and_store_image()
      → in uploads/{uuid}/ speichern (Original + Thumbnail + Optimiert)
      → recipe_images Einträge erstellen
3. Erste Admin-User manuell anlegen
4. Validierung: Anzahl Rezepte, Bilder-Integrität prüfen
```

> **Hinweis:** `cloud_images` wurde komplett entfernt. Bilder werden jetzt nur noch über  
> `download_and_store_image()` verarbeitet. Der Admin-Endpunkt `POST /v1/admin/migrate-images`  
> kann für die Bild-Migration bestehender Rezepte verwendet werden.

### Migrations-Checkliste

- [ ] `cookbook.yaml` → PostgreSQL Rezepte (via Script oder Admin-UI)
- [ ] Bestehende UUIDs als Primary Keys übernehmen
- [ ] Tags extrahieren und normalisieren
- [ ] `imageurl` für bestehende Rezepte herunterladen (via `migrate-images` Endpoint)
- [ ] Thumbnails + optimierte Bilder automatisch generiert (Pillow)
- [ ] Smoke-Test: Alle Rezepte über API abrufbar
- [ ] Bild-URLs funktionieren (Thumbnail + Optimiert)
- [ ] Volltextsuche liefert Ergebnisse

---

## 📋 Sprint-Plan (Backend-Migration)

### Sprint B0: Backend-Grundgerüst ✅
**Ziel:** Lauffähiges FastAPI-Projekt mit DB-Anbindung  
**Status:** Abgeschlossen (21. März 2026)

**Tasks:**
- [x] Backend-Projektstruktur anlegen (`backend/app/` mit routes, models, schemas, auth, services)
- [x] FastAPI App mit CORS, Health-Endpoint (`app/main.py`, `root_path="/api"`)
- [x] PostgreSQL 16-alpine in docker-compose.yml
- [x] SQLAlchemy 2.0 Async-Setup + Models (User, Recipe, Image, Tag, Favorite, Share)
- [x] Alembic Init + erste Migration (`001_initial` — alle Tabellen + Volltextsuche-Trigger)
- [x] Basis-Config (pydantic-settings via `config.py`, `.env`-Datei)
- [x] Backend-Dockerfile (Python 3.14-slim + Pillow-Dependencies)
- [x] docker-compose.yml erweitern (frontend + backend + db + Volumes)

**Ergebnis:** `GET /api/health` → `200 OK`, DB verbunden, alle Tabellen angelegt

---

### Sprint B1: Auth + User-Management ✅
**Ziel:** OIDC-Integration, Rollen-System  
**Status:** Abgeschlossen (21. März 2026)

**Tasks:**
- [x] Keycloak IdP konfiguriert (`auth.cehser.de/realms/cehser`, Client-ID `cookbook.cehser.de`)
- [x] JWT-Verify Middleware (`auth/oidc.py` — JWKS offline via `.well-known/openid-configuration`)
- [x] `get_current_user` Dependency (`auth/dependencies.py`)
- [x] Auto-User-Provisioning (`pending` Default, Auto-Create beim ersten Token — kein Rezeptzugriff)
- [x] Rollen-Check Dependencies (`require_editor`, `require_admin`)
- [x] Admin-Endpunkte: `GET /v1/admin/users`, `PUT /v1/admin/users/{id}/role`
- [x] Frontend: `oidc-client-ts` Integration (`src/auth/oidc.ts`)
- [x] Frontend: Router Guards — `requireAuth`, `requireRole('editor','admin')` (`src/auth/guards.ts`)
- [x] Frontend: Token in API-Requests (Bearer Token via `src/api/client.ts`)
- [x] User-Settings Endpunkte: `GET /v1/me`, `GET/PUT /v1/me/settings` (`routes/me.py`)
- [x] Alembic Migration `002_user_settings` — JSONB `settings`-Spalte für `app_users`

**Ergebnis:** Login via Keycloak, Rollen funktionieren, API geschützt, User-Settings serverseitig

---

### Sprint B2: Recipe CRUD API ✅
**Ziel:** Rezepte über API laden, erstellen, bearbeiten, löschen  
**Status:** Abgeschlossen (22. März 2026)

**Tasks:**
- [x] `GET /v1/recipes` (Liste mit Suche, Sortierung, Pagination — `?search=`, `?limit=`, `?offset=`)
- [x] `GET /v1/recipes/{id}` (Einzelnes Rezept mit `first_image_id`)
- [x] `POST /v1/recipes` (Neues Rezept, Pydantic-Validierung, Auto-Download `imageurl`)
- [x] `PUT /v1/recipes/{id}` (Update, Auto-Download `imageurl`)
- [x] `DELETE /v1/recipes/{id}` (nur Admin)
- [x] Volltextsuche (tsvector + Trigger, Gewichtung: Name A, Author B, Notes C)
- [x] Frontend: API-Client (`src/api/recipes.ts`, `src/api/client.ts`)
- [x] Frontend: Store-Actions auf API umstellen (`loadRecipesFromApi`, `loadRecipeDetailFromApi`, `prefetchRecipeDetails`)
- [x] Frontend: WebDAV-Sync-Logik entfernt (`mergeCookbooks()` etc.)

**Abweichungen vom Plan:**
- Tags werden beim Create/Update automatisch aus `data` extrahiert, separate Tag-API-Endpunkte noch nicht implementiert
- `first_image_id` in allen Responses ergänzt (nicht im Originalplan)
- `_auto_download_imageurl()` Helper: Lädt `imageurl` serverseitig herunter und speichert als Bild

**Ergebnis:** Rezepte vollständig über API verwaltet, Volltextsuche funktioniert

---

### Sprint B3: Bilder + AI-Proxy ✅
**Ziel:** Bild-Upload/Auslieferung + AI-Import über Backend  
**Status:** Abgeschlossen (23. März 2026)

**Tasks:**
- [x] `POST /v1/recipes/{id}/images` (Upload + Pillow-Processing)
- [x] `GET /v1/images/{id}` (Optimiertes Bild ausliefern)
- [x] `GET /v1/images/{id}/thumbnail` (Thumbnail ausliefern)
- [x] `DELETE /v1/recipes/{id}/images/{imgId}`
- [x] `GET /v1/recipes/{id}/images` (Bilderliste pro Rezept)
- [x] Thumbnail-Generierung (400px WebP, Quality 80)
- [x] Optimierte Bilder (1200px WebP, Quality 85)
- [x] `POST /v1/ai/import` (Text → Rezept via OpenAI Chat Completions)
- [x] `POST /v1/ai/import` mit URL-Erkennung → OpenAI Responses API + `web_search_preview`
- [x] `POST /v1/ai/import/image` (Bild → Rezept via OpenAI Vision, konfigurierbares `model`)
- [x] Frontend: Bild-Upload auf API umstellen (`src/api/images.ts`)
- [x] Frontend: AI-Import auf API umstellen (`src/api/ai.ts`, `AIRecipeImport.vue`)
- [x] Frontend: OpenAI-Key aus Frontend-Settings entfernt (nur noch serverseitig in `backend/.env`)
- [x] Frontend: Expert-Mode YAML-Vorschau bei AI-Import
- [x] `cloud_images` komplett entfernt (Typ, Komponenten, Store, Prompts)
- [x] `POST /v1/admin/migrate-images` — Admin-Endpunkt für Bild-Migration von WebDAV
- [x] `download_and_store_image()` Hilfsfunktion in `images.py` (httpx, 15s Timeout)

**Abweichungen vom Plan:**
- Bild-Auslieferung über separate Thumbnail-Route (`/images/{id}/thumbnail`) statt Query-Parameter `?size=thumb`
- AI-Import unterstützt 3 Modi: Freitext, URL (mit Web-Suche), Bild
- GPT-Modell als Query-Parameter konfigurierbar (`?model=gpt-4o`)
- `initRecipe()` wird nach YAML-Parsing angewendet (leere Felder → Defaults)
- Doppelter Rezept-Save in `Gallery.vue` behoben (emit-basiert statt doppeltem dispatch)

**Ergebnis:** Bilder serverseitig verarbeitet, AI-Import ohne Client-Key, URL-Import mit Web-Suche

---

### Sprint B4: Favoriten + Tags + Admin-UI + Cleanup 📋
**Ziel:** Feature-Parität, User-Verwaltung im Frontend, alte Logik entfernen  
**Status:** ✅ Abgeschlossen

**Bereits vorhanden (DB/Models):**
- DB-Tabellen existieren: `favorites`, `recipe_shares`, `tags`, `recipe_tags` (aus Migration `001_initial`)
- SQLAlchemy Models existieren: `Favorite`, `RecipeShare`, `Tag`, `RecipeTag`
- Backend: `GET /v1/admin/users`, `PUT /v1/admin/users/{id}/role` (seit B1)
- Auto-Provisioning: Neue User erhalten Rolle `pending` (kein Rezeptzugriff)

**Erledigte Tasks:**
- [x] `GET /v1/favorites` — Favoriten-Liste des aktuellen Users
- [x] `POST /v1/favorites/{recipeId}` — Favorit setzen
- [x] `DELETE /v1/favorites/{recipeId}` — Favorit entfernen
- [x] Frontend: Favoriten auf API umstellen (aktuell nur IndexedDB)
- [x] `GET /v1/tags` — Alle Tags mit Rezeptanzahl
- [x] Settings-Seite aufräumen (WebDAV-Section entfernen, deprecated Felder bereinigen)
- [x] `cloud.ts` komplett gelöscht, WebDAV-Code aus Gallery.vue, Administration.vue, AppNavbar.vue, store/actions.ts entfernt
- [x] `webdav`-NPM-Dependency entfernt
- [x] `types/settings.ts`: deprecated Interfaces (WebDAVCredentials, WebDAVSettings, AISettings) + Felder entfernt
- [x] Datenmigration `cookbook.yaml` → PostgreSQL (bereits durchgeführt)
- [x] Frontend: Admin-Seite → User-Liste mit Name, E-Mail, Rolle, letztem Login, Erstelldatum
- [x] Frontend: Rollen-Dropdown pro User → `pending` | `readonly` | `editor` | `admin`
- [x] Frontend: Pendente User hervorgehoben (Badge + `table-warning`)
- [x] Frontend: Pending-Hinweis für nicht freigeschaltete User (Alert in Gallery)
- [x] OIDC-Profil-Sync: `email`, `given_name`, `family_name` aus Token bei jedem Login in DB (Migration `003_user_profile_fields`)
- [x] Navbar: Initialen-Avatar statt Username, User- + Settings-Dropdown zusammengelegt
- [x] AI-Import aus Administration.vue entfernt (nur noch in Galerie verfügbar)

**Offene Tasks — Rollen:**
- [x] Frontend: Rollenbasierte UI-Sichtbarkeit — Settings.vue `read_only`-Toggle disabled für readonly/pending, Recipe.vue pending-Guard, RecipeFabMenu leerer FAB-Fix

**Offene Tasks — Restarbeiten:**
- [x] End-to-End-Test: Manuell durchgetestet, alles funktioniert ohne WebDAV

**Ergebnis:** Admin kann User verwalten, Rollen-System im Frontend durchgesetzt, WebDAV vollständig abgelöst

---

### Sprint B5: Share-Links + Offline-Cache 📋
**Ziel:** Öffentliche Share-Links, Offline-Lesemodus  
**Status:** Offen

**Bereits vorhanden:**
- DB-Tabellen: `recipe_shares` (aus Migration `001_initial`)
- SQLAlchemy Model: `RecipeShare`
- Frontend-Route `/s/:token` bereits im Router (ohne Guard)

**Tasks — Share-Links:**
- [ ] `POST /v1/recipes/{id}/share` — Share-Link erzeugen (`secrets.token_urlsafe`)
- [ ] `GET /v1/recipes/{id}/shares` — Aktive Share-Links auflisten
- [ ] `DELETE /v1/shares/{shareId}` — Share-Link deaktivieren
- [ ] `GET /v1/shared/{token}` — Rezept öffentlich lesen (kein Auth)
- [ ] `GET /v1/shared/{token}/images/{imgId}` — Bild zum Share (kein Auth)
- [ ] Frontend: Share-Button im Rezept (Link erzeugen + kopieren)
- [ ] Frontend: Route `/s/:token` → Read-only Rezeptansicht implementieren
- [ ] Frontend: Share-Verwaltung (aktive Links anzeigen, widerrufen)

**Tasks — Offline-Cache:**
- [ ] IndexedDB als Read-Cache (Rezeptliste + Details für Offline)
- [ ] Service Worker: Thumbnail-Caching
- [ ] Offline-Erkennung + Toast-Hinweis

**Ergebnis:** Share-Links funktional, Offline-Lesemodus verfügbar

---

## 📝 Bisherige Erkenntnisse (B0–B3)

### Architektur-Entscheidungen
- **`root_path="/api"`** im FastAPI-Backend — nginx proxied `/api/` → Backend, SPA liegt auf `/`
- **`env_file: ./backend/.env`** in docker-compose.yml — Secrets nur in `.env`, **nie** zusätzlich im `environment`-Block (überschreibt mit leerem Wert!)
- **`first_image_id`** in allen Recipe-Responses — ein `DISTINCT ON`-Query pro Rezept statt alle Bilder vorladen
- **`_auto_download_imageurl()`** — beim Create/Update wird `imageurl` serverseitig via httpx heruntergeladen und als echtes Bild gespeichert, dann `imageurl` + `cloud_images` aus `data` entfernt
- **Kein `services/`-Layer nötig** — Business-Logik direkt in Route-Handlern, bei dieser App-Größe ausreichend

### AI-Import Architektur
- **3 Modi:** Freitext (Chat Completions), URL (Responses API + `web_search_preview`), Bild (Chat Completions + Vision)
- **SYSTEM_PROMPT** liegt server-seitig in `ai.py` — Client sendet nur den User-Input
- **`initRecipe()`** muss nach YAML-Parsing angewendet werden (js-yaml setzt leere Felder auf `null`)
- **GPT-Modell** konfigurierbar pro User-Setting (`gpt_model`), wird als Query-Parameter an Backend gesendet

### Docker / Deployment
- **Python 3.14-slim** + Pillow System-Dependencies (`libjpeg62-turbo-dev`, `libwebp-dev`)
- **Volume `recipe_uploads:/app/uploads`** für persistente Bilder
- **`extra_hosts`** im docker-compose kann für DNS-Workarounds genutzt werden
- **Frontend-Rebuild:** `docker compose up -d --build frontend`

### Bekannte offene Punkte
- `extra_hosts: cloud.cehser.de:128.251.187.1` noch in docker-compose (temporärer DNS-Workaround)
- ~~`webdav` NPM-Dependency noch installiert~~ ✅ Entfernt
- ~~`settings.ts` enthält deprecated Felder~~ ✅ Bereinigt
- ~~Favoriten nur lokal (IndexedDB)~~ ✅ Behoben (B4: API + IDB-Fallback)
- ~~`pending`-Rolle als Default für neue User~~ ✅ Implementiert (Auto-Provisioning + Frontend-Hinweis)
- ~~Admin-UI für User-Verwaltung~~ ✅ Implementiert (User-Liste, Rollen-Dropdown, Profildaten via OIDC)
- ⚠️ **Frontend-Config ist Compile-Time!** `VITE_OIDC_AUTHORITY` und `VITE_OIDC_CLIENT_ID` werden von Vite zur Build-Zeit in den JS-Code eingebettet (`import.meta.env`). Das bedeutet: bei Änderungen an der OIDC-Config muss das Frontend-Image neu gebaut werden. **Muss auf Runtime-Config umgestellt werden** (z.B. `/config.json` von nginx ausliefern, oder `window.__CONFIG__` via `envsubst` in `index.html` injizieren), damit nur docker-compose ENV-Variablen geändert werden müssen.

---

### Sprint B6: Hardening & Polish
**Ziel:** Production-Readiness

**Tasks:**
- [ ] **Runtime-Config für Frontend:** `VITE_OIDC_AUTHORITY` + `VITE_OIDC_CLIENT_ID` von Compile-Time (`import.meta.env`) auf Runtime umstellen. Ansatz: nginx `envsubst` injiziert Werte in `/config.json` oder `index.html` beim Container-Start → SPA liest Config per fetch/`window.__CONFIG__` → kein Rebuild bei Config-Änderung nötig.
- [ ] **Runtime-konfigurierbarer AI System-Prompt:** Der SYSTEM_PROMPT in `ai.py` ist aktuell ein hardcoded Python-String. Umstellen auf externe Datei (`prompts/system_prompt.md`), die per Docker-Volume gemountet wird. Default-Prompt wird beim ersten Start aus dem Image in den Mount kopiert, falls noch nicht vorhanden. Ermöglicht Prompt-Anpassungen ohne Rebuild. Auch das Frontend-Duplikat (`src/prompts/SYSTEM_PROMPT.ts`) kann dann entfallen, da AI-Requests ohnehin übers Backend laufen.
- [ ] Error Handling: Globaler Exception Handler (FastAPI)
- [ ] Rate Limiting (AI-Endpunkte)
- [ ] Request-Logging (strukturiert)
- [ ] Input-Sanitization prüfen (bereits durch Pydantic, aber doppelt-checken)
- [ ] CORS nur für erlaubte Origins
- [ ] Backup-Strategie: pg_dump Cronjob
- [ ] README aktualisieren
- [ ] .env.example + Deployment-Doku
- [ ] UI-ROADMAP-FINAL.md aktualisieren

**Ergebnis:** Production-ready Backend

---

### Backlog / Zukunfts-Features 💡

- [ ] **Cross-Instance Rezept-Sharing:** Rezept aus einer Instanz exportieren und in eine andere importieren. Mögliche Ansätze: standardisiertes Austauschformat (z.B. YAML/JSON-Datei mit Bildern als ZIP), öffentlicher Share-Link mit maschinenlesbarem Endpoint (`Accept: application/yaml`), oder Federation-Protokoll zwischen Instanzen. Ziel: Nutzer können Rezepte untereinander teilen, auch wenn sie verschiedene my-cookbook-Instanzen betreiben.

---

## 📋 Sprint-Übersicht

| Sprint | Thema | Voraussetzung | Priorität |
|--------|-------|---------------|-----------|
| **B0** | Backend-Grundgerüst + DB | — | 🔴 Kritisch |
| **B1** | Auth + OIDC + Rollen | B0 | 🔴 Kritisch |
| **B2** | Recipe CRUD API + Frontend-Umstellung | B1 | 🔴 Kritisch |
| **B3** | Bilder + AI-Proxy | B2 | 🔴 Kritisch |
| **B4** | Favoriten + Tags + Admin-UI + Cleanup | B3 | 🔴 Kritisch |
| **B5** | Share-Links + Offline-Cache | B4 | 🟡 Wichtig |
| **B6** | Hardening & Polish | B5 | 🟡 Wichtig |

---

## ⚠️ Risiken & Offene Fragen

### Risiken

| Risiko | Mitigation |
|--------|-----------|
| IdP-Konfiguration komplex | Standard-OIDC, gut dokumentiert; Keycloak bereits vorhanden als Default |
| Migration verliert Daten | UUIDs beibehalten, Validierung nach Migration ✅ (Migration abgeschlossen) |
| Offline-Modus Regression | Phase 1: nur Read-Cache, kein Offline-Write (KISS) |
| Pillow HEIC-Support | HEIC-Konvertierung optional, erstmal JPEG/PNG/WebP |
| Token-Refresh im SPA | `oidc-client-ts` hat Auto-Refresh (Silent Renew), muss aber getestet werden |

### Offene Fragen

- [ ] **IdP-Entscheidung**: Keycloak (vorhanden) oder alternativer OIDC IdP? (Architektur ist IdP-agnostisch)
- [ ] **Domain**: Bleibt die URL gleich? (Wichtig für PWA-Installation, Service Worker)
- [ ] **Parallel-Betrieb**: Übergangsphase mit WebDAV + API gleichzeitig, oder Big-Bang-Umstellung?
- [ ] **Backup**: pg_dump reicht → aber wie oft? Cronjob in Docker?
- [ ] **HTTPS**: Traefik/Caddy als Reverse Proxy vor nginx, oder bereits vorhanden?

---

## 🔗 Abhängigkeiten zur UI-Roadmap

Die Backend-Migration ist **unabhängig** von den offenen UI-Sprints (3-9). Die beste Strategie:

1. **UI-Sprints 3-4** (Wizard + Editor) können **vor oder parallel** zur Backend-Migration erfolgen — sie betreffen nur die Datenschicht-abstrahierung
2. **Backend-Migration** ersetzt die Datenschicht (`cloud.ts`, `recipes.ts`, Store-Actions)
3. **UI-Sprints 5-8** (Workflow-Features) profitieren vom Backend:
   - Session Restore → Server-State statt nur LocalStorage
   - Einkaufsliste → Share-API bleibt Client, Daten kommen aus API
   - URL-Sharing → Einfacher mit Backend-URL statt komprimierter Rezeptdaten

**Empfehlung:** Zuerst das Backend bauen, dann UI-Features darauf aufbauen.

---

*Dieses Dokument wird aktualisiert, sobald Entscheidungen zu den offenen Fragen getroffen werden.*
