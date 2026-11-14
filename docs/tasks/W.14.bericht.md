# Bericht W.14: Frontend-Lock, Vue-CLI-Altlasten, Base-Images

> Branch `worktree-W.14-build-deps` · Basis `725e78c` (HEAD bei Start `f20df40`, nur docs) · Stand `f85d041` · 2026-11-14 · Dauer: 15:43 – 16:00 (17 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Lock innerhalb der Versionsbereiche aktualisiert, `package.json` unverändert, `npm audit` ohne high. Die Vue-CLI-Altlasten sind weg, `dist/index.html` ist inhaltlich unverändert. Node- und nginx-Image sind gepinnt, beide Images bauen.

## Commits
- `2bdfbaf` build(frontend): Lockfile innerhalb der Versionsbereiche aktualisieren (fehlerhaft, siehe `f85d041`)
- `ed39c1e` refactor(frontend): Vue-CLI-Altlasten entfernen
- `149f745` build(deploy): Node- und nginx-Base-Image auf feste Linien pinnen
- `f85d041` build(frontend): Lockfile ohne --legacy-peer-deps neu auflösen

## Verifikation
- `npm audit --audit-level=high` → Exit 0; 12 Funde (2 low, 10 moderate, 0 high)
- `npm ci --legacy-peer-deps` → fehlerfrei (537 Pakete)
- `npm ci && npm run lint:check && npm run typecheck && npm run build` → grün, 0 Fehler; 1 Prettier-Warnung in `src/components/features/AIRecipeImport.vue:375` (neue Prettier-Version, `src/` nicht im Scope)
- `docker build frontend` und `docker build backend` → erfolgreich (Frontend nach letztem Lock erneut)
- `git diff f20df40 -- frontend/package.json` → leer
- `dist/index.html` vorher/nachher → nur der Asset-Hash des Entry-Scripts unterscheidet sich
- Sichtprüfung: keine
- Prüfzeit: ~5 min; größter Posten: `npm ci` (~45–60 s je Lauf)
- Prüfskripte: nur Scratchpad

## Struktur und Doku
- Gewachsene Dateien, neue Module, Duplikate: keine
- CLAUDE.md, Rules, README: erwähnen keine der gelöschten Dateien, stimmen noch

## Abweichungen vom Auftrag
- **Messung W.2 Schritt 1:** `dist/index.html` entsteht aus der Root-`index.html`, nicht aus `public/index.html`. Die PNG-Favicon- und Apple-Touch-Links aus `public/index.html` standen **nicht** im Build und wurden deshalb nicht übernommen. Heute ausgeliefert: nur `favicon.svg`, kein `apple-touch-icon`. Der Viewport mit `user-scalable=no` bleibt.
- **Node-Pin:** `node:lts-alpine` zeigt heute auf Node 26.13.1 (nodejs.org und Docker bestätigt), nicht auf 24. Gepinnt auf `node:26-alpine`; Vite 8 verlangt `^20.19 || >=22.12`. Vorher lief der Build faktisch schon auf 26.
- **nginx:** `stable-alpine` ist 1.30.6, gepinnt auf `nginx:1.30-alpine`.
- **Lock zweimal erzeugt:** `npm update --legacy-peer-deps` hat die Peer-Pakete (u. a. `eslint`) aus dem Lock verloren, `npm run lint:check` fand dann kein eslint. `f85d041` löst den Lock ohne das Flag neu auf (Ausgangslock `f20df40`). Der Lock-Diff ist größer als nur Versionssprünge, weil npm den Baum umgebaut hat (Pakete hinzugekommen/entfallen).
- Hinweis: `eslint` steht im Lock als `peer`. `npm ci --legacy-peer-deps` installiert es nicht, `npm ci` schon. Der Docker-Build braucht es nicht; das war schon vorher so.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- Verbliebene Funde, nur per Major-Update oder Downgrade behebbar (nicht erzwungen):
  - moderate: `typescript-eslint` und `@typescript-eslint/{eslint-plugin,parser,type-utils,typescript-estree,utils}` über `minimatch`; npm schlägt Downgrade auf 8.36.0 vor
  - moderate/low: `vite-plugin-pwa` → `workbox-build` → `glob`, `@rollup/plugin-node-resolve`, `deepmerge`; npm schlägt Downgrade auf 1.1.0 vor (löst sich laut Plan mit W.15)
- Falls ein Apple-Touch-Icon im PWA gewünscht ist: heute fehlt es im Build (vermutlich unbemerkt seit der Vite-Migration). Kleiner Folgepunkt, ca. S, fachliche Entscheidung beim Master.
- Prettier-Warnung `AIRecipeImport.vue:375`: Format-Fix in `src/`, ca. XS.

## Status je Roadmap-Punkt
- `W.14` fertig
- `W.2` fertig
- `W.7` fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.14 Frontend-Lock auffrischen · 2026-11-14 · f85d041`
`- [x] W.2 Vue-CLI-Altlasten entfernen · 2026-11-14 · ed39c1e`
`- [x] W.7 Base-Images pinnen · 2026-11-14 · 149f745`
