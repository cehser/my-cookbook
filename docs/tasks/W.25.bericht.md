# Bericht W.25: Konfig-Härtung, Chunk-Fehler, Backend-Warnungen

> Branch `worktree-W.25-konfig-haertung` · Basis `39d53b1` · Stand `e9c451e` · 2026-11-15 · Dauer: 20:23 – 20:41 (18 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
`config.js` liegt nicht mehr im Precache, sondern wird NetworkFirst (3 s) geliefert: Eine geänderte Config erreicht eine offene PWA beim nächsten Start, offline greift der Cache. Das Backend startet ohne `DB_PASSWORD` nicht mehr, `docker compose config` bricht ohne die Variable ab. Chunk-Fehler laden im getesteten Chromium genau einmal auf das Ziel neu; der Mechanismus (`vite:preloadError`) ist browserunabhängig. `pytest` und `pytest -m db` laufen ohne die `distinct`- und `path_separator`-Warnungen, `_process_image` hat einen Test.

## Commits
- `1565edc` fix(backend): DB_PASSWORD ohne Default, Warnungen beseitigen, Bildtest
- `d8764b8` fix(deploy): DB_PASSWORD im Compose-Beispiel als Pflichtangabe
- `9cb4d7e` fix(pwa): config.js NetworkFirst, Chunk-Fehler browserübergreifend
- `e9c451e` docs(pwa): Regeln zu config.js und Chunk-Fehlern nachgezogen

## Verifikation
- `npm run lint:check && npm run typecheck && npm run build` → grün (Build 978 ms)
- `uv sync --frozen && ruff check && ruff format --check && pytest` → 120 passed, 6 skipped (DB-Tests), keine Warnungen
- `pytest -m db` gegen Wegwerf-Container `postgres:16-alpine` → 6 passed, auch mit `-W default` ohne Warnungen; neuer Test `test_list_returns_first_image_per_recipe` deckt `distinct_on` (die DB-Tests deckten das Titelbild vorher nicht)
- `dist/sw.js`: kein Precache-Eintrag für `config.js`; Route `({url}) => url.pathname === "/config.js"` mit `NetworkFirst`, Cache `runtime-config`, `networkTimeoutSeconds: 3`. Precache 54 Einträge.
- Import mit `OIDC_*`, ohne `DB_PASSWORD` → `ValidationError … db_password Field required`
- `docker compose -f docker-compose.yml.example config` ohne Variable → `required variable DB_PASSWORD is missing a value: DB_PASSWORD in .env setzen`
- Sichtprüfung im Browser (Edge/Chromium headless über Playwright, Build `dist/` über eigenen Node-Server auf `http://localhost`, nicht der Container):
  - A: `config.js` v1 → Server liefert v2 → Neuladen zeigt v2 ohne neuen Build; danach Offline-Start mit gefülltem Cache: App rendert, Config v2 aus Cache.
  - B1: Precache geleert, Callback-Chunk liefert 404, Navigation per `popstate`: genau ein `load`, Ziel `/callback`.
  - B2: wie B1, zuvor zweiter Tab und geänderte `sw.js`, Tab A aktiviert den neuen SW (Tab B soll dadurch `reloadPending` haben): genau ein `load`. Dass B tatsächlich `reloadPending` hatte, ist nicht direkt belegt (Modulzustand), und Chromium löst hier auch den Textabgleich aus. Der Test unterscheidet daher weder den Ereignispfad vom Textabgleich noch belegt er das Zusammenspiel beider Handler zweifelsfrei.
- Nicht geprüft: Container-Lauf (`docker compose build/up`, `/api/health`). Es änderten sich weder Abhängigkeiten noch Dockerfile noch Migrationen, die CLAUDE.md verlangt ihn dann nicht. Firefox und Safari nicht im Browser getestet. Das Zwei-Tab-Szenario ist mit dem Test aus dem Scratchpad nachgestellt, nicht mit dem Container.
- Prüfzeit: ~4 min; größter Posten: `npm ci` und `uv sync` im frischen Worktree plus Browser-Test
- Prüfskripte: nur Scratchpad (`C:\Users\ce\AppData\Local\Temp\claude\beb48852c7fd70f3\ac617081-0eb5-4a99-a0a5-b0aafdbf905c\scratchpad\e2e\run.mjs`, Node-Server + `playwright-core`, außerhalb des Projekts, keine Projektabhängigkeit)

## Struktur und Doku
- Neu: `frontend/src/js/reload.ts` (`reloadOnce`, gemeinsamer Schutz gegen doppeltes Neuladen), `backend/tests/test_image_processing.py`. Keine gewachsenen Dateien, keine bewussten Duplikate.
- `.claude/rules/frontend.md`: nachgetragen (`config.js` NetworkFirst, Chunk-Fehler, `reloadOnce`). `CLAUDE.md` und `backend-tooling.md` stimmen noch.

## Abweichungen vom Auftrag
- **Chunk-Handler:** `vite:preloadError` ersetzt den Textabgleich nicht ganz. Laut Vite-8.3.8-Quelltext (`node.js`, `__vitePreload`) feuert das Ereignis für gescheiterte Preloads **und** für den Import selbst (`baseModule().catch(handlePreloadError)`), also browserunabhängig. Es wird nicht mit `preventDefault` behandelt, damit der Fehler `router.onError` samt Ziel erreicht; dort setzt das Ereignis ein Flag. Der Textabgleich bleibt als Rückfall (Regex).
- **Meldungstexte:** Chrome „Failed to fetch dynamically imported module“ und Firefox „error loading dynamically imported module“ per Websuche belegt (Mozilla-Bugzilla, fingerprint.com-Forum). Safari „Importing a module script failed“ **unbestätigt** (kein Beleg gefunden); der Code verlässt sich darauf nicht, weil das Ereignis greift.
- **Navigationsfehler bei `reloadPending`:** Ein Fehler aus einem Lazy-Import ruft in vue-router `onError`, nicht `afterEach(…, failure)` (aus dem Verhalten von vue-router abgeleitet, nicht im Quelltext geprüft). Der Handler in `swUpdate.ts` hängt deshalb an `router.onError`. Bei laufender schreibender Anfrage (`pendingWrites > 0`) lädt er nicht; die Navigation bleibt dann gescheitert.
- `.env.example` (`DB_PASSWORD=changeme`) und die README-Tabelle (Pflicht „Ja“) blieben unverändert; die README stimmte schon.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Prüfpunkt vor dem Deploy:** In der Server-`.env` muss `DB_PASSWORD` gesetzt sein (nicht gelesen). Fehlt es, liefen DB und Backend bisher mit `changeme`; jetzt bricht `docker compose` ab, das Backend startet nicht. Steht dort ein Wert, ändert sich nichts. Lief die DB bisher mit `changeme` und soll ein neues Passwort gelten, muss es in Postgres per `ALTER USER` gesetzt werden: Die Variable ändert ein bestehendes Datenverzeichnis nicht.
- **EXIF-Ausrichtung:** `_process_image` ruft `ImageOps.exif_transpose` nicht auf; Handyfotos im Hochformat können gedreht erscheinen (aus dem Code abgeleitet, nicht live geprüft). Deshalb kein EXIF-Test. Vorschlag: eigener Punkt, XS bis S; berührt W.13/W.28 (Fotoimport), Abstimmung nötig.
- **Reload-Schleife:** Liefert der Server die Chunks dauerhaft nicht, lädt die App nach jedem Fehler neu (nicht verschärft, aber ohne Schutz). Zeitsperre per `sessionStorage` wäre XS; Entscheidung bei dir.
- `.env.example` enthält noch `DB_PASSWORD=changeme` als Vorlagenwert. Wer ihn unverändert kopiert, startet mit schwachem Passwort. Optional leeren (XS).
- Der erste Start nach dem Update braucht Netz, weil `config.js` aus dem Precache verschwindet und noch nicht im Cache `runtime-config` liegt.

## Status je Roadmap-Punkt
- `W.25` fertig
- `W.26` fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.25 Konfig-Härtung (config.js NetworkFirst, DB_PASSWORD Pflicht, Chunk-Fehler) · 2026-11-15 · e9c451e`
`- [x] W.26 Backend-Warnungen (distinct_on, path_separator) und Bildtest · 2026-11-15 · e9c451e`
