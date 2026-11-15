# Auftrag W.10: Vitest einführen, Store-Schnitt, erste Tests

> Erstellt 2026-11-15 vom Master · Roadmap: `ROADMAP.md` Punkt W.10 · Basis: `main@39d53b1` · Aufwand: M · Modell: Sonnet

## Ziel
Das Frontend hat eine Testumgebung (Vitest, `@vue/test-utils`, happy-dom), die lokal und in der CI läuft, sowie erste Tests für reine Funktionen, Composables und die Login-nahen Komponenten. Die Mapper und das Laden aller Listenseiten verlassen den Store, damit sie testbar sind. Tests für den AI-Import sind nicht Teil (W.13 ändert ihn gerade, die Tests kommen mit W.28).

## Erst lesen
1. `docs/tasks/W.11.bericht.md` – „Offen und Folgepunkte“ (Store-Schnitt, Komponententests `Callback.vue`/`App.vue`)
2. `docs/DEVELOPMENT-GUIDELINES.md`, `.claude/rules/frontend.md` (Abschnitt „Sitzung und Login“)
3. `frontend/src/store/recipeStore.ts` (`fetchAllRecipeListItems`, `listItemToRecipe`, `detailToRecipe`, `saveSettings`), `frontend/src/api/recipes.ts`
4. `frontend/src/js/deepCopy.ts`, `isEqualPlain.ts`, `recipes.ts`; `frontend/src/composables/useRecipeHelper.ts` (Skalierung), `useDraft.ts`
5. `frontend/src/App.vue`, `frontend/src/views/Callback.vue`, `frontend/src/auth/session.ts`
6. `.github/workflows/ci.yml` (Job `frontend`)

## Auftrag
1. **Testumgebung:**
   - `vitest`, `@vue/test-utils` und `happy-dom` als devDependencies, jeweils aktuelle stabile Version.
   - Eigene `vitest.config.ts` mit nur dem Vue-Plugin, dem Alias `@` und `define` für `__COMMIT_HASH__`; nicht über `vite.config.js` (dort laufen SSL- und PWA-Plugin, und W.25 ändert die Datei parallel).
   - Script `test` (`vitest run`). Tests als `*.spec.ts` neben dem getesteten Modul. Explizite Imports aus `vitest`, keine Globals.
   - Typecheck und ESLint schließen die Specs ein.
2. **Store-Schnitt:**
   - `listItemToRecipe` und `detailToRecipe` nach `src/js/recipeMapping.ts`.
   - `fetchAllRecipeListItems` als `recipeApi.listAll()` nach `api/recipes.ts` (Seitenweise, Duplikate über `id` verwerfen, Abbruch wie heute).
   - Verhalten unverändert.
3. **`saveSettings`:** speichert eine Kopie (`deepCopyJSON`) statt des übergebenen, ggf. reaktiven Objekts. Test, der zeigt, dass eine spätere Änderung am übergebenen Objekt den Store nicht verändert.
4. **Tests:**
   - `deepCopyJSON`, `isEqualPlain`, `recipeMapping`, `recipeApi.listAll` (Client gemockt: mehrere Seiten, Duplikat an der Seitengrenze, `total` kleiner als gelieferte Menge, leere Liste).
   - Skalierung in `useRecipeHelper` (Mengen, Brüche, Einheiten; was der Code tatsächlich kann).
   - `useDraft`: Entwurf sichern, wiederherstellen, verwerfen, Undo.
   - `Callback.vue`: Erfolg leitet zum gespeicherten Ziel, Fehler zeigt Meldung, doppelter Aufruf verarbeitet den Code nur einmal (Sitzungsmodul gemockt).
   - `App.vue`: Kaltstart mit gespeicherter Route (`router.replace`), Wechsel in den Vordergrund ruft die Sitzungsprüfung auf.
5. **CI:** im Job `frontend` Schritt `npm test` nach `typecheck`.
6. **Doku:** Projekt-`CLAUDE.md` (Befehle, Verifikation Frontend), `DEVELOPMENT-GUIDELINES.md` kurzer Abschnitt Tests (Ort, Namensschema, was gemockt wird). Pre-Commit-Hook bleibt ohne Tests.

## Ablage
- Neu: `frontend/vitest.config.ts`, `frontend/src/js/recipeMapping.ts`, Specs neben den Modulen
- Geändert: `frontend/package.json` und Lock, `src/store/recipeStore.ts` (schrumpft), `src/api/recipes.ts`, `.github/workflows/ci.yml`, `CLAUDE.md`, `docs/DEVELOPMENT-GUIDELINES.md`, ggf. `tsconfig*.json`, `eslint.config.*`

## Nicht in diesem Auftrag
- Tests für `api/ai.ts`, `aiErrorMessage`, `imageResize.ts`, `AIRecipeImport.vue` (W.13 ändert sie, Tests mit W.28)
- Tests für `router/index.ts` und `swUpdate.ts` (W.25 ändert sie)
- Tests für `session.ts` (W.23), Coverage-Berichte, E2E
- Umbau von `App.vue` oder der Sitzungslogik; fällt beim Testen ein Fehler auf, im Bericht melden statt reparieren (Ausnahme: `saveSettings`)

## Entscheidungen, die ich treffe
- keine. Freigegeben sind die drei genannten Pakete; jede weitere Abhängigkeit (z. B. `fake-indexeddb`, `msw`, Coverage) nur nach Rückfrage, sonst mocken.

## Fallstricke
- **Peer-Abhängigkeit zu Vite 8:** `npm ci` läuft ohne `--legacy-peer-deps` (`.claude/rules/frontend.md`). Erklärt die aktuelle Vitest-Version Vite 8 nicht als Peer, anhalten und melden; keinen weiteren Override ohne Rückfrage.
- **Parallele Aufträge:** W.25 ändert `vite.config.js`, `router/index.ts`, `swUpdate.ts`; W.13 ändert `api/ai.ts`, `AIRecipeImport.vue` und die README. Diese Dateien nicht anfassen; README nur, falls nötig, im Abschnitt Entwicklung.
- **IndexedDB:** happy-dom hat keine; `idb-keyval` bzw. `offlineCache.ts` mocken.
- **OIDC:** `App.vue` und `Callback.vue` hängen an `auth/session.ts` und `auth/oidc.ts` (`oidc-client-ts`); per `vi.mock` ersetzen, keine echten Redirects.
- **bootstrap-vue-next** in Komponententests: Komponenten werden per Resolver automatisch importiert (`unplugin-vue-components` in `vite.config.js`). In `vitest.config.ts` den Resolver ebenfalls eintragen oder die Komponenten stubben; Entscheidung im Bericht.
- Der Pre-Commit-Hook prüft typecheck; Specs mit Typfehlern blockieren also Commits.

## Checkpoints
- Nur falls die Peer-Prüfung von Vitest gegen Vite 8 scheitert: melden und anhalten. Sonst ohne Halt bis zum Bericht.

## Abnahme
- `npm ci` (ohne Flag), `npm test`, `lint:check`, `typecheck`, `build` grün; Anzahl Tests und Laufzeit im Bericht
- `recipeStore.ts` enthält keine Mapper und kein Seitenladen mehr; Verhalten unverändert (bestehende Ansichten im Dev-Server oder Container stichprobenartig geprüft)
- CI-Job `frontend` führt die Tests aus (Workflow-Syntax geprüft)
- Bericht nennt gefundene Fehler, die nicht behoben wurden
- Verifikation gemäß Projekt-CLAUDE.md (Frontend)

## Korrektur (2026-11-15, nach Prüfung)
- Schritt 4 „`useDraft`: … Undo“ war falsch: Undo/Redo liegt in `views/Edit.vue` (`useRefHistory`), nicht in `useDraft`. Weiter in W.29.
- „`Callback.vue` verarbeitet den Code nur einmal“: Eine Sperre gibt es weder in `Callback.vue` noch in `oidc.handleCallback`; der Test prüft nur Vue-Semantik. Sperre in W.23.
