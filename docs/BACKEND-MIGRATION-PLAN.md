# Backend-Migrationsplan: WebDAV → Python/FastAPI

> **Planungsnotizen:** Entstanden aus Architektur-Diskussion (März 2026)  
> **Letzte Aktualisierung:** 30. März 2026  
> **Status:** ✅ B0–B5 abgeschlossen, B6 Hardening (Sanitization-Audit ✅, Rate Limiting + Logging zurückgestellt, README offen)

---

## ✅ Sprint D1: Datenformat-Normalisierung (Ingredients & Yields)

> **Priorität:** 🔴 Kritisch (Blocker für typsichere Validierung)  
> **Status:** ✅ Abgeschlossen (24. März 2026)  
> **Ergebnis:** Einheitliches, validierbares Datenformat in DB, Backend, Frontend und AI-Prompt
>
> **Durchgeführt:**
> - Alembic-Migration `005_normalize_recipe_data` erstellt und ausgeführt (17 Rezepte migriert)
> - DB-Validierung: 0 Ingredients ohne `name`, 0 Yields ohne `unit`, 0 String-Amounts
> - Backend-Schemas komplett neu geschrieben (feste Keys, model_validators)
> - Frontend: 18 Dateien aktualisiert, alle `Object.keys()`-Patterns entfernt
> - AI-Prompts (Backend + Frontend) auf neues Format umgestellt
> - YAML-Samples konvertiert
> - Build erfolgreich (353 Module, keine Fehler)

### Problemstellung

Die aktuelle Datenstruktur nutzt **dynamische JSON-Keys** für Ingredients und Yields, was Validierung nahezu unmöglich macht:

```jsonc
// ❌ AKTUELL: dynamische Keys — nicht typisierbar
{
  "ingredients": [
    { "Rosinen": { "amounts": [{"amount": 100, "unit": "g"}] }, "section": "" },
    { "Mehl":    { "amounts": [{"amount": 250, "unit": "g"}] }, "section": "Teig" }
  ],
  "yields": [ {"Portionen": 4} ]
}
```

**Folgeprobleme:**
- Pydantic-Schemas brauchen `extra="allow"` + `model_validator` → `dict`-Escape
- Frontend nutzt überall `Object.keys(ingredient).filter(k => k !== 'section')[0]`
- AI liefert `amount: "100"` (String statt Number) — keine Validierung greift
- Umbenennen = `delete oldKey` + `create newKey` statt `ingredient.name = newName`

### Zielformat

```jsonc
// ✅ NEU: feste Keys — trivial validierbar
{
  "ingredients": [
    { "name": "Rosinen", "amounts": [{"amount": 100, "unit": "g"}], "section": "" },
    { "name": "Mehl",    "amounts": [{"amount": 250, "unit": "g"}], "section": "Teig" }
  ],
  "yields": [ {"unit": "Portionen", "value": 4} ]
}
```

### Betroffene Dateien (vollständige Inventur)

#### Backend (3 Dateien)

| Datei | Was ändert sich |
|-------|----------------|
| `backend/app/schemas/recipe.py` | `Ingredient` bekommt festes `name`-Feld, kein `extra="allow"` mehr. `RecipeData.yields` wird `list[YieldEntry]`. `normalize_recipe_data()` vereinfacht sich massiv. |
| `backend/app/routes/ai.py` | SYSTEM_PROMPT: YAML-Schema auf neues Format umstellen |
| `backend/scripts/migrate_yaml.py` | Optional: Falls YAML-Re-Import nötig |

#### Alembic-Migration (1 neue Datei)

| Datei | Was passiert |
|-------|-------------|
| `backend/alembic/versions/005_normalize_recipe_data.py` | SQL-UPDATE transformiert alle bestehenden JSONB-Daten in der DB |

#### Frontend (13 Dateien)

| Datei | Zeilen | Was ändert sich |
|-------|--------|----------------|
| `src/types/recipe.ts` | 6, 24 | `Ingredient`-Interface: Index-Signatur → `name: string`. `Yield`-Interface: Index-Signatur → `{unit: string, value: number}` |
| `src/composables/useRecipeHelper.ts` | 108, 116, 222-256 | Yields: `Object.keys(yields[0])[0]` → `yields[0].unit`. Ingredients: `Object.keys(ingredient)[0]` → `ingredient.name` |
| `src/js/recipes.ts` | 111-131 | `initRecipe` Typ-Coercion: kein Key-Scan mehr, direkt `ingredient.amounts` |
| `src/components/edit/IngredientEdit.vue` | 101-134 | `Object.keys(ingredient)[0]` → `ingredient.name`, `.amounts` direkt |
| `src/components/edit/IngredientNotesFormRow.vue` | 43-63 | Gleich: Dynamic-Key-Zugriff → `ingredient.name` |
| `src/components/edit/IngredientModalDialogRename.vue` | 6, 45-49 | Rename: `delete+create` → `ingredient.name = newName` |
| `src/components/edit/SectionIngredientsEdit.vue` | — | Props/Events prüfen, ggf. Typ-Anpassung |
| `src/components/recipe/display/IngredientInlineEdit.vue` | 47-51, 115-135, 270-293 | Komplexeste Datei: Display, Rename, Undo — alles auf `.name` umstellen |
| `src/components/recipe/display/IngredientsSection.vue` | 108-117 | `Object.keys(ingredient).filter(...)` → `ingredient.name` |
| `src/views/Edit.vue` | 599-601 | Neue Zutat: `{"Neue Zutat": {amounts:...}}` → `{name: "Neue Zutat", amounts:...}` |
| `src/views/Recipe.vue` | 752-755 | Rename-Handler: `delete+create` → `.name = newName` |
| `src/views/SharedRecipe.vue` | 235-259 | Yields + Ingredients: Dynamic-Key-Zugriff → feste Felder |
| `src/prompts/SYSTEM_PROMPT.ts` | 30-40 | YAML-Schema-Vorlage auf neues Format umstellen |

### Umsetzungsplan (Reihenfolge)

#### Phase 1: Backend-Schema + DB-Migration

**Schritt 1.1 — Pydantic-Schemas sauber definieren**

```python
# backend/app/schemas/recipe.py

class Amount(BaseModel):
    amount: float | int | None = None
    unit: str = ""

class Ingredient(BaseModel):
    name: str
    amounts: list[Amount] = []
    section: str = ""

class YieldEntry(BaseModel):
    unit: str
    value: float | int

class Step(BaseModel):
    step: str
    haccp: dict[str, Any] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)
    section: str = ""

class Section(BaseModel):
    section: str = ""

class RecipeData(BaseModel):
    author: str | None = None
    source_url: str | None = None
    source_book: str | None = None
    # ... (Metadaten bleiben gleich)
    yields: list[YieldEntry] | None = None
    ingredients: list[Ingredient] = []
    steps: list[Step] = []
    sections: list[Section] = Field(default_factory=lambda: [Section()])
    imageurl: str | None = None
    recalc_exp: float | None = None
    model_config = {"extra": "allow"}
```

Kein `extra="allow"` auf Ingredient, kein `model_validator`, kein `dict`-Bypass.

**Schritt 1.2 — Alembic-Migration (SQL-Transformation)**

```sql
-- 005_normalize_recipe_data.py

-- Ingredients: { "Mehl": { "amounts": [...] }, "section": "" }
--           → { "name": "Mehl", "amounts": [...], "section": "" }
UPDATE recipes SET data = jsonb_set(
  data, '{ingredients}',
  (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'name', (SELECT k FROM jsonb_object_keys(elem) k WHERE k != 'section' LIMIT 1),
        'amounts', elem -> (SELECT k FROM jsonb_object_keys(elem) k WHERE k != 'section' LIMIT 1) -> 'amounts',
        'section', coalesce(elem->>'section', '')
      )
    ), '[]'::jsonb)
    FROM jsonb_array_elements(data->'ingredients') elem
  )
)
WHERE data ? 'ingredients'
  AND jsonb_array_length(data->'ingredients') > 0;

-- Yields: { "Portionen": 4 } → { "unit": "Portionen", "value": 4 }
UPDATE recipes SET data = jsonb_set(
  data, '{yields}',
  (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'unit', kv.key,
        'value', CASE
          WHEN jsonb_typeof(kv.value) = 'string' THEN to_jsonb((kv.value#>>'{}')::numeric)
          ELSE kv.value
        END
      )
    ), '[]'::jsonb)
    FROM jsonb_array_elements(data->'yields') elem,
         jsonb_each(elem) kv
  )
)
WHERE data ? 'yields'
  AND jsonb_array_length(coalesce(data->'yields', '[]'::jsonb)) > 0;

-- Amounts: String → Number (Sicherheitsnetz)
UPDATE recipes SET data = jsonb_set(
  data, '{ingredients}',
  (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'name', ing->>'name',
        'amounts', (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object(
              'amount', CASE
                WHEN jsonb_typeof(a->'amount') = 'string'
                  AND a->>'amount' ~ '^\d+\.?\d*$'
                THEN to_jsonb((a->>'amount')::numeric)
                ELSE a->'amount'
              END,
              'unit', coalesce(a->>'unit', '')
            )
          ), '[]'::jsonb)
          FROM jsonb_array_elements(ing->'amounts') a
        ),
        'section', coalesce(ing->>'section', '')
      )
    ), '[]'::jsonb)
    FROM jsonb_array_elements(data->'ingredients') ing
  )
)
WHERE data ? 'ingredients'
  AND jsonb_array_length(data->'ingredients') > 0;
```

**Schritt 1.3 — normalize_recipe_data() vereinfachen**

```python
def normalize_recipe_data(data: dict) -> dict:
    for ing in data.get("ingredients", []):
        if isinstance(ing, dict):
            ing.setdefault("section", "")
            for amt in ing.get("amounts", []):
                if isinstance(amt, dict):
                    amt["amount"] = _to_number(amt.get("amount"))
                    amt.setdefault("unit", "")
    for yld in data.get("yields", []) or []:
        if isinstance(yld, dict):
            yld["value"] = _to_number(yld.get("value")) or 0
    if not data.get("sections"):
        data["sections"] = [{"section": ""}]
    return data
```

**Schritt 1.4 — Route-Code aufräumen**

In `recipes.py`: `body.data` ist jetzt immer `RecipeData`, kein `isinstance(body.data, dict)` mehr nötig.

```python
# create_recipe:
data = body.data.model_dump(exclude_none=True)
data = normalize_recipe_data(data)

# update_recipe:
if body.data is not None:
    recipe.data = normalize_recipe_data(body.data.model_dump(exclude_none=True))
```

#### Phase 2: AI-Prompt updaten

**Schritt 2.1 — Backend-Prompt (`ai.py`) und Frontend-Prompt (`SYSTEM_PROMPT.ts`)**

```yaml
# NEUES YAML-Zielschema
ingredients:
  - name: <ingredient-name>
    amounts:
      - amount: <number-or-null>    # MUSS Zahl oder null sein
        unit: <unit-string>
    section: <section-or-empty>
yields:
  - unit: <key>
    value: <number>                  # MUSS Zahl sein
```

#### Phase 3: Frontend-Typen + Composables

**Schritt 3.1 — TypeScript-Interfaces (`types/recipe.ts`)**

```typescript
// ALT:
export interface Ingredient {
  [name: string]: { amounts: Amount[] } | string
  section: string
}
export interface Yield {
  [key: string]: number | string
}

// NEU:
export interface Ingredient {
  name: string
  amounts: Amount[]
  section: string
}
export interface Yield {
  unit: string
  value: number
}
```

**Schritt 3.2 — `useRecipeHelper.ts` (Portionsberechnung)**

```typescript
// ALT:
const yields_unit = computed(() => Object.keys(recipe.yields[0])[0])
const yields_value = computed(() => recipe.yields[0][yields_unit.value])

// NEU:
const yields_unit = computed(() => recipe.yields[0].unit)
const yields_value = computed(() => recipe.yields[0].value)
```

```typescript
// ALT (Ingredient-Name):
const name = Object.keys(ingredient)[0]
const data = ingredient[name]

// NEU:
const name = ingredient.name
const amounts = ingredient.amounts
```

**Schritt 3.3 — `initRecipe()` in `js/recipes.ts`**

```typescript
// ALT:
for (const key of Object.keys(ingredient)) {
  if (key === 'section') continue
  const val = ingredient[key]
  if (val && typeof val === 'object' && 'amounts' in val) { ... }
}

// NEU:
for (const amt of ingredient.amounts || []) {
  amt.amount = toNumber(amt.amount) as any
}
```

#### Phase 4: Frontend-Komponenten

**Schritt 4.1 — Display-Komponenten (einfachster Impact)**

| Komponente | Muster ALT → NEU |
|-----------|-----------------|
| `IngredientsSection.vue` | `Object.keys(ing).filter(k => k !== 'section')[0]` → `ing.name` |
| `PortionControl.vue` | Props kommen aus Composable — folgt automatisch |
| `MobileIngredientsBar.vue` | Durchreiche — keine eigene Logik |

**Schritt 4.2 — Edit-Komponenten (mittlerer Impact)**

| Komponente | Muster ALT → NEU |
|-----------|-----------------|
| `IngredientEdit.vue` | `ingredient[Object.keys(ingredient)[0]]` → `ingredient` (direkt) |
| `IngredientNotesFormRow.vue` | Gleich: Key-Scan → direkt |
| `SectionIngredientsEdit.vue` | Props prüfen |

**Schritt 4.3 — Rename/Inline-Edit (höchster Impact)**

| Komponente | Muster ALT → NEU |
|-----------|-----------------|
| `IngredientModalDialogRename.vue` | `delete ingredient[oldName]; ingredient[newName] = data` → `ingredient.name = newName` |
| `IngredientInlineEdit.vue` | Komplexeste Datei: Display, Rename, Undo → alles auf `.name` / `.amounts` |
| `Recipe.vue` (Rename-Handler) | `delete + create` → `ingredient.name = newName` |

**Schritt 4.4 — Views**

| View | Was ändert sich |
|------|----------------|
| `Edit.vue` | Neue Zutat: `{name: "Neue Zutat", amounts: [{amount: null, unit: ""}], section: ""}` |
| `Recipe.vue` | Rename-Handler, Yields-Zugriff |
| `SharedRecipe.vue` | Yields-Zugriff, Ingredient-Iteration |

### Reihenfolge & Abhängigkeiten

```
┌─────────────────────────────┐
│ 1. Alembic-Migration (DB)   │  ← Transformiert alle bestehenden Daten
│    005_normalize_recipe_data │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│ 2. Backend-Schemas          │  ← Saubere Pydantic-Modelle
│    recipe.py (Schemas)      │
│    recipes.py (Routes)      │
│    ai.py (System-Prompt)    │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│ 3. Frontend-Typen           │  ← TypeScript-Interfaces
│    types/recipe.ts          │
│    js/recipes.ts            │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│ 4. Frontend-Logik           │  ← Composables + Store
│    useRecipeHelper.ts       │
│    store/actions.ts         │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│ 5. Frontend-Komponenten     │  ← Von innen nach außen
│    Display → Edit → Views   │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│ 6. AI-Prompt (Frontend)     │  ← SYSTEM_PROMPT.ts
│    + Build + Test           │
└─────────────────────────────┘
```

### Validierung nach Migration

```bash
# 1. DB-Check: Keine Ingredients mit dynamischen Keys mehr
SELECT count(*) FROM recipes r,
  jsonb_array_elements(r.data->'ingredients') ing
WHERE NOT (ing ? 'name');
-- Erwartet: 0

# 2. DB-Check: Alle Yields haben unit + value
SELECT count(*) FROM recipes r,
  jsonb_array_elements(coalesce(r.data->'yields', '[]'::jsonb)) yld
WHERE NOT (yld ? 'unit' AND yld ? 'value');
-- Erwartet: 0

# 3. DB-Check: Keine String-Amounts mehr
SELECT count(*) FROM recipes r,
  jsonb_array_elements(r.data->'ingredients') ing,
  jsonb_array_elements(ing->'amounts') amt
WHERE jsonb_typeof(amt->'amount') = 'string';
-- Erwartet: 0

# 4. Funktionstest: Rezept öffnen, Portionen ändern, speichern
# 5. Funktionstest: AI-Import (Text + URL)
# 6. Funktionstest: Rezept bearbeiten (Zutat umbenennen, hinzufügen, löschen)
# 7. Funktionstest: Share-Link öffnen
```

### Rollback-Plan

- Alembic-Migration hat `downgrade()`: Reverse-SQL transformiert zurück ins alte Format
- Git-Revert auf den Commit vor der Migration
- DB-Backup **vor** der Migration erstellen: `docker compose exec db pg_dump -U cookbook > backup_pre_d1.sql`

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

── Share (B5) ───────────────────────────────────────────
POST   /v1/recipes/:id/share      → Share-Link erzeugen [editor, admin]   ✅
GET    /v1/recipes/:id/shares     → Aktive Links auflisten                 ✅
DELETE /v1/shares/:shareId        → Share-Link deaktivieren                ✅
GET    /v1/shared/:token          → Rezept lesen (kein Auth)              ✅
── (Bilder-Endpoint /v1/images/:id bereits öffentlich, kein separater Share-Endpunkt nötig)
── Share (B5) ───────────────────────────────────────────
POST   /v1/recipes/:id/share      → Share-Link erzeugen [editor, admin]   ✅
GET    /v1/recipes/:id/shares     → Aktive Links auflisten                 ✅
DELETE /v1/shares/:shareId        → Share-Link deaktivieren                ✅
GET    /v1/shared/:token          → Rezept lesen (kein Auth)              ✅
── (Bilder-Endpoint /v1/images/:id bereits öffentlich, kein separater Share-Endpunkt nötig)
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
    admin.ts               ← ✅ listShares(), revokeShare() + AdminShare Interface (B5)
    shares.ts              ← ⬜ Noch nicht implementiert
  auth/                            ← ✅ Implementiert
    oidc.ts                ← UserManager-Wrapper, Login/Logout, Token-Refresh
    guards.ts              ← requireAuth, requireRole('editor','admin') Route Guards
  components/
    recipe/display/
      RecipeDisplay.vue    ← ✅ Shared Display-Komponente (Split-View, Portionen, Yields, Sections)
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

## 📁 Projektstruktur

```
my-cookbook/
├── .env                               # Zentrales Environment (OIDC, DB, OpenAI, CORS)
├── .env.example                       # Vorlage mit allen Variablen
├── docker-compose.yml                 # Frontend + Backend + DB Orchestrierung
├── README.md
├── scripts/
│   └── backup.sh                      # pg_dump Backup mit Rotation
├── docs/
│   ├── BACKEND-MIGRATION-PLAN.md
│   └── UI-ROADMAP-FINAL.md
│
├── frontend/                          # Vue 3 SPA (PWA)
│   ├── Dockerfile                     # Multi-Stage: node build → nginx serve
│   ├── .docker/nginx/                 # nginx config + runtime config injection
│   │   ├── prod.conf
│   │   ├── config.js.template         # envsubst Template → window.__CONFIG__
│   │   └── docker-entrypoint.sh       # Injiziert OIDC-Config beim Container-Start
│   ├── package.json
│   ├── vite.config.js
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/                        # Statische Assets (icons, config.js dev-fallback)
│   └── src/
│       ├── main.ts                    # App-Bootstrap + globaler Error Handler
│       ├── auth/oidc.ts               # OIDC via window.__CONFIG__ (Runtime)
│       ├── api/                       # API-Client (recipes, images, ai, ...)
│       ├── components/                # Vue-Komponenten (6 Ordner)
│       ├── composables/               # useToast, useRecipeHelper, useViewport
│       ├── store/                     # Vuex (actions, mutations, modules)
│       ├── router/                    # Vue Router + Chunk-Error-Handler
│       ├── views/                     # Page-Komponenten
│       └── types/                     # TypeScript Interfaces
│
└── backend/                           # FastAPI + PostgreSQL
    ├── Dockerfile
    ├── requirements.txt
    ├── alembic.ini
    ├── prompts/
    │   └── system_prompt.md           # AI System-Prompt (extern, per Volume änderbar)
    ├── alembic/
    │   ├── env.py                     # Liest DB-URL aus app.config.settings
    │   └── versions/
    └── app/
        ├── main.py                    # FastAPI App, CORS, Lifespan, Exception Handler
        ├── config.py                  # pydantic-settings (DB_*, OIDC_*, CORS, Uploads)
        ├── database.py                # AsyncEngine, AsyncSession Factory
        ├── auth/                      # OIDC Token-Verify, Dependencies
        ├── models/                    # SQLAlchemy Models (User, Recipe, Image, Tag, ...)
        ├── schemas/                   # Pydantic Request/Response Models
        ├── routes/                    # API-Router (recipes, images, ai, admin, ...)
        └── services/
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

### Sprint B5: Share-Links + Offline-Cache + Refactoring 📋
**Ziel:** Öffentliche Share-Links, Offline-Lesemodus, Code-Qualität  
**Status:** ✅ Share-Links + Refactoring abgeschlossen (24. März 2026), Offline-Cache offen

**Bereits vorhanden:**
- DB-Tabellen: `recipe_shares` (aus Migration `001_initial`)
- SQLAlchemy Model: `RecipeShare`
- Frontend-Route `/s/:token` bereits im Router (ohne Guard)

**Tasks — Share-Links:**
- [x] `POST /v1/recipes/{id}/share` — Share-Link erzeugen (`secrets.token_urlsafe`)
- [x] `GET /v1/recipes/{id}/shares` — Aktive Share-Links auflisten
- [x] `DELETE /v1/shares/{shareId}` — Share-Link deaktivieren
- [x] `GET /v1/shared/{token}` — Rezept öffentlich lesen (kein Auth)
- [x] Bilder-Endpoint `/v1/images/{id}` bereits öffentlich → kein separater Share-Bild-Endpunkt nötig
- [x] Frontend: Share-Button im Rezept (Link erzeugen + kopieren)
- [x] Frontend: Route `/s/:token` → Read-only Rezeptansicht implementiert (SharedRecipe.vue)
- [x] Frontend: Share-Verwaltung (ShareManager.vue — aktive Links anzeigen, widerrufen)

**Tasks — Admin Share-Links (24. März 2026):**
- [x] `GET /v1/admin/shares` — Alle Share-Links mit Rezeptname + Username auflisten
- [x] `DELETE /v1/admin/shares/{shareId}` — Admin kann beliebige Share-Links deaktivieren
- [x] Frontend: Share-Links-Tabelle in Administration.vue (Rezept, Link, Erstellt von, Ablauf, Status, Aktionen)
- [x] Frontend: Copy-Button für Share-Links (Clipboard API)

**Tasks — RecipeDisplay Refactoring (24. März 2026):**
- [x] `RecipeDisplay.vue` als gemeinsame Darstellungskomponente extrahiert (Desktop Split-View, Mobile Bottom-Bar, MetadataOverlay, IntersectionObserver, PortionControl, Section-Filtering, Yields-Berechnung)
- [x] SharedRecipe.vue → dünner Wrapper (~100 Zeilen, nur API-Fetch + Fehlerstatus)
- [x] Recipe.vue → nutzt RecipeDisplay mit Slots (#image-overlays, #title, #subtitle, #after-content)
- [x] CSS-Scoping: `recipe-layout.css` Import in RecipeDisplay statt in Parent-Views
- [x] Yields-Logik in RecipeDisplay internalisiert (kein Prop-Durchreichen mehr)
- [x] SharedRecipe: Bildhöhe begrenzt (`max-height: 50vh`), Platzhalter bei fehlendem Bild
- [x] Gesamtergebnis: 1.255 → 887 Zeilen (−29%, 885 entfernt / 670 neu)

**Tasks — Offline-Cache:**
- [x] IndexedDB als Read-Cache (Rezeptliste + Details für Offline) — `prefetchRecipeDetails()` + IDB-Fallback in allen API-Actions
- [x] Service Worker: Thumbnail- + Image-Caching (Workbox CacheFirst, 500 Thumbnails / 200 Bilder, 90 Tage)
- [x] Offline-Erkennung + Banner-Hinweis (AppNavbar, `navigator.onLine` + `online`/`offline`-Events)
- [x] Auth-Guards offline-fähig: `requireAuth` erlaubt Navigation offline, `requireRole` redirected zur Galerie
- [x] OIDC-Event-Handler prüfen `navigator.onLine` vor `signinRedirect()`
- [x] Chunk-Load-Error-Handler: `router.onError` fängt veraltete Assets ab → erzwingt Full Reload
- [x] IDB-Cache-Architektur bereinigt: Klare Rollentrennung `recipes` (leichte Liste für Galerie) vs. `recipe:{uuid}` (volle Details für Rezeptansicht)
- [x] Cache-Invalidierung: `prefetchRecipeDetails` erkennt unvollständige Cache-Einträge (fehlende Amounts) und lädt sie neu
- [x] `useRecipeHelper.loadRecipe()`: API-first mit stillem IDB-Fallback bei Netzwerkfehler

**Ergebnis:** ✅ Sprint B5 vollständig abgeschlossen — Share-Links, Admin-Übersicht, RecipeDisplay-Refactoring, Offline-Cache (inkl. Auth-Hardening + Cache-Invalidierung)

---

## 📝 Bisherige Erkenntnisse (B0–B6)

### Architektur-Entscheidungen
- **`root_path="/api"`** im FastAPI-Backend — nginx proxied `/api/` → Backend, SPA liegt auf `/`
- **`env_file: ./backend/.env`** in docker-compose.yml — Secrets nur in `.env`, **nie** zusätzlich im `environment`-Block (überschreibt mit leerem Wert!)
- **`first_image_id`** in allen Recipe-Responses — ein `DISTINCT ON`-Query pro Rezept statt alle Bilder vorladen
- **`_auto_download_imageurl()`** — beim Create/Update wird `imageurl` serverseitig via httpx heruntergeladen und als echtes Bild gespeichert, dann `imageurl` + `cloud_images` aus `data` entfernt
- **Kein `services/`-Layer nötig** — Business-Logik direkt in Route-Handlern, bei dieser App-Größe ausreichend

### Offline-Modus & IDB-Cache
- **Zwei-Stufen-IDB-Cache:** `recipes` (leichte Liste: Name, Tags, Bild-ID, ohne Ingredients) für Galerie + `recipe:{uuid}` (volle Details) für Rezeptansicht. Klar getrennte Verantwortlichkeiten, kein Duplizieren.
- **Cache-Invalidierung nötig:** Reiner `lastUpdated`-Vergleich reicht nicht — unvollständige Cache-Einträge (leere Amounts) werden nie aktualisiert, wenn sich das Rezept nicht ändert. Fix: Vollständigkeitsprüfung bei Prefetch.
- **`navigator.onLine` ist unzuverlässig:** Browser meldet „online" auch bei fehlendem Server. API-Calls trotzdem versuchen, mit stillem Fallback auf IDB.
- **Auth offline:** OIDC-Token kann offline nicht erneuert werden. Guards müssen offline Navigation erlauben, Event-Handler dürfen kein `signinRedirect()` auslösen.

### AI-Import Architektur
- **3 Modi:** Freitext (Chat Completions), URL (Responses API + `web_search_preview`), Bild (Chat Completions + Vision)
- **SYSTEM_PROMPT** liegt server-seitig in `backend/prompts/system_prompt.md` (extern, per Docker-Volume änderbar) — Client sendet nur den User-Input
- **`initRecipe()`** muss nach YAML-Parsing angewendet werden (js-yaml setzt leere Felder auf `null`)
- **GPT-Modell** konfigurierbar pro User-Setting (`gpt_model`), wird als Query-Parameter an Backend gesendet

### RecipeDisplay Refactoring (B5)
- **Gemeinsame Darstellungskomponente** `RecipeDisplay.vue` extrahiert — enthält Desktop Split-View, Mobile Bottom-Bar, MetadataOverlay, PortionControl, Section-Filtering, Yields-Berechnung
- **Slot-Pattern** für Erweiterbarkeit: `#image-overlays`, `#title`, `#subtitle`, `#after-content` — Parent-Views stecken Edit-Mode-Inputs, Favoriten-Stern, FAB-Menü etc. per Slot rein
- **CSS-Scoping-Falle:** `@import` in `<style scoped>` eines Parent penetriert NICHT in Child-Komponenten. Import muss in der Komponente liegen, die die Klassen tatsächlich nutzt.
- **Yields-Logik internalisiert:** RecipeDisplay liest/mutiert `recipe.yields[0]` direkt, kein Prop-Durchreichen nötig da Vue-Reactivity auch auf gemutete Props greift

### Runtime-Config (B6)
- **Frontend-Config darf nie compile-time sein:** `import.meta.env.VITE_*` wird von Vite zur Build-Zeit eingebettet → Config-Änderung erfordert Rebuild. Lösung: nginx `envsubst` generiert `/config.js` mit `window.__CONFIG__` beim Container-Start. SPA liest Config aus `window.__CONFIG__` mit Fallback auf `import.meta.env` für lokale Entwicklung (`public/config.js`).
- **AI System-Prompt externalisieren:** Prompt als `.md`-Datei in Docker-Volume → änderbar ohne Rebuild. Default-Prompt beim Image-Build nach `/app/prompts/` kopieren, Volume überschreibt bei Bedarf.
- **`envsubst` in nginx:** Offizielles nginx-Image unterstützt Templates in `/etc/nginx/templates/`. Für `config.js` eigenes Entrypoint-Script unter `/docker-entrypoint.d/40-inject-config.sh` — flexibler als das Template-System (Ziel ist nicht nginx-Config, sondern statisches JS-File).

### Zentrales Environment (B6)
- **Ein `.env` im Projekt-Root** für alle Services (Frontend, Backend, DB). Keine separaten `.env`-Dateien pro Service. `docker-compose.yml` nutzt `env_file: .env` für Frontend und Backend, DB-Service referenziert `${DB_*}` Variablen.
- **Variablen vereinheitlichen:** `OIDC_ISSUER_URL` und `OIDC_AUTHORITY` waren dasselbe → zu `OIDC_AUTHORITY` vereint. `OIDC_AUDIENCE` und `OIDC_CLIENT_ID` waren bei Keycloak identisch → zu `OIDC_CLIENT_ID` vereint.
- **`DATABASE_URL` aufspalten:** Einzelvariablen (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) sind verständlicher als eine URL mit Sonderzeichen. `config.py` baut die SQLAlchemy-URL per `@property` zusammen.
- **Alembic** soll die gleiche Config-Quelle nutzen wie die App: `env.py` importiert `settings.database_url` aus `app.config` statt eigene Env-Vars zu lesen.

### Docker / Deployment
- **Python 3.14-slim** + Pillow System-Dependencies (`libjpeg62-turbo-dev`, `libwebp-dev`)
- **Volume `recipe_uploads:/app/uploads`** für persistente Bilder
- **Volume `recipe_prompts:/app/prompts`** für extern änderbaren AI-Prompt
- **Projektstruktur:** Frontend in `frontend/`, Backend in `backend/`. Root enthält nur Orchestrierung (`.env`, `docker-compose.yml`, `scripts/`, `docs/`).
- **`extra_hosts`** im docker-compose kann für DNS-Workarounds genutzt werden
- **Frontend-Rebuild:** `docker compose up -d --build frontend`

### Bekannte offene Punkte
- `extra_hosts: cloud.cehser.de:128.251.187.1` noch in docker-compose (temporärer DNS-Workaround)
- ~~`webdav` NPM-Dependency noch installiert~~ ✅ Entfernt
- ~~`settings.ts` enthält deprecated Felder~~ ✅ Bereinigt
- ~~Favoriten nur lokal (IndexedDB)~~ ✅ Behoben (B4: API + IDB-Fallback)
- ~~`pending`-Rolle als Default für neue User~~ ✅ Implementiert (Auto-Provisioning + Frontend-Hinweis)
- ~~Admin-UI für User-Verwaltung~~ ✅ Implementiert (User-Liste, Rollen-Dropdown, Profildaten via OIDC)
- ~~Frontend-Config ist Compile-Time~~ ✅ Auf Runtime-Config umgestellt (B6: nginx `envsubst` → `config.js` → `window.__CONFIG__`)

---

### Sprint B6: Hardening & Polish
**Ziel:** Production-Readiness

**Tasks:**
- [x] **Runtime-Config für Frontend:** ✅ `VITE_OIDC_AUTHORITY` + `VITE_OIDC_CLIENT_ID` von Compile-Time auf Runtime umgestellt. Umsetzung: `.docker/nginx/docker-entrypoint.sh` führt `envsubst` auf `.docker/nginx/config.js.template` aus → generiert `/usr/share/nginx/html/config.js` mit `window.__CONFIG__` beim Container-Start. `src/auth/oidc.ts` liest `window.__CONFIG__` mit Fallback auf `import.meta.env.VITE_*` für lokale Entwicklung. `index.html` lädt `<script src="/config.js">` vor dem App-Bundle. Build-Args `VITE_OIDC_*` aus Dockerfile entfernt, `docker-compose.yml` nutzt nur noch `environment`.
- [x] **Runtime-konfigurierbarer AI System-Prompt:** ✅ Prompt aus `ai.py` extrahiert nach `backend/prompts/system_prompt.md`. Backend lädt Prompt per `_load_system_prompt()` aus `settings.prompt_dir` (Default: `/app/prompts`). Docker-Volume `recipe_prompts:/app/prompts` ermöglicht Prompt-Anpassungen ohne Rebuild. Default-Prompt wird beim Image-Build nach `/app/prompts/` kopiert. Frontend-Duplikat `src/prompts/SYSTEM_PROMPT.ts` gelöscht (via `git rm`).
- [x] **Error Handling:** ✅ Backend: Globaler Exception Handler in `main.py` — loggt Fehler server-seitig, Client bekommt nur `{"detail": "Internal server error"}`. Frontend: `app.config.errorHandler` + `unhandledrejection`-Listener in `main.ts` — verhindert weißen Bildschirm bei Vue-Render-Fehlern.
- [ ] Rate Limiting (AI-Endpunkte) — ⏸️ Zurückgestellt (bei Familien-App hinter OIDC nicht kritisch)
- [ ] Request-Logging (strukturiert) — ⏸️ Zurückgestellt (uvicorn-Standard reicht)
- [x] **Input-Sanitization Audit (30. März 2026):** ✅ Vollständiger Security-Audit durchgeführt. Ergebnisse:
  - SQL Injection: ✅ Alle Queries über SQLAlchemy ORM, parametrisiert. `plainto_tsquery` sicher.
  - File-Upload: ✅ MIME-Whitelist, Size-Limit, UUID-Dateinamen (kein User-kontrollierter Pfad).
  - Pydantic-Validierung: ✅ `recipe_name` min/max_length, `UserSettings` extra="forbid", Role-Whitelist.
  - **Fix: `pending`-Rolle im Backend durchgesetzt:** `require_readonly` Dependency eingeführt — alle Lese-Endpoints (`recipes`, `favorites`, `tags`, `images`, `shares`) blockieren jetzt `pending`-User serverseitig (vorher nur Frontend). AI-Import-Endpoints nutzen jetzt `require_editor` (statt nur Auth-Check).
  - **Fix: Error-Detail-Leakage entfernt:** `images.py` gibt keine Pillow-/Pfad-Details mehr aus, `dependencies.py` gibt keine JWT-Fehlerdetails mehr aus.
  - **Fix: CheckConstraint:** `pending` in `app_users.role` CHECK-Constraint ergänzt (fehlte im Model).
- [x] **CORS nur für erlaubte Origins:** ✅ War bereits korrekt implementiert — `settings.cors_origins` wird aus `CORS_ORIGINS` in `.env` gelesen.
- [x] **Backup-Strategie:** ✅ `scripts/backup.sh` — `pg_dump` via `docker compose exec`, zeitgestempelte `.sql.gz`-Dateien, automatische Rotation (behält letzte 30).
- [ ] README aktualisieren
- [x] **.env.example + Deployment-Doku:** ✅ Zentrales `.env` im Root, `.env.example` mit allen Variablen (`OIDC_AUTHORITY`, `OIDC_CLIENT_ID`, `DB_*`, `OPENAI_API_KEY`, `CORS_ORIGINS`).
- [x] **Projektstruktur bereinigt:** ✅ Frontend nach `frontend/` verschoben (Dockerfile, src/, public/, configs). Root enthält nur noch: `.env`, `docker-compose.yml`, `README.md`, `docs/`, `frontend/`, `backend/`, `scripts/`.
- [ ] UI-ROADMAP-FINAL.md aktualisieren — ⏸️ Erst bei nächster UI-Feature-Planung

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
| **B5** | Share-Links + Refactoring + Offline-Cache | B4 | 🟡 Wichtig |
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
- [x] **Domain**: ✅ Kein Risiko bei Domain-Wechsel — Backend ist einzige Datenquelle, Share-Links nutzen `window.location.origin` (dynamisch), PWA-Cache ist nur Read-Cache. Bei Wechsel: `CORS_ORIGINS` + IdP Redirect-URIs anpassen, fertig.
- [x] **Parallel-Betrieb**: ✅ Erledigt — WebDAV komplett entfernt (B4), Big-Bang-Umstellung durchgeführt.
- [x] **Backup**: ✅ `scripts/backup.sh` vorhanden, Cronjob muss auf Host eingerichtet werden.
- [x] **HTTPS**: ✅ Reverse Proxy extern gepflegt (nicht Teil dieses Projekts).

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
