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
- **Reload-Schleife** (erledigt in Nacharbeit N3): Liefert der Server die Chunks dauerhaft nicht, lädt die App nach jedem Fehler neu (nicht verschärft, aber ohne Schutz). Zeitsperre per `sessionStorage` wäre XS; Entscheidung bei dir.
- (erledigt in Nacharbeit N5) `.env.example` enthält noch `DB_PASSWORD=changeme` als Vorlagenwert. Wer ihn unverändert kopiert, startet mit schwachem Passwort. Optional leeren (XS).
- Der erste Start nach dem Update braucht Netz, weil `config.js` aus dem Precache verschwindet und noch nicht im Cache `runtime-config` liegt.

## Status je Roadmap-Punkt
- `W.25` fertig
- `W.26` fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.25 Konfig-Härtung (config.js NetworkFirst, DB_PASSWORD Pflicht, Chunk-Fehler) · 2026-11-15 · 3562451`
`- [x] W.26 Backend-Warnungen (distinct_on, path_separator) und Bildtest · 2026-11-15 · e9c451e`

---

## Nacharbeit (N1–N6)

> Ausgangsstand `e9c451e` · Merge `main` → `8afb7ed` (ohne Konflikte) · Stand `3562451` · 2026-11-15 · Dauer: 21:48 – 22:15 (27 min, Warten 0 min) · Modell: Opus (Auftrag: Sonnet, von dir gewechselt) · Status: fertig

### Ergebnis
- N1: `config.js` lädt am HTTP-Cache vorbei.
- N2: Ein wartendes Update wird offline nicht aktiviert.
- N3: Chunk-Neuladen höchstens einmal je 10 s.
- N4: `vite:preloadError` zählt nur während einer Navigation.
- N5: `.env.example` ohne Vorgabepasswort.
- N6: Die DB-URL kodiert Sonderzeichen. Alembic nimmt das URL-Objekt direkt.

### Commits
- `8afb7ed` Merge branch 'main' into worktree-W.25-konfig-haertung
- `0ccca64` fix(db): DB-URL per URL.create, Sonderzeichen im Passwort (N6)
- `5734102` docs(deploy): .env.example ohne Vorgabe für DB_PASSWORD (N5)
- `1071f93` ci(db): DB-Tests mit Sonderzeichen-Passwort (N6, DB-Test)
- `afc2bea` fix(pwa): config.js am HTTP-Cache vorbei laden (N1)
- `d04ae81` fix(pwa): SW-Update offline nicht aktivieren (N2)
- `83ae521` fix(pwa): Chunk-Neuladen begrenzen, preloadError an Navigation binden (N3, N4)
- `3acf16e` docs(deploy): Sonderzeichen in DB_PASSWORD in README erläutern
- `3562451` docs(pwa): Regeln zu no-cache, Offline-Aktivierung und Schleifenschutz

### Umsetzung, wo vom Auftragstext abweichend oder ergänzt
- **N6 Alembic:** `env.py` nutzt `settings.database_url` (jetzt `sqlalchemy.URL`) direkt, für `create_async_engine` und offline für `context.configure(url=…)`. `config.set_main_option` fällt weg. Grund: configparser wertet das `%` der kodierten URL als Interpolation aus. Gegenprobe mit altem Code: `ValueError: invalid interpolation syntax`. Die übrigen Nutzer (`database.py`, DB-Test-Fixtures) nehmen das URL-Objekt unverändert an.
- **N6 DB-Test:** Die CI (`backend-db`) läuft jetzt mit dem Passwort `p@ss:w/rd#%?`. Damit prüft jeder CI-Lauf die Migrationen up/down/up und die API mit Sonderzeichen.
- **N4:** Das Flag wird nur gesetzt, solange eine Navigation läuft (`pendingTarget`), und in `beforeEach` zurückgesetzt.
- **N2:** Die Bedingung `navigator.onLine` steht in `applyUpdate` und gilt damit für Navigation, Rückkehr in den Vordergrund und `reloadPending`. Nicht betroffen ist der Navigationsfehler-Pfad bei `reloadPending` in `swUpdate.ts`: Dort ist die Navigation ohnehin gescheitert. Offline lädt er weiterhin neu.
- **README:** Die Upgrade-Hinweise stimmen weiter. Neu ergänzt:
  - In der Variablentabelle der Hinweis, dass Compose ein unquotiertes `$` in `.env` auswertet (einfache Anführungszeichen setzen).
  - Unter dem `ALTER ROLE`-Befehl der Hinweis auf `$`, `` ` ``, `\` und `'`.

### Verifikation
- **Frontend:** `npm test` 63 passed (9 Dateien, inkl. `App.spec.ts`). `lint:check`, `typecheck` und `build` grün.
- **`dist/sw.js`:** `NetworkFirst({cacheName:"runtime-config",networkTimeoutSeconds:3,fetchOptions:{cache:"no-cache"},…})`
- **Backend:** `uv sync --frozen`, `ruff check` und `ruff format --check` grün. `pytest` 126 passed, 6 übersprungen, ohne Warnungen.
- **DB-Tests:** `pytest -m db -W default` gegen PG 16 mit Passwort `p@ss:w/rd#%?`: 6 passed, ohne Warnungen.
- **Neue Smoke-Tests** (`tests/test_database_url.py`):
  - URL-Rundweg mit Passwort `p@ss:w/rd#%?&=+ äö` und Benutzer `koch@buch`.
  - Alembic-Offline-SQL (`upgrade head --sql`) mit diesem Passwort.
  - Beide scheitern mit dem alten Code.
- **Container:** Images aus dem Worktree gebaut (Backend, Frontend), ohne `.env`, in einem eigenen Netz.
  - Backend ohne `DB_PASSWORD`: `ValidationError … db_password Field required`.
  - Backend mit Sonderzeichen-Passwort gegen frische PG-16-DB: Migrationen 001→006, „Database migrations applied successfully“, `GET /api/health` → `{"status":"ok","database":"connected"}`.
  - Frontend: Ein neuer Container mit geändertem `OIDC_CLIENT_ID` aus demselben Image ergibt in der offenen PWA nach dem Neuladen den neuen Wert. Offline-Start danach zeigt den Wert aus dem Cache.
  - Danach alle Testcontainer, das Netz und die Images entfernt.
- **Browser (Edge/Chromium headless, Build über Node-Server mit nginx-artigen Headern, nur `Last-Modified`):**
  - A1–A3 OK.
  - B1 und B2 OK. B2 jetzt mit Nachweis der Voraussetzung: Tab B kontrolliert, neuer SW aktiv, B selbst nicht neu geladen, also `reloadPending`.
  - C (N3): dauerhaft fehlender Chunk, genau ein Neuladen, keine Schleife. Nach 10 s ist wieder eines erlaubt.
  - D (N2): wartender SW offline, Navigation ohne Aktivierung und ohne Neuladen; online folgt ein Neuladen.
  - **Gegenprobe N1:** Build ohne `fetchOptions` → A2 scheitert, die alte `config.js` bleibt im HTTP-Cache.
- **Korrektur zum ersten Bericht:** Der Test-Helfer `swReady` schluckte damals ein Timeout. Ob Tab B in B2 kontrolliert war, war deshalb nicht gesichert. Jetzt ist der Helfer strikt, alle Szenarien sind neu gelaufen.
- **Prüfzeit:** ~6 min. Größter Posten: Browser-Szenarien (~2 min) und Image-Builds.
- **Prüfskripte:** nur Scratchpad (`…\scratchpad\e2e\run.mjs`, `container.mjs`).

### Struktur und Doku
- **Neu:** `backend/tests/test_database_url.py`.
- **`router/index.ts`:** um ~25 Zeilen gewachsen (Chunk-Handler mit Schleifenschutz).
- **Nachgetragen:** `.claude/rules/frontend.md`, `README.md` (Variablentabelle, Hinweis unter `ALTER ROLE`), `.env.example`.

### Mitgenommen
- Kopfkommentar in `swUpdate.ts` um „ebenso fehlendes Netz“ ergänzt (im N2-Commit).

### Offen und Folgepunkte
- **Prüfpunkt vor dem Deploy (unverändert):** `DB_PASSWORD` in der Server-`.env` (nicht gelesen). Enthält es `$` ohne einfache Anführungszeichen, hat Compose den Wert bisher schon verkürzt. Die DB kennt dann das verkürzte Passwort. Das ist nicht neu, aber beim Nachtragen zu beachten.
- **Leeres `DB_PASSWORD=`:** Compose bricht ab (`:?` greift auch bei leer). Das Backend allein (ohne Compose) akzeptiert einen leeren String. Optional `min_length=1` in `config.py` (XS).
- **Keine Unit-Tests für Router- und SW-Logik:** `App.spec.ts` mockt `@/router`, die neuen Listener laufen in Vitest nicht. Sie sind nur über die Browser-Szenarien geprüft. Ein Spec für Chunk-Handler und `applyUpdate` wäre S (passt zu W.23/W.29, falls dort Tests geplant sind).
- **EXIF-Ausrichtung** in `_process_image`: weiter offen (siehe oben).
