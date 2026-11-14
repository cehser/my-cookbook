# Bericht W.16: Verzichtbare Frontend-Abhängigkeiten ersetzen

> Branch `worktree-W.16-abhaengigkeiten-verschlanken` · Basis `e88c2d8` (Auftrag nennt `e1481fe`, dazwischen nur `docs(roadmap)`) · Stand `5acab54` · 2026-11-14 · Dauer: 22:54 – 23:05 (11 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
`deep-equal`, `@types/deep-equal`, `sass` und `@vueuse/integrations` sind aus `package.json` und Lock entfernt. `deepCopyYaml` ist durch `deepCopyJSON` ersetzt, `isEqualPlain` ersetzt `deep-equal`, `RecipeGrid.vue` nutzt reines CSS, die Font-Cache-Regel ist gelöscht. Im Lock fallen 22 `node_modules/`-Einträge weg (Diff gegen Basis, inkl. transitiver Pakete).

## Commits
- `88249eb` refactor(frontend): deepCopyYaml durch deepCopyJSON ersetzen
- `49a291c` refactor(frontend): deep-equal durch isEqualPlain ersetzen
- `7654146` refactor(frontend): sass entfernen, RecipeGrid auf reines CSS
- `5cbebcb` build(frontend): @vueuse/integrations entfernen
- `5acab54` chore(pwa): Font-Cache-Regel für googleapis entfernen

## Verifikation
- Abnahme-`grep` (`deep-equal|deepCopyYaml|@vueuse/integrations|googleapis|lang="scss"`) → keine Treffer
- `npm run lint:check` → 0 Fehler, 1 Warnung (prettier in `AIRecipeImport.vue`, nicht berührt, schon vorher vorhanden; nicht gegen Basis geprüft)
- `npm run typecheck` → grün
- `npm run build` → grün (vor und nach `npm ci --legacy-peer-deps`)
- `npm ci --legacy-peer-deps` → fehlerfrei; `npm audit --audit-level=high` → Exit 0, keine High-Befunde (12 moderate/low, u. a. `deepmerge`/`glob`/`minimatch` über `workbox-build` und `typescript-eslint`, gehören zu W.15)
- Sichtprüfung: keine Screenshots (kein Backend/Login im Worktree gestartet). Vergleich durch Code: `.cardAspect` ist die Wurzel von `RecipeCard`; vorher `padding-bottom: 66,67 %` + `position: relative`, erstes Kind absolut auf 100 %. Jetzt `aspect-ratio: 3 / 2` + `position: relative`, erstes Kind unverändert absolut auf 100 %. Das Seitenverhältnis ist gleich, die Kindpositionierung identisch. **Unbestätigt:** visueller Vergleich in Handy- und Desktopbreite steht aus.
- Prüfzeit: ~3 min; größter Posten: `npm ci` (26–44 s)
- Prüfskripte: keine

## Struktur und Doku
- Gewachsene Dateien, neue Module, bewusste Duplikate: neu `frontend/src/js/isEqualPlain.ts` (~30 Zeilen); keine Duplikate.
- Berührte Aussagen in CLAUDE.md, Rules: stimmen noch. `frontend.md` nennt `npm ci` ohne Flag weiterhin korrekt.

## Abweichungen vom Auftrag
- `isEqualPlain` vergleicht strikt (`===`), `deep-equal` vergleicht standardmäßig locker (`==`). Bei `Settings` (boolean/string) kein Unterschied.
- `Object.hasOwn` scheitert am TS-`lib`-Target, deshalb `Object.prototype.hasOwnProperty.call`.

## Nachgetragen in Specs/Plänen
- nichts

## JSON-Sicherheit der Kopien
- `Recipe` und `Settings` (`src/types/`) enthalten nur string/number/boolean/null, optionale Felder, Arrays und einfache Objekte; kein `Date`, `Map`, Funktion. Optionale Felder, die `undefined` sind, entfallen in der Kopie. Beim Speichern in IndexedDB oder Senden an die API ist das gleichwertig; `deepCopyYaml` hätte bei `undefined` geworfen.
- Der Kommentar in `deepCopy.ts` zur Eignung ist angepasst; `offlineCache.ts`-Kommentar angepasst.
- Es gibt weiterhin keine Tests für `deepCopyJSON`/`isEqualPlain` (W.10).

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- Visueller Galerievergleich (Handy/Desktop) vor dem Merge von Hand prüfen.

## Status je Roadmap-Punkt
- `W.16` fertig (Galerie-Sichtprüfung offen)

## Vorschlag Roadmap-Zeilen
`- [x] W.16 Verzichtbare Frontend-Abhängigkeiten ersetzen · 2026-11-14 · 5acab54`
