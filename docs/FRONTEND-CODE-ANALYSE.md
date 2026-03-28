# Frontend Code-Analyse

> **Ziel:** Wartbarkeit, Erweiterbarkeit und Planungssicherheit des Frontends bewerten.
> **Erstellt:** 28.03.2026  
> **Status:** ✅ Phase 1 abgeschlossen (automatisierte Analyse)

---

## 📋 Analyse-Übersicht

### Scope
- **Codebase:** `frontend/src/` — ~6.000+ Zeilen in ~40 Vue-Komponenten, 63 Dateien, ~9.900 Zeilen gesamt
- **Stack:** Vue 3.4, Vuex 4, Vue Router 4, TypeScript 5.3, Vite 7.2, bootstrap-vue-next 0.40
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
| Architektur & Komponentenschnitt | 🟡 | 12 Options API + 17 `<script setup>` — inkonsistenter Mix. 38 direkte `$store`-Zugriffe in Views. |
| Code-Qualität & DRY | 🟢 | Nur 1,72% Duplikation (10 Clones). 7 ungenutzte Dateien, 5 ungenutzte Dependencies. |
| TypeScript-Striktheit | 🟢 | `strict: true` ergibt 0 echte Fehler (nur 2 Deprecation-Warnings). 17× `any` im Code. |
| Abhängigkeiten & Forward Compatibility | 🔴 | 16 Vulnerabilities (1 critical). `jsonpath` hat Arbitrary Code Injection. Vuex deprecated. |
| Bundle & Performance | 🟡 | 138 kB gzipped Hauptbundle. 49 kB CSS. Edit-Chunk 36 kB. Bootstrap-Icons-Fonts 314 kB unkomprimiert. |
| Testbarkeit | 🟡 | Keine Tests vorhanden. Composables testbar, Store-Actions mäßig, Options-API-Views schwer. |

---

### 1. Dependency-Status (`npm outdated` + `npm audit`)

#### Versions-Stand

| Paket | Aktuell | Latest | Upgrade-Typ |
|-------|---------|--------|-------------|
| **vue** | 3.4.15 | **3.5.31** | Minor ⬆️ |
| **vue-router** | 4.2.5 | **5.0.4** | **Major** ⚠️ |
| **bootstrap-vue-next** | 0.40.9 | **0.44.0** | Minor ⬆️ |
| bootstrap | 5.3.2 | 5.3.8 | Patch |
| bootstrap-icons | 1.11.3 | 1.13.1 | Minor |
| idb-keyval | 6.2.1 | 6.2.2 | Patch |
| js-yaml | 4.1.0 | 4.1.1 | Patch |
| qrcode | 1.5.3 | 1.5.4 | Patch |
| sortablejs | 1.15.1 | 1.15.7 | Patch |
| workbox-window | 7.0.0 | 7.4.0 | Minor |

> `vuex` (4.1.0), `oidc-client-ts` (3.5.0), `json-url` (4.0.0), `qr-scanner` (1.4.2): Haben keine neueren Versionen.

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
| Vuex Action-Context | 8 | `uiState.ts` (6×), `actions.ts` (2×) |
| Error-Catch `err: any` | 4 | `AIRecipeImport.vue` |
| Array/Payload `any` | 3 | `useRecipeHelper.ts`, `actions.ts`, `recipes.ts` |
| Type-Assertion | 2 | `RecipeCard.vue`, `actions.ts` |

> **Empfehlung:** `strict: true` kann sofort aktiviert werden — es gibt keine blockierenden Fehler. Die `any`-Verwendungen in Vuex-Actions lösen sich bei einer Pinia-Migration automatisch auf.

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
| `index.js` (Vendor) | 427 kB | **138 kB** | Vue, Vuex, Router, Bootstrap, OIDC, Workbox |
| `Edit.js` | 115 kB | **36 kB** | Edit-View (größter Feature-Chunk) |
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

**Gesamtgröße Initial Load (gzip):** ~138 + 17 + 49 = **~204 kB** (JS + CSS, ohne Fonts)

**Build-Warnung:** `api/client.ts` wird sowohl dynamisch als auch statisch importiert → wird nicht in separaten Chunk verschoben.

> **Bewertung:** Für eine Vue 3 + Bootstrap-App akzeptabel. Das Vendor-Bundle (138 kB gzip) ist der Haupttreiber. Bootstrap-CSS (49 kB gzip) könnte durch PurgeCSS/Tree-Shaking reduziert werden, aber der Aufwand lohnt sich nur bei Performance-Problemen.

---

### 6. Architektur-Analyse (Grep-basiert)

#### API-Stil: Options API vs. Composition API

| Stil | Anzahl | Dateien |
|------|--------|---------|
| **`<script setup>` (Composition API)** | 17 | Alle neuen/refactored Komponenten |
| **`export default { }` (Options API)** | 12 | App.vue, alle Views (5), 6 Display-Komponenten |

**Options API (Legacy):** `App.vue`, `Gallery.vue`, `Recipe.vue`, `Edit.vue`, `Settings.vue`, `Administration.vue`, `RecipeFabMenu.vue`, `IngredientsSection.vue`, `MetadataOverlay.vue`, `MobileIngredientsBar.vue`, `PortionControl.vue`, `StepSection.vue`

#### Store-Zugriffe

| Muster | Anzahl | Kommentar |
|--------|--------|-----------|
| `this.$store.dispatch(...)` | 30 | Nur in Options-API-Views |
| `this.$store.state.*` | 4 | Direkter State-Zugriff |
| `this.$store.getters.*` | 4 | Getter-Zugriff |
| `useStore()` (Composition API) | 3 | AIRecipeImport, AppNavbar, RecipeCard |

> **Fazit:** 38 direkte Store-Zugriffe in 7 Dateien. Alle in Options-API-Komponenten. Die 3 Composition-API-Komponenten nutzen `useStore()` korrekt.

---

## 🎯 Action Items (priorisiert)

### Priorität 1 — Sicherheit (sofort)

| # | Maßnahme | Aufwand | Impact |
|---|----------|---------|--------|
| **S1** | `jsonpath` entfernen oder ersetzen (Arbitrary Code Injection, Prototype Pollution) | Klein | 🔴 Kritisch |
| **S2** | `npm audit fix` ausführen (behebt 14 von 16 Vulnerabilities) | Minimal | 🔴 Hoch |
| **S3** | `json-url` entfernen (ungenutzt lt. knip, bringt transitive Deps mit) | Klein | 🟡 Mittel |

### Priorität 2 — Aufräumen (niedrig hängend)

| # | Maßnahme | Aufwand | Impact |
|---|----------|---------|--------|
| **C1** | Ungenutzte Dateien löschen: `babel.config.js`, `registerServiceWorker.js`, `sw.js`, `api/tags.ts` | Minimal | 🟢 Hygiene |
| **C2** | Ungenutzte Dependencies entfernen: `core-js`, `json-url`, `@eslint/eslintrc` | Klein | 🟢 Kleinere node_modules |
| **C3** | Prüfen ob `qr-scanner`, `qrcode`, `sortablejs` noch genutzt werden — ggf. entfernen | Klein | 🟢 Hygiene |
| **C4** | Doppelte Exports bereinigen (5× Named + Default in API-Modulen) | Klein | 🟢 Konsistenz |
| **C5** | `components.d.ts` in `.gitignore` (wird auto-generiert) | Minimal | 🟢 Hygiene |

### Priorität 3 — TypeScript-Verbesserung (einfach, großer Effekt)

| # | Maßnahme | Aufwand | Impact |
|---|----------|---------|--------|
| **T1** | `strict: true` in `tsconfig.json` aktivieren (0 echte Fehler!) | Minimal | 🟡 Qualität |
| **T2** | `moduleResolution: "bundler"` statt `"node"` (TS7-Kompatibilität) | Minimal | 🟡 Zukunftssicherheit |
| **T3** | 17× `any` schrittweise durch konkrete Typen ersetzen | Klein | 🟢 Qualität |

### Priorität 4 — Strategische Entscheidungen (Diskussion nötig)

| # | Frage | Aufwand | Empfehlung |
|---|-------|---------|------------|
| **D1** | **Vuex → Pinia?** Vuex ist deprecated. 10 Mutations, 6 Actions, 1 Modul, 38 `$store`-Zugriffe. | Mittel (~1-2 Tage) | 🟡 Ja, aber kein Blitz-Umbau. Kann mit Options→Composition Migration kombiniert werden. |
| **D2** | **Options API → `<script setup>`?** 12 von 29 Komponenten nutzen noch Options API. | Mittel (pro Komponente 30-60 Min.) | 🟡 Schrittweise bei nächster Feature-Arbeit an jeweiliger Datei. |
| **D3** | **vue-router 4 → 5?** Major-Upgrade verfügbar. | Mittel | 🟢 Kann warten. Router-Nutzung ist Standard, Upgrade sollte überschaubar sein. |
| **D4** | **bootstrap-vue-next Stabilität?** Pre-1.0 Community-Projekt (v0.40). | — | 🟡 Beobachten. Welche BVN-Komponenten werden konkret genutzt? Falls nur wenige → eigene Wrapper erwägen. |

### Nicht empfohlen (Over-Engineering-Vermeidung)

| Vorschlag | Warum nicht |
|-----------|-------------|
| PurgeCSS für Bootstrap | 49 kB gzip CSS ist akzeptabel, Aufwand lohnt nicht |
| MetadataOverlay Desktop/Mobile-Refactoring | 1,72% Duplikation ist niedrig, Pattern ist verständlich |
| Sofortige Migration aller Options-API-Komponenten | Nur bei Bedarf, nicht als Selbstzweck |
| Test-Suite aufsetzen | Zuerst Architektur stabilisieren, dann testen |

---

## 📝 Leitprinzipien

- **Kein Over-Engineering:** Refactoring nur wo es echten Nutzen bringt
- **DRY, nicht DRYER:** Duplikation vermeiden, aber keine Abstraktion für einmalige Fälle
- **Pragmatismus:** "Good enough" ist besser als "perfekt aber nie fertig"
- **Schrittweise:** Empfehlungen sollen inkrementell umsetzbar sein, keine Big-Bang-Umbauten
- **Messbarer Impact:** Jedes Action Item bekommt eine Impact-Bewertung (Hoch/Mittel/Niedrig)
