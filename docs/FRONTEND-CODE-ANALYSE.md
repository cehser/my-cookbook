# Frontend Code-Analyse

> **Ziel:** Wartbarkeit, Erweiterbarkeit und Planungssicherheit des Frontends bewerten.
> **Erstellt:** 28.03.2026  
> **Abgeschlossen:** 30.03.2026  
> **Status:** ✅ Frontend-Modernisierung abgeschlossen (S1-S3, C1-C5, T1-T3, D1-D4 erledigt, D5 zurückgestellt)

---

## 📋 Analyse-Übersicht

### Scope
- **Codebase:** `frontend/src/` — ~6.000+ Zeilen in ~40 Vue-Komponenten, 63 Dateien, ~9.900 Zeilen gesamt
- **Stack:** Vue 3.5, Pinia 3, Vue Router 5, TypeScript 5.9, Vite 7.2, bootstrap-vue-next 0.44
- **Infrastruktur:** PWA (Workbox), OIDC Auth, Custom API-Client, IndexedDB-Offline-Cache

### Nicht im Scope
- Backend-Code (separat in `backend/`)
- Visuelle UI-Review (Farben, Layout, Pixel)
- Feature-Vollständigkeit (→ UI-ROADMAP-FINAL.md)

---

## 📊 Ergebnisse Phase 1 — Automatisierte Analyse

### Gesamtbewertung

| Dimension | Bewertung | Zusammenfassung |
|-----------|-----------|-----------------|
| Architektur & Komponentenschnitt | � | Alle 29 Komponenten nutzen `<script setup>`. Pinia-Stores statt Vuex. 0 direkte `$store`-Zugriffe. |
| Code-Qualität & DRY | 🟢 | Nur 1,72% Duplikation (10 Clones). 7 ungenutzte Dateien, 5 ungenutzte Dependencies. |
| TypeScript-Striktheit | 🟢 | `strict: true` ergibt 0 echte Fehler (nur 2 Deprecation-Warnings). `any` weitgehend eliminiert. |
| Abhängigkeiten & Forward Compatibility | 🟢 | ~~16~~ → 4 Vulnerabilities (Build-Tools, kein Runtime). `jsonpath` entfernt. Vuex entfernt, Pinia migriert. |
| Bundle & Performance | 🟢 | 135 kB gzipped Hauptbundle. 49 kB CSS. Edit-Chunk 8 kB. Precache ~~1220~~ → 1138 kB. |
| Testbarkeit | 🟡 | Keine Tests vorhanden. Composables und Pinia-Stores gut testbar. Alle Views als `<script setup>`. |

---

### 1. Dependency-Status (`npm outdated` + `npm audit`)

#### Versions-Stand

| Paket | Aktuell | Latest | Upgrade-Typ |
|-------|---------|--------|-------------|
| **vue** | 3.4.15 | **3.5.31** | Minor ⬆️ |
| **vue-router** | ~~4.2.5~~ **5.0.4** | **5.0.4** | ✅ Erledigt (D3) |
| **bootstrap-vue-next** | ~~0.40.9~~ **0.44.0** | **0.44.0** | ✅ Erledigt (D4) |
| bootstrap | 5.3.2 | 5.3.8 | Patch |
| bootstrap-icons | 1.11.3 | 1.13.1 | Minor |
| idb-keyval | 6.2.1 | 6.2.2 | Patch |
| js-yaml | 4.1.0 | 4.1.1 | Patch |
| qrcode | 1.5.3 | 1.5.4 | Patch |
| sortablejs | 1.15.1 | 1.15.7 | Patch |
| workbox-window | 7.0.0 | 7.4.0 | Minor |

> `oidc-client-ts` (3.5.0): Hat keine neuere Version. `vuex`, `json-url`, `qr-scanner` wurden entfernt.

#### Sicherheits-Audit (16 Vulnerabilities)

| Severity | Anzahl | Betroffene Pakete |
|----------|--------|-------------------|
| **Critical** | 1 | `fast-xml-parser` (Entity Encoding Bypass) |
| **High** | 12 | `jsonpath` (**Arbitrary Code Injection + Prototype Pollution**), `rollup`, `underscore`, `flatted`, `immutable`, `serialize-javascript`, `minimatch`, `picomatch`, `brace-expansion` |
| **Moderate** | 3 | `ajv` (ReDoS), `lodash` (Prototype Pollution), `brace-expansion` |

**Kritisch:** `jsonpath` hat eine **Arbitrary Code Injection**-Schwachstelle und sollte ersetzt oder entfernt werden.

> Alle fixbar via `npm audit fix` (bzw. `--force` für breaking changes bei `vite-plugin-pwa`).

---

### 2. TypeScript-Striktheit (`vue-tsc --noEmit --strict`)

**Ergebnis: 0 echte Typfehler** ✅

| Fehlercode | Anzahl | Beschreibung |
|-----------|--------|--------------|
| TS5107 | 1 | `moduleResolution=node10` deprecated (TypeScript 7.0) |
| TS5101 | 1 | `baseUrl` deprecated (TypeScript 7.0) |

**`any`-Verwendungen:** 17 Stellen

| Kategorie | Anzahl | Dateien |
|-----------|--------|---------|
| ~~Vuex Action-Context~~ | ~~8~~ | ~~`uiState.ts` (6×), `actions.ts` (2×)~~ — ✅ entfallen durch Pinia-Migration |
| Error-Catch `err: any` | 4 | `AIRecipeImport.vue` |
| Array/Payload `any` | 3 | `useRecipeHelper.ts`, `actions.ts`, `recipes.ts` |
| Type-Assertion | 2 | `RecipeCard.vue`, `actions.ts` |

> **Status:** `strict: true` ist aktiviert. Die `any`-Verwendungen in Vuex-Actions haben sich durch die Pinia-Migration aufgelöst.

**tsconfig.json Deprecation-Fix:** `moduleResolution: "node10"` → `"bundler"` und `baseUrl` durch `paths` in Vite ersetzen.

---

### 3. Copy-Paste-Analyse (`jscpd`)

**Ergebnis: 10 Clones, 1,72% Duplikation** (170 von 9.897 Zeilen)

| Clone | Dateien | Zeilen | Bewertung |
|-------|---------|--------|-----------|
| MetadataOverlay.vue (intern) | Desktop- vs. Mobile-Template | 50+21 | 🟡 Größter Clone — Desktop/Mobile-Variante. Responsive Refactoring möglich. |
| PortionControl.vue (intern) | 2 Stellen | 11+9 | 🟢 Desktop/Mobile-Duplizierung, ähnliches Pattern. |
| RecipeDisplay.vue (intern) | Desktop/Mobile | 12 | 🟢 Kleiner Clone. |
| IngredientInlineEdit ↔ StepInlineEdit | Template-Blöcke | 13 | 🟢 Ähnliches Edit-Pattern, aber verschiedene Daten. |
| AIRecipeImport.vue (intern) | 2 Try-Catch-Blöcke | 18 | 🟢 Ähnliche API-Call-Patterns. |
| store/actions.ts (intern) | 2 Stellen | 11+13 | 🟢 Ähnliche IDB-Sync-Patterns. |
| api/ai.ts ↔ api/images.ts | Header-Setup | 12 | 🟢 FormData-Upload-Pattern. |

> **Fazit:** Niedrige Duplikation. Der größte Clone (MetadataOverlay) ist ein Desktop/Mobile-Pattern und kein klassischer DRY-Verstoß. Kein dringender Handlungsbedarf.

---

### 4. Dead-Code-Analyse (`knip`)

#### Ungenutzte Dateien (7)

| Datei | Bewertung |
|-------|-----------|
| `babel.config.js` | 🗑️ Altlast (Vite braucht kein Babel) |
| `components.d.ts` | 🗑️ Wird von auto-import generiert, muss nicht eingecheckt sein |
| `public/config.js` | ⚠️ Dev-Fallback für Runtime-Config — bewusst behalten? |
| `src/registerServiceWorker.js` | 🗑️ Altlast (vite-plugin-pwa übernimmt das) |
| `src/sw.js` | 🗑️ Altlast (Workbox generiert den SW) |
| `src/api/tags.ts` | 🗑️ Unused API-Modul |
| `src/views/About.vue` | ⚠️ Platzhalter-View (5 Zeilen) — entfernen oder befüllen? |

#### Ungenutzte Dependencies (5+1)

| Paket | package.json | Bewertung |
|-------|-------------|-----------|
| `core-js` | dependency | 🗑️ Unnötig bei ES2020 Target + modernen Browsern |
| `json-url` | dependency | 🗑️ Nicht mehr im Code referenziert |
| `qr-scanner` | dependency | ⚠️ Wird es noch gebraucht? |
| `qrcode` | dependency | ⚠️ Wird es noch gebraucht? (ShareManager?) |
| `sortablejs` | dependency | ⚠️ Wird es noch gebraucht? (Drag & Drop?) |
| `@eslint/eslintrc` | devDependency | 🗑️ Nicht in eslint.config.mjs referenziert |

#### Ungenutzte Exports (15) + Ungenutzte Types (15)

Betrifft hauptsächlich:
- **API-Module:** Named Exports + Default Exports parallel → doppelter Export (5× Duplicate Exports)
- **Interfaces in `api/*.ts`:** Definiert aber nicht importiert (werden implizit durch TypeScript Structural Typing genutzt)
- **`js/recipes.ts`:** 4 Funktionen (`loadNewRecipe`, `loadYamlRecipe`, `mergeCookbooks`, `filesEqual`) — prüfen ob noch gebraucht
- **`js/slug.ts`:** `slugify` — wird das noch genutzt?
- **`js/uuid.ts`:** `generateUUID` — wird das noch genutzt?
- **`js/deepCopy.ts`:** Default-Export ungenutzt

> **Fazit:** ~7 Dateien und 5-6 Dependencies können entfernt werden. Die doppelten Named+Default-Exports in der API-Schicht sollten vereinheitlicht werden.

---

### 5. Bundle-Analyse (`vite build`)

#### Chunk-Größen (Production, gzipped)

| Chunk | Größe (raw) | Größe (gzip) | Inhalt |
|-------|-------------|--------------|--------|
| `index.js` (Vendor) | 416 kB | **135 kB** | Vue, Pinia, Router, Bootstrap, OIDC, Workbox |
| `Edit.js` | 28 kB | **8 kB** | Edit-View (größter Feature-Chunk) |
| `index.js` (App) | 53 kB | **17 kB** | App-Shell, Store, Router, API-Client |
| `RecipeDisplay.js` | 32 kB | **8 kB** | RecipeDisplay + Sub-Komponenten |
| `Recipe.js` | 16 kB | **5 kB** | Recipe-View |
| `Administration.js` | 15 kB | **5 kB** | Admin-Panel |
| `Settings.js` | 11 kB | **4 kB** | Settings-View |
| `SharedRecipe.js` | 3 kB | **1 kB** | Shared Recipe |
| `Callback.js` | 1 kB | **0,4 kB** | OIDC Callback |

| CSS | Größe (raw) | Größe (gzip) |
|-----|-------------|--------------|
| `index.css` (Bootstrap + App) | 333 kB | **49 kB** |
| `RecipeDisplay.css` | 16 kB | 3 kB |
| `Recipe.css` | 4 kB | 1 kB |

| Fonts | Größe (raw) |
|-------|-------------|
| `bootstrap-icons.woff2` | 134 kB |
| `bootstrap-icons.woff` | 180 kB |

**Gesamtgröße Initial Load (gzip):** ~135 + 17 + 49 = **~201 kB** (JS + CSS, ohne Fonts)

**Build-Warnung:** `api/client.ts` wird sowohl dynamisch als auch statisch importiert → wird nicht in separaten Chunk verschoben.

> **Bewertung:** Für eine Vue 3 + Bootstrap-App akzeptabel. Das Vendor-Bundle (138 kB gzip) ist der Haupttreiber. Bootstrap-CSS (49 kB gzip) könnte durch PurgeCSS/Tree-Shaking reduziert werden, aber der Aufwand lohnt sich nur bei Performance-Problemen.

---

### 6. Architektur-Analyse (Grep-basiert)

#### API-Stil: Options API vs. Composition API

| Stil | Anzahl | Dateien |
|------|--------|---------|
| **`<script setup>` (Composition API)** | **29** | ✅ Alle Komponenten (D2 abgeschlossen) |
| **`export default { }` (Options API)** | **0** | — |

#### Store-Zugriffe

| Muster | Anzahl | Kommentar |
|--------|--------|-----------|
| `useRecipeStore()` (Pinia) | alle | ✅ Alle Komponenten nutzen typisierte Pinia-Stores |
| `useUIStore()` (Pinia) | alle | ✅ UI-State via dediziertem Pinia-Store |
| ~~`this.$store.dispatch(...)`~~ | ~~30~~ → 0 | Entfernt durch D1+D2 |
| ~~`this.$store.state/getters`~~ | ~~8~~ → 0 | Entfernt durch D1+D2 |

> **Fazit:** 0 direkte `$store`-Zugriffe. Alle Komponenten nutzen typisierte Pinia-Stores (`useRecipeStore`, `useUIStore`).

---

## 🎯 Action Items (priorisiert)

### Priorität 1 — Sicherheit ✅ erledigt (ea619b3)

| # | Maßnahme | Status |
|---|----------|--------|
| **S1** | `jsonpath` entfernt → native for-of-Loops in Edit.vue | ✅ |
| **S2** | `npm audit fix` → 16 → 4 Vulnerabilities (Rest: Build-Tools, kein Runtime) | ✅ |
| **S3** | `json-url` entfernt | ✅ |

### Priorität 2 — Aufräumen (teilweise erledigt)

| # | Maßnahme | Status |
|---|----------|--------|
| **C1** | Dateien gelöscht: `babel.config.js`, `registerServiceWorker.js`, `sw.js`, `api/tags.ts` | ✅ |
| **C2** | Dependencies entfernt: `core-js`, `json-url`, `@eslint/eslintrc` | ✅ |
| **C3** | `qr-scanner`, `qrcode`, `sortablejs` entfernt (alle ungenutzt) | ✅ |
| **C4** | Doppelte Exports bereinigt (7× Named + Default → nur Named, 14 Imports aktualisiert) | ✅ |
| **C5** | `components.d.ts` in `.gitignore` (wird auto-generiert) | ✅ |

### Priorität 3 — TypeScript-Verbesserung (teilweise erledigt)

| # | Maßnahme | Status |
|---|----------|--------|
| **T1** | `strict: true` aktiviert | ✅ |
| **T2** | `moduleResolution: "bundler"`, `baseUrl` entfernt (TS7-ready) | ✅ |
| **T3** | 17× `any` durch konkrete Typen ersetzt (`unknown`, generics, inline types) | ✅ |

### Priorität 4 — Strategische Entscheidungen (Diskussion nötig)

| # | Frage | Aufwand | Empfehlung |
|---|-------|---------|------------|
| **D1** | **Vuex → Pinia** — Vuex entfernt, 2 Pinia-Stores (`useRecipeStore`, `useUIStore`) erstellt, alle Komponenten migriert. | — | ✅ Erledigt |
| **D2** | **Options API → `<script setup>`** — Alle 12 Options-API-Komponenten konvertiert. 29/29 nutzen `<script setup lang="ts">`. | — | ✅ Erledigt |
| **D3** | **vue-router 4 → 5** — Upgrade auf 5.0.4 durchgeführt. Navigation Guards von `next()`-Callback auf return-basiertes Pattern umgestellt. `NavigationGuardNext` Import entfernt. | — | ✅ Erledigt (22267bd) |
| **D4** | **bootstrap-vue-next Audit + Upgrade** — 24 BVN-Komponenten (~218 Stellen). Upgrade 0.40→0.44 durchgeführt (keine Breaking Changes für unser Projekt). 8 redundante Imports entfernt. useToast-API-Bug gefixt. | — | ✅ Erledigt |
| **D5** | **Major-Dependency-Upgrades.** TypeScript 5→6, ESLint 9→10, Vite 7→8, globals 16→17, unplugin-vue-components 30→32. | Mittel–Hoch | ⏸️ Zurückgestellt — kein Blocker. Erst wenn Ökosystem stabil. Reguläre Wartung. |

### Nicht empfohlen (Over-Engineering-Vermeidung)

| Vorschlag | Warum nicht |
|-----------|-------------|
| PurgeCSS für Bootstrap | 49 kB gzip CSS ist akzeptabel, Aufwand lohnt nicht |
| MetadataOverlay Desktop/Mobile-Refactoring | 1,72% Duplikation ist niedrig, Pattern ist verständlich |
| ~~Sofortige Migration aller Options-API-Komponenten~~ | ✅ Erledigt (D2) |
| Test-Suite aufsetzen | Zuerst Architektur stabilisieren, dann testen |

---

## 📦 D4 — bootstrap-vue-next Audit (29.03.2026)

### Setup

| Aspekt | Detail |
|--------|--------|
| Version | ~~0.40.9~~ **0.44.0** (Pre-1.0, Community-Projekt) |
| Registrierung | **Tree-Shaking** via `unplugin-vue-components` + `BootstrapVueNextResolver()` |
| CSS | Volles Bundle: `bootstrap-vue-next/dist/bootstrap-vue-next.css` (kein CSS-Tree-Shaking) |
| Bootstrap | `bootstrap/dist/css/bootstrap.css` + `bootstrap-icons/font/bootstrap-icons.css` |

### Komponenten-Inventar (24 Komponenten, ~218 Stellen)

| Komponente | Anzahl | Hauptnutzer |
|---|---|---|
| `BButton` | 64 | Edit, Gallery, Administration, RecipeDisplay, RecipeCard, … |
| `BCol` | 52 | Edit, IngredientEdit, StepEdit |
| `BRow` | 30 | Edit, IngredientEdit, StepEdit |
| `BFormInput` | 28 | Recipe, Edit, IngredientEdit, Gallery, … |
| `BContainer` | 7 | Administration, Recipe, Edit, Settings, Gallery |
| `BFormSelect` | 6 | Edit, IngredientEdit, StepEdit, Gallery |
| `BFormTextarea` | 5 | Edit, StepSection, StepInlineEdit, AIRecipeImport |
| `BDropdownItem` | 4 | Gallery |
| `BTabs` / `BTab` | 4 | AIRecipeImport |
| `BFormCheckbox` | 3 | Settings, AIRecipeImport |
| `BFormFile` | 2 | Edit, AIRecipeImport |
| `BInputGroup(Text)` | 3 | Edit, Gallery |
| `BModal` | 2 | Gallery, IngredientEdit |
| `BListGroup(Item)` | 2 | Administration |
| `BCollapse` | 1 | IngredientEdit |
| `BDropdown(Divider)` | 2 | Gallery |
| `BAlert` | 1 | Settings |
| `BCard(Body/Header)` | 3 | AIRecipeImport |
| `BApp` | 1 | App.vue |

### Composables & Direktiven

| Typ | Name | Nutzung |
|-----|------|---------|
| Composable | `useToast` | Wrapper in `composables/useToast.ts`, 6 Dateien |
| Direktive | `v-b-toggle` | 1 Stelle (IngredientEdit) |

### Befund & Bewertung

**Abhängigkeitstiefe: HOCH.** 24 Komponenten mit 218 Stellen machen einen Austausch unrealistisch aufwändig. BVN ist de facto eine Kernabhängigkeit.

**Risikobewertung:**

| Risiko | Einschätzung |
|--------|-------------|
| Projekt-Health | 🟡 Pre-1.0, aktiv, aber langsam: Releases alle 2-3 Monate |
| Breaking Changes | 🟡 0.40→0.44 enthält API-Änderungen (Props, Events) |
| Alternative | 🔴 Kein direkter Drop-in-Ersatz für Vue 3 + Bootstrap 5 |
| Eigene Wrapper | 🔴 Unrealistisch: 24 Komponenten selbst bauen = Rewrite |

**Empfehlung:**
1. ✅ **Bei BVN bleiben** — Austausch wäre Over-Engineering
2. ✅ **Upgrade 0.40→0.44** — Breaking Changes betreffen nur BTable (nicht genutzt) und entfernte Orchestrator-Komponenten (nutzen bereits BApp). Erledigt.
3. ✅ **Redundante manuelle Imports entfernt** (8 Dateien) — e2e7b55
4. ✅ **`Recipe.vue` useToast-Import** auf Wrapper umgestellt + **useToast-API-Bug gefixt** (Signatur war title/message/variant statt message/variant) — e2e7b55

---

## 📝 Leitprinzipien

- **Kein Over-Engineering:** Refactoring nur wo es echten Nutzen bringt
- **DRY, nicht DRYER:** Duplikation vermeiden, aber keine Abstraktion für einmalige Fälle
- **Pragmatismus:** "Good enough" ist besser als "perfekt aber nie fertig"
- **Schrittweise:** Empfehlungen sollen inkrementell umsetzbar sein, keine Big-Bang-Umbauten
- **Messbarer Impact:** Jedes Action Item bekommt eine Impact-Bewertung (Hoch/Mittel/Niedrig)
