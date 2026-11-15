# Bericht W.10: Vitest einführen, Store-Schnitt, erste Tests

> Branch `worktree-W.10-vitest` · Basis `39d53b1` (HEAD bei Start `d120fd4`, nur `docs(roadmap)`) · Stand `6b061b4` · 2026-11-15 · Dauer: 20:30 – 20:41 (11 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Das Frontend hat eine Testumgebung (Vitest 5.1.0, `@vue/test-utils` 2.6.0, happy-dom 21.0.4) mit eigener `vitest.config.ts`; `npm test` läuft lokal und im CI-Job `frontend`. 63 Tests in 9 Specs decken Utilities, Mapper, `recipeApi.listAll`, Skalierung, `useDraft`, `Callback.vue`, `App.vue` und `saveSettings` ab. Mapper und Seitenladen liegen nicht mehr im Store, `saveSettings` speichert eine Kopie.

## Commits
- `5dd2ee2` build(frontend): Vitest mit Test-Utils und happy-dom einführen
- `7e12721` refactor(frontend): Mapper und Listenladen aus dem Store lösen
- `2e20f61` test(frontend): Specs für Composables, Callback, App und saveSettings
- `6b061b4` ci: Frontend-Tests in CI und Doku aufnehmen

## Verifikation
- `npm ci` (ohne Flag) → grün, Vitest erklärt Vite 8 als Peer (`^6.4 || ^7 || ^8`), kein weiterer Override
- `npm test` → 63 Tests, 9 Dateien, grün, Laufzeit ~1 s
- `npm run lint:check` → 0 Fehler (617 Warnungen, alle `Delete ␍`: CRLF-Checkout unter Windows, bestehend, `.gitattributes` normalisiert auf LF)
- `npm run typecheck` → grün (Specs eingeschlossen, da unter `src/`)
- `npm run build` → grün
- Workflow-Syntax: nur eine Zeile eingefügt, nicht mit einem Linter geprüft
- Sichtprüfung: keine. Die Ansichten wurden nicht im Dev-Server oder Container geprüft; die Abnahme „stichprobenartig geprüft“ steht aus. Die Auslagerung ist verhaltensgleich (Code unverändert verschoben), `saveSettings` ist per Test abgedeckt.
- Prüfzeit: ~3 min; größter Posten: `npm ci` (47 s)
- Prüfskripte: keine

## Struktur und Doku
- Neue Module: `src/js/recipeMapping.ts`, `frontend/vitest.config.ts`. `recipeStore.ts` schrumpft um ~55 Zeilen. Keine bewussten Duplikate.
- CLAUDE.md (Befehle, Verifikation) und `DEVELOPMENT-GUIDELINES.md` (10.2, 10.3, neuer Abschnitt 11 Tests) nachgetragen. `.claude/rules/frontend.md` stimmt weiter.
- Entscheidung Resolver: `vitest.config.ts` trägt `unplugin-vue-components` mit `BootstrapVueNextResolver` ein (wie im Build, `dts: false`). `App.vue` stubbt `BApp`, `BottomNav`, `RouterView` zusätzlich.
- Die Config enthält ein `eslint-disable-next-line no-restricted-exports` für den Default-Export (Vorgabe von `defineConfig`); die Regel gilt sonst für alle `.ts`.

## Abweichungen vom Auftrag
- **`useDraft` und „Undo“:** `useDraft` enthält keinen Undo (Sichern, Wiederherstellen, Verwerfen sind getestet). Undo/Redo liegt in `Edit.vue` (`canUndo`, `undo`). Nicht getestet.
- **`Callback.vue`, „doppelter Aufruf“:** Die Komponente importiert `handleCallback` aus `@/auth/oidc` (nicht `session`), gemockt wurde `oidc`. Eine Absicherung gegen doppelte Verarbeitung gibt es weder dort noch in `oidc.handleCallback`; getestet ist, dass pro Anzeige genau ein Aufruf erfolgt (auch nach erneutem Rendern). Ein zweiter Mount würde den Code zweimal einlösen.
- **Skalierung:** Der Code kann nur lineare Skalierung (optional `recalc_exp`) der ersten Menge je Zutat. Brüche (als Text) und Einheitenumrechnung gibt es nicht; getestet ist das tatsächliche Verhalten, auch dass Einheiten unverändert bleiben.
- Zusätzlich: `recipeStore.spec.ts` (nur `saveSettings`, drei Fälle) für die geforderte Kopie-Prüfung.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Callback doppelt absichern:** `handleCallback` gegen Mehrfachaufruf (zweiter Mount, Reload) mit demselben Code schützen. Aufwand XS.
- **Undo-Test für `Edit.vue`:** Undo/Redo steckt in der View; zum Testen in ein Composable ziehen. Aufwand S.
- **Prettier-Warnungen `␍` unter Windows:** `endOfLine` in der Prettier-Konfiguration auf `auto` bzw. Checkout mit LF. Aufwand XS, nur lokal relevant.
- Stichprobe der Ansichten im Dev-Server/Container steht aus (siehe Verifikation).

## Status je Roadmap-Punkt
- `W.10` fertig (Sichtprüfung der Ansichten ausstehend)

## Vorschlag Roadmap-Zeilen
`- [x] W.10 Vitest einführen, Store-Schnitt, erste Tests · 2026-11-15 · 6b061b4`
