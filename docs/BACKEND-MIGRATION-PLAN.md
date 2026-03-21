# Backend-Migrationsplan: WebDAV → Python/FastAPI

> **Planungsnotizen:** Entstanden aus Architektur-Diskussion (März 2026)  
> **Letzte Aktualisierung:** 21. März 2026  
> **Status:** 📋 Planungsphase

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
| **Backend-Framework** | FastAPI + uvicorn | latest | Async, Pydantic-Validierung, Auto-OpenAPI-Docs |
| **Python** | 3.14 | 3.14.x | Aktuellste stabile Version, Support bis Okt 2030 |
| **ORM** | SQLAlchemy 2.0 (async) | 2.x | Type-safe, async-fähig, ausgereift |
| **DB-Migrationen** | Alembic | latest | Standard für SQLAlchemy |
| **Datenbank** | PostgreSQL | 16+ | JSONB für flexible Rezeptdaten, Volltextsuche, zuverlässig |
| **Auth** | OIDC-kompatibler IdP (z.B. Keycloak) | — | Standard-OIDC, IdP austauschbar |
| **JWT-Verify** | PyJWT oder python-jose | latest | Token-Validierung gegen JWKS Public Key des IdP |
| **Bildverarbeitung** | Pillow | latest | Resize, Thumbnails, WebP-Konvertierung |
| **AI-Proxy** | openai (Python SDK) | latest | Erstklassige Python-Unterstützung, Server-seitiger Key |
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
    role            TEXT NOT NULL DEFAULT 'readonly',  -- 'readonly' | 'editor' | 'admin'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login      TIMESTAMPTZ,
    
    CONSTRAINT valid_role CHECK (role IN ('readonly', 'editor', 'admin'))
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

| Rolle | Lesen | Favoriten | Erstellen/Bearbeiten | Löschen | User verwalten |
|-------|-------|-----------|---------------------|---------|---------------|
| **readonly** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **editor** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ |

**Rollen-Zuweisung:**
- Neuer User → automatisch `readonly` (sicherer Default)
- Admin kann Rollen über UI ändern (Settings-Seite)
- Rolle steht in `app_users.role`, **nicht** im IdP (einfacher, keine IdP-Admin-API nötig)

### Auto-User-Provisioning

Beim ersten API-Request eines neuen OIDC-Users:
1. Token ist gültig → `sub` (UUID) ist bekannt
2. User existiert nicht in `app_users` → Auto-Create mit Rolle `readonly`
3. `display_name` aus `preferred_username` Claim
4. Admin wird per Toast benachrichtigt: "Neuer Nutzer registriert"

---

## 🌐 API-Design

### Endpunkte

```
Basis-URL: /api/v1

── Rezepte ──────────────────────────────────────────────
GET    /recipes                  → Liste (Suche, Filter, Sortierung, Pagination)
GET    /recipes/:id              → Einzelnes Rezept (mit Bild-URLs)
POST   /recipes                  → Neues Rezept               [editor, admin]
PUT    /recipes/:id              → Rezept aktualisieren        [editor, admin]
DELETE /recipes/:id              → Rezept löschen              [admin]

── Bilder ───────────────────────────────────────────────
POST   /recipes/:id/images       → Bild hochladen             [editor, admin]
DELETE /recipes/:id/images/:imgId → Bild löschen              [editor, admin]
GET    /images/:id                → Bild ausliefern (Query: ?size=thumb|full)

── Favoriten ────────────────────────────────────────────
GET    /favorites                 → Meine Favoriten (Recipe-IDs)
POST   /favorites/:recipeId       → Favorit setzen
DELETE /favorites/:recipeId       → Favorit entfernen

── Tags ─────────────────────────────────────────────────
GET    /tags                      → Alle Tags (mit Anzahl)
POST   /recipes/:id/tags          → Tags setzen               [editor, admin]

── Share (öffentliche Links) ─────────────────────────────
POST   /recipes/:id/share         → Share-Link erzeugen        [editor, admin]
GET    /recipes/:id/shares         → Aktive Links auflisten     [editor, admin]
DELETE /shares/:shareId            → Share-Link deaktivieren    [editor, admin]
GET    /shared/:token              → Rezept lesen               [kein Auth nötig]
GET    /shared/:token/images/:imgId → Bild zum Share            [kein Auth nötig]

── AI ───────────────────────────────────────────────────
POST   /ai/import                 → AI-Rezeptimport            [editor, admin]
POST   /ai/import/image           → Bild → AI → Rezept        [editor, admin]

── Admin ────────────────────────────────────────────────
GET    /admin/users               → Alle User                  [admin]
PUT    /admin/users/:id/role      → Rolle ändern               [admin]

── System ───────────────────────────────────────────────
GET    /health                    → Health-Check (kein Auth)
GET    /docs                      → Swagger UI (Auto-generiert)
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
GET /api/v1/images/{image-id}?size=thumb   → Thumbnail
GET /api/v1/images/{image-id}?size=original → Original
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
  api/
    client.ts              ← Axios/fetch Wrapper mit Token-Injection
    recipes.ts             ← getRecipes(), getRecipe(), createRecipe(), ...
    images.ts              ← uploadImage(), getImageUrl()
    favorites.ts           ← getFavorites(), toggleFavorite()
    ai.ts                  ← importFromText(), importFromImage()
    tags.ts                ← getTags(), setRecipeTags()
    admin.ts               ← getUsers(), updateUserRole()
    shares.ts              ← createShareLink(), getShareLinks(), revokeShare()
  auth/
    oidc.ts                ← OIDC-Init, Token-Refresh, Login/Logout (via oidc-client-ts)
    guards.ts              ← Router Guards (Auth-Check, Rollen-Check)
```

### Zu entfernende Client-Dateien

```
src/js/cloud.ts            ← WebDAV-Logik komplett
src/js/recipes.ts          ← mergeCookbooks() etc. (Sync-Logik)
```

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
    environment:
      - DATABASE_URL=postgresql+asyncpg://cookbook:${DB_PASSWORD}@db:5432/cookbook
      - OIDC_ISSUER_URL=${OIDC_ISSUER_URL}
      - OIDC_AUDIENCE=${OIDC_AUDIENCE:-my-cookbook-api}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
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
│   ├── main.py                    # FastAPI App, CORS, Lifespan
│   ├── config.py                  # pydantic-settings (ENV-Vars)
│   ├── database.py                # AsyncEngine, AsyncSession
│   │
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── oidc.py                # Token-Verify (JWKS, offline, IdP-agnostisch)
│   │   └── dependencies.py        # get_current_user, require_editor, require_admin
│   │
│   ├── models/                    # SQLAlchemy Models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── recipe.py
│   │   ├── image.py
│   │   ├── favorite.py
│   │   ├── tag.py
│   │   └── share.py
│   │
│   ├── schemas/                   # Pydantic Request/Response Models
│   │   ├── __init__.py
│   │   ├── recipe.py              # RecipeCreate, RecipeUpdate, RecipeResponse, RecipeList
│   │   ├── user.py                # UserResponse, UserRoleUpdate
│   │   ├── image.py               # ImageResponse
│   │   ├── share.py               # ShareCreate, ShareResponse
│   │   └── ai.py                  # AIImportRequest, AIImportResponse
│   │
│   ├── routes/                    # API-Router
│   │   ├── __init__.py
│   │   ├── recipes.py
│   │   ├── images.py
│   │   ├── favorites.py
│   │   ├── tags.py
│   │   ├── ai_import.py
│   │   ├── shares.py
│   │   └── admin.py
│   │
│   └── services/                  # Business-Logik
│       ├── __init__.py
│       ├── recipe_service.py
│       ├── image_processor.py     # Pillow: Resize, WebP, Thumbnails
│       └── ai_service.py          # OpenAI SDK Wrapper
│
├── alembic/                       # DB-Migrationen
│   ├── env.py
│   └── versions/
│
├── scripts/
│   └── migrate_from_yaml.py       # Einmaliges Migrations-Script: YAML → PostgreSQL
│
├── tests/
│   ├── conftest.py
│   ├── test_recipes.py
│   ├── test_auth.py
│   └── test_images.py
│
├── alembic.ini
├── requirements.txt
├── Dockerfile
└── .env.example
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
httpx>=0.28               # Async HTTP (OIDC JWKS fetch)
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
   e. cloud_images → Bilder vom WebDAV herunterladen
      → in uploads/{uuid}/originals/ speichern
      → Thumbnails generieren
      → recipe_images Einträge erstellen
3. Erste Admin-User manuell anlegen
4. Validierung: Anzahl Rezepte, Bilder-Integrität prüfen
```

### Migrations-Checkliste

- [ ] `cookbook.yaml` → PostgreSQL Rezepte
- [ ] Bestehende UUIDs als Primary Keys übernehmen
- [ ] Tags extrahieren und normalisieren
- [ ] Bilder von WebDAV herunterladen
- [ ] Thumbnails generieren
- [ ] Favoriten: Einmalig aus IndexedDB eines Referenz-Browsers exportieren (optional)
- [ ] Smoke-Test: Alle Rezepte über API abrufbar
- [ ] Bild-URLs funktionieren
- [ ] Volltextsuche liefert Ergebnisse

---

## 📋 Sprint-Plan (Backend-Migration)

### Sprint B0: Backend-Grundgerüst
**Ziel:** Lauffähiges FastAPI-Projekt mit DB-Anbindung

**Tasks:**
- [ ] Backend-Projektstruktur anlegen
- [ ] FastAPI App mit CORS, Health-Endpoint
- [ ] PostgreSQL in docker-compose.yml
- [ ] SQLAlchemy Async-Setup + Models
- [ ] Alembic Init + erste Migration (Schema erstellen)
- [ ] Basis-Config (pydantic-settings, .env)
- [ ] Backend-Dockerfile
- [ ] docker-compose.yml erweitern (frontend + backend + db)

**Ergebnis:** `GET /health` → `200 OK`, DB verbunden

---

### Sprint B1: Auth + User-Management
**Ziel:** OIDC-Integration, Rollen-System

**Tasks:**
- [ ] OIDC IdP konfigurieren (Client für SPA + Audience für API)
- [ ] JWT-Verify Middleware (JWKS, offline via `.well-known/openid-configuration`)
- [ ] `get_current_user` Dependency
- [ ] Auto-User-Provisioning (`readonly` Default)
- [ ] Rollen-Check Dependencies (`require_editor`, `require_admin`)
- [ ] Admin-Endpunkte: GET /admin/users, PUT /admin/users/:id/role
- [ ] Frontend: `oidc-client-ts` Integration
- [ ] Frontend: Router Guards (Auth-Check)
- [ ] Frontend: Token in API-Requests (Axios Interceptor)

**Ergebnis:** Login via OIDC IdP, Rollen funktionieren, API geschützt

---

### Sprint B2: Recipe CRUD API
**Ziel:** Rezepte über API laden, erstellen, bearbeiten, löschen

**Tasks:**
- [ ] GET /recipes (Liste mit Suche, Filter, Sort, Pagination)
- [ ] GET /recipes/:id (Einzelnes Rezept)
- [ ] POST /recipes (Neues Rezept, Pydantic-Validierung)
- [ ] PUT /recipes/:id (Update)
- [ ] DELETE /recipes/:id (nur Admin)
- [ ] Volltextsuche (tsvector + Trigger)
- [ ] Tags: GET /tags, POST /recipes/:id/tags
- [ ] Frontend: API-Client (`src/api/`) erstellen
- [ ] Frontend: Store-Actions auf API umstellen
- [ ] Frontend: WebDAV-Code entfernen

**Ergebnis:** Rezepte vollständig über API verwaltet statt WebDAV

---

### Sprint B3: Bilder + AI-Proxy
**Ziel:** Bild-Upload/Auslieferung + AI-Import über Backend

**Tasks:**
- [ ] POST /recipes/:id/images (Upload + Pillow-Processing)
- [ ] GET /images/:id (Auslieferung mit Caching-Headers)
- [ ] DELETE /recipes/:id/images/:imgId
- [ ] Thumbnail-Generierung (400px WebP)
- [ ] Optimierte Bilder (1200px WebP)
- [ ] POST /ai/import (Text → Rezept via OpenAI)
- [ ] POST /ai/import/image (Bild → Rezept via OpenAI Vision)
- [ ] Frontend: Bild-Upload auf API umstellen
- [ ] Frontend: AI-Import auf API umstellen
- [ ] Frontend: OpenAI-Key aus Settings entfernen

**Ergebnis:** Bilder serverseitig verarbeitet, AI ohne Client-Key

---

### Sprint B4: Favoriten + Share-Links + Offline-Cache + Cleanup
**Ziel:** Feature-Parität, Share-Links, Offline-Modus, alte Logik entfernen

**Tasks:**
- [ ] GET/POST/DELETE /favorites
- [ ] Frontend: Favoriten auf API umstellen
- [ ] Share-Links: POST/GET/DELETE Endpunkte + `recipe_shares` Tabelle
- [ ] Share-Links: GET /shared/:token (öffentlich, kein Auth)
- [ ] Frontend: Share-Button im Rezept (Link erzeugen + kopieren)
- [ ] Frontend: Route `/s/:token` → Read-only Rezeptansicht (ohne Login)
- [ ] Frontend: Share-Verwaltung (aktive Links anzeigen, widerrufen)
- [ ] IndexedDB als Read-Cache (Rezeptliste + Details)
- [ ] Service Worker: Thumbnail-Caching
- [ ] Offline-Erkennung + Toast-Hinweis
- [ ] Settings-Seite aufräumen (WebDAV-Section entfernen)
- [ ] `cloud.ts` und `recipes.ts` Sync-Logik entfernen
- [ ] Migrations-Script: cookbook.yaml → PostgreSQL
- [ ] Bilder von WebDAV migrieren
- [ ] End-to-End-Test: Alles funktioniert ohne WebDAV

**Ergebnis:** Feature-Parität erreicht, Share-Links funktional, WebDAV vollständig abgelöst

---

### Sprint B5: Hardening & Polish
**Ziel:** Production-Readiness

**Tasks:**
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

## 📋 Sprint-Übersicht

| Sprint | Thema | Voraussetzung | Priorität |
|--------|-------|---------------|-----------|
| **B0** | Backend-Grundgerüst + DB | — | 🔴 Kritisch |
| **B1** | Auth + OIDC + Rollen | B0 | 🔴 Kritisch |
| **B2** | Recipe CRUD API + Frontend-Umstellung | B1 | 🔴 Kritisch |
| **B3** | Bilder + AI-Proxy | B2 | 🔴 Kritisch |
| **B4** | Favoriten + Share-Links + Offline + Migration + Cleanup | B3 | 🔴 Kritisch |
| **B5** | Hardening & Polish | B4 | 🟡 Wichtig |

---

## ⚠️ Risiken & Offene Fragen

### Risiken

| Risiko | Mitigation |
|--------|-----------|
| IdP-Konfiguration komplex | Standard-OIDC, gut dokumentiert; Keycloak bereits vorhanden als Default |
| Migration verliert Daten | UUIDs beibehalten, Validierung nach Migration, WebDAV als Backup behalten |
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
