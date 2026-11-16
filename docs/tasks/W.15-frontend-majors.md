# Auftrag W.15: Frontend-Majors anheben

> Erstellt 2026-11-17 vom Master · Roadmap: `ROADMAP.md` Punkt W.15 · Basis: `main@5cb0f92` · Aufwand: M–L · Modell: Opus

## Ziel
Die Frontend-Abhängigkeiten stehen auf den aktuellen stabilen Majors, die Pakete aus dem Plan sind angehoben. Das sichtbare Verhalten bleibt gleich; wo ein Major es ändert, wird das angeglichen und im Bericht genannt. TypeScript 7 bleibt ausdrücklich ausgenommen.

## Erst lesen
1. `docs/plans/abhaengigkeiten.md` – Abschnitt „W.15 Frontend-Majors“ und „Beobachtung Lieferkette“. Die Versionen dort stammen vom 2026-11-14 und sind vor dem Start erneut per `npm view` zu prüfen.
2. `.claude/rules/frontend.md`, `docs/DEVELOPMENT-GUIDELINES.md`
3. `frontend/package.json` (Overrides), `frontend/vite.config.js` (PWA), `frontend/tsconfig*.json`, `frontend/vitest.config.ts`, `frontend/Dockerfile`
4. Die Changelogs bzw. Migrationsleitfäden der Pakete, aus den offiziellen Quellen (Repo bzw. Doku des Herstellers)

## Auftrag
1. **Bestandsaufnahme (Checkpoint):**
   - Aktuelle Versionen per `npm view` erheben.
   - Breaking Changes je Paket aus dem offiziellen Changelog zusammenfassen und die betroffenen Stellen im Code zählen. Besonders bootstrap-vue-next 0.44 → 1.x: `BModal`, `BTabs`, `BToast`/`useToast`, `BApp`, Formular-Komponenten.
   - Für `workbox-build` und die Abhängigkeit `@trickfilm400/rollup-plugin-off-main-thread` prüfen, ob es inzwischen eine stabile Version gibt.
   - Schätzung vorlegen. Liegt bootstrap-vue-next allein über M, einen Schnitt vorschlagen, z. B. bootstrap-vue-next als eigenen Auftrag. Dann anhalten.
2. **Anheben, je Major ein eigener Commit**, Reihenfolge nach Risiko, die kleinsten zuerst:
   - `lint-staged` 17
   - `eslint` als direkte devDependency
   - `js-yaml` 5 inklusive `@types/js-yaml` bzw. eingebauter Typen
   - `@vueuse/core` 15
   - `pinia` 4
   - `vite-plugin-pwa` 2: danach den Override `vite-plugin-pwa.vite` entfernen
   - `bootstrap-vue-next` 1.x
   - TypeScript `~6.0.x`: Veraltet-Warnungen beheben, `tsconfig` `target`/`lib` auf ES2022
3. **Nach jedem Commit** `npm run lint:check && npm run typecheck && npm test && npm run build`. Ein roter Zwischenstand wird nicht committet.
4. **Overrides prüfen:** Wird `serialize-javascript` noch gebraucht? Begründen, ob er bleibt oder entfällt.
5. **Sichtprüfung im Browser** von Galerie, Rezeptansicht, Bearbeitung inkl. Modals und Toasts, Profil, Verwaltung und Import-Dialog. Mit dem Weg aus W.23 (Mock-IdP und `playwright-core` im Scratchpad) oder im Dev-Server. Dazu der Service Worker: Update-Hinweis, `registerType: prompt` aus W.22.
6. **Plan nachtragen:** die tatsächlich gesetzten Versionen und die Ausnahme TS 7 mit Stand und Bedingung.

## Ablage
- Geändert: `frontend/package.json`, `package-lock.json`, betroffene Komponenten und Composables, `vite.config.js`, `tsconfig*.json`, `docs/plans/abhaengigkeiten.md`, ggf. `.claude/rules/frontend.md`

## Nicht in diesem Auftrag
- TypeScript 7, Vue Router oder Vue auf eine neue Major-Version, Vite 9
- Bootstrap 6 (CSS-Framework), Icon-Paket
- Funktionale oder optische Änderungen, auch keine UX-Verbesserungen (U.1 läuft)
- Backend

## Entscheidungen, die ich treffe
- Am Checkpoint: Zuschnitt, falls bootstrap-vue-next allein über M liegt.

## Fallstricke
- **bootstrap-vue-next 1.x** ist die erste stabile Version, die Breaking Changes sind laut Plan umfangreich. In W.31 bis W.33 hängen `useToast` und `BApp` zusammen: `TransferNotice.vue` muss innerhalb von `BApp` liegen. `BModal` baut den Inhalt beim Schließen nicht ab (W.13, `useImportPages`). Ändert 1.x das, z. B. über ein neues `lazy` oder `unmount`, ändert sich das Verhalten des Import-Dialogs.
- **pinia 4 und `@vueuse/core` 15** betreffen Store und Composables. Dort liegen W.31 bis W.33 mit Single-Flight, `createdPending` und `useDebouncedRefHistory` (W.29). Die Specs sind das Sicherheitsnetz, alle müssen ohne Änderung des Testinhalts grün bleiben. Musst du einen Test inhaltlich ändern, begründe das im Bericht.
- **`vite-plugin-pwa` 2:** Die Konfiguration aus W.22/W.25 muss gleich wirken: `registerType: prompt`, `config.js` NetworkFirst ohne HTTP-Cache, Bild-Cache CacheFirst. Das gebaute `sw.js` vor und nach dem Anheben vergleichen.
- **TypeScript 6:** `typescript-eslint` verlangt `<6.1.0`, deshalb `~6.0.x`. `vue-tsc` mit TS 6 prüfen.
- **Parallel:** U.1 liest nur. 11.1 ergänzt einen Button in `AdminRecipes.vue`, dort ist ein kleiner Konflikt beim Merge möglich. W.34 und W.35 werden erst nach diesem Auftrag geschnitten.
- **Versionsangaben** nur aus `npm view` bzw. den offiziellen Changelogs, nichts aus dem Gedächtnis.

## Checkpoints
- Nach der Bestandsaufnahme (Schritt 1): Versionen, Breaking Changes, Schätzung, ggf. Schnitt vorlegen, dann anhalten.

## Abnahme
- Alle Pakete aus Schritt 2 auf der geprüften aktuellen Version, je Major ein grüner Commit; der Override `vite-plugin-pwa` ist entfernt
- `npm ci` ohne Warnungen zu Peers
- Alle bestehenden Tests grün, inhaltliche Änderungen an Tests begründet
- Sichtprüfung der Ansichten im Bericht, `sw.js` vor und nach dem Anheben verglichen
- Plan nachgetragen
- Verifikation gemäß Projekt-CLAUDE.md (Frontend; Container bauen wegen Abhängigkeiten)
