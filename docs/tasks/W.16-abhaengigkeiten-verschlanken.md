# Auftrag W.16: Verzichtbare Frontend-Abhängigkeiten ersetzen

> Erstellt 2026-11-14 vom Master · Roadmap: `ROADMAP.md` Punkt W.16 · Basis: `main@e1481fe` · Aufwand: S–M · Modell: Sonnet

## Ziel
`deep-equal`, `@types/deep-equal`, `sass` und `@vueuse/integrations` sind aus `package.json` und Lock entfernt, `deepCopyYaml` ist ersetzt, die Font-Cache-Regel ist weg. Verhalten und Darstellung bleiben gleich. Keine Major-Updates (W.15).

## Erst lesen
1. `docs/plans/abhaengigkeiten.md` – Abschnitt „W.16 Verzichtbare Abhängigkeiten“
2. `frontend/src/js/deepCopy.ts` und `frontend/src/js/offlineCache.ts` (Kommentar: an IndexedDB nur Kopien, keine Vue-Proxies)
3. `frontend/src/components/recipe/ui/RecipeGrid.vue` – einzige SCSS-Nutzung
4. `.claude/rules/frontend.md` – u. a. `npm ci` ohne `--legacy-peer-deps` lokal

## Auftrag
1. **`deepCopyYaml` ersetzen** (11 Aufrufe in `useRecipeHelper.ts`, `recipeStore.ts`, `Administration.vue`, `Recipe.vue`):
   - Alle Aufrufe auf `deepCopyJSON` umstellen, `deepCopyYaml` und den `js-yaml`-Import aus `deepCopy.ts` löschen. Kommentar in `offlineCache.ts` anpassen.
   - Vorher bestätigen, dass die kopierten Daten JSON-sicher sind (keine `Date`, `Map`, `undefined` mit Bedeutung, Funktionen). Stand Master: `src/types/` enthält keine `Date`-Felder.
2. **`deep-equal` ersetzen** (`ProfileView.vue`, `Settings.vue`): eigene Funktion `isEqualPlain(a, b)` in `src/js/` für JSON-artige Daten (Primitive, Arrays, einfache Objekte, auch verschachtelt); Pakete `deep-equal` und `@types/deep-equal` entfernen.
3. **`sass` entfernen:** `RecipeGrid.vue` auf reines CSS (`aspect-ratio: 3 / 2`) umstellen, `lang="scss"` entfernen; `css.preprocessorOptions.scss` in `vite.config.js` löschen; Paket `sass` entfernen.
4. **`@vueuse/integrations` entfernen:** bootstrap-vue-next 0.44 bündelt `useFocusTrap` im eigenen `dist` und referenziert das Paket nur in `.d.ts`; `skipLibCheck` ist aktiv. Entfernen, `typecheck` und `build` müssen grün bleiben.
5. **Font-Cache-Regel** (`fonts.googleapis.com`) aus `runtimeCaching` in `vite.config.js` löschen.
6. Je Punkt ein eigener Commit (Bereich `frontend` bzw. `pwa` für die Cache-Regel).

## Ablage
- Neu: `src/js/isEqualPlain.ts` (oder in einer passenden bestehenden Datei unter `src/js/`)
- Geändert: die genannten Komponenten, `src/js/deepCopy.ts`, `src/js/offlineCache.ts`, `vite.config.js`, `package.json`, `package-lock.json`

## Nicht in diesem Auftrag
- Major-Updates, `eslint` als direkte devDependency (W.15)
- `js-yaml` bleibt (YAML-Import/-Export)
- Service-Worker-Updateverhalten (W.22), sonstige Änderungen an `vite.config.js`
- Store-Mapper, Tests (W.10)

## Entscheidungen, die ich treffe
- keine. Festgelegt: Kopie per JSON statt `structuredClone` (siehe Fallstricke).

## Fallstricke
- `structuredClone` scheitert an Vue-Proxies (`DataCloneError`), `toRaw` entfernt nur die oberste Ebene. `JSON.stringify` liest durch Proxies hindurch; deshalb JSON. Der Plan nennt noch `structuredClone`, ist entsprechend korrigiert.
- `deepCopyYaml` hätte bei `undefined`-Werten geworfen (js-yaml `dump`), JSON lässt sie still weg. Bei Objekten, die gespeichert oder an die API gesendet werden, macht das keinen Unterschied; im Bericht bestätigen.
- Das alte Mixin setzt das erste Kind der Karte absolut auf volle Größe. `aspect-ratio` allein reicht nur, wenn `RecipeCard` den Platz selbst füllt; sonst das Kind wie bisher positionieren. Darstellung der Galerie vorher/nachher in mindestens zwei Breiten (Handy, Desktop) vergleichen, z. B. per Screenshot im Dev-Server.
- Der `<style>` in `RecipeGrid.vue` ist nicht `scoped` und wirkt global; so belassen.
- `npm ci --legacy-peer-deps` installiert `eslint` nicht. Lokal `npm ci` ohne Flag; der Docker-Build muss mit Flag weiter laufen.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `grep -rn "deep-equal\|deepCopyYaml\|@vueuse/integrations\|googleapis\|lang=\"scss\"" frontend/src frontend/vite.config.js frontend/package.json` findet nichts
- `sass`, `deep-equal`, `@types/deep-equal`, `@vueuse/integrations` nicht mehr in `package.json`; Anzahl entfernter Pakete im Lock im Bericht
- `npm ci --legacy-peer-deps` (wie Dockerfile) fehlerfrei; `npm audit --audit-level=high` ohne Befund
- Galerie-Darstellung gleich (Screenshots oder beschriebener Vergleich im Bericht)
- Verifikation gemäß Projekt-CLAUDE.md (Frontend)
