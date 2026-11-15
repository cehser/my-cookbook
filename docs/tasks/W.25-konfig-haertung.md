# Auftrag W.25: Konfig-Härtung, Chunk-Fehler, Backend-Warnungen

> Erstellt 2026-11-15 vom Master · Roadmap: `ROADMAP.md` Punkte W.25, W.26 · Basis: `main@5f52d25` · Aufwand: S · Modell: Sonnet

## Ziel
Eine geänderte Laufzeitkonfiguration (`config.js`) erreicht installierte PWAs ohne neuen Build. Das Backend startet nicht mehr mit einem Standardpasswort. Ein Tab, dessen alte Chunks nach einem Update fehlen, lädt in allen Browsern neu, statt hängenzubleiben. `pytest` läuft ohne Deprecation-Warnungen, und die Bildverarbeitung hat einen Test.

## Erst lesen
1. `docs/tasks/W.3.bericht.md` (Laufzeitconfig), `docs/tasks/W.22.bericht.md` und `.claude/rules/frontend.md` (SW-Update, `reloadPending`, `onNeedReload`)
2. `frontend/vite.config.js` (Workbox), `frontend/index.html` (`/config.js`), `frontend/.docker/nginx/config.js.template` und Entrypoint
3. `frontend/src/router/index.ts` (Chunk-Handler, `router.onError`), `frontend/src/js/swUpdate.ts`
4. `backend/app/config.py`, `docker-compose.yml.example`, `backend/tests/conftest.py`
5. `docs/tasks/W.5.bericht.md` – „Offen und Folgepunkte“; `backend/app/routes/recipes.py` (`.distinct(…)`), `backend/alembic.ini`, `backend/app/routes/images.py` (`_process_image`)

## Auftrag

### W.25 Konfig-Härtung und Chunk-Fehler
1. **`config.js`:** aus dem Precache nehmen (`globIgnores`) und per `runtimeCaching` NetworkFirst ausliefern, mit kurzem Netz-Timeout, damit die App offline weiter startet. Prüfen, dass `dist/sw.js` `config.js` nicht mehr im Precache-Manifest führt.
2. **`DB_PASSWORD`:** `db_password` in `config.py` ohne Default (Pflichtfeld wie `OIDC_*`); `conftest.py` setzt einen Testwert vor dem App-Import. Im Compose-Beispiel `${DB_PASSWORD:-changeme}` durch eine Pflichtangabe mit Meldung ersetzen (`${DB_PASSWORD:?…}`). README-Tabelle prüfen.
3. **Chunk-Fehler:**
   - Den Abgleich in `router/index.ts` auf die Meldungen von Firefox und Safari erweitern. Die Texte im Bericht mit Quelle belegen, sonst als unbestätigt kennzeichnen. Prüfen, ob das Vite-Ereignis `vite:preloadError` den Textabgleich ganz oder teilweise ersetzen kann (Vite-8-Doku).
   - Zusätzlich in `swUpdate.ts`: Scheitert eine Navigation, während `reloadPending` gesetzt ist, auf das Ziel neu laden, unabhängig vom Meldungstext. Die Aktivierung bei laufender schreibender Anfrage (`pendingWrites`) bleibt wie bisher.
   - Doppeltes Neuladen durch beide Handler ausschließen.
4. `.claude/rules/frontend.md` anpassen (`config.js` NetworkFirst, Chunk-Fehler).

### W.26 Backend-Warnungen und Bildtest
1. `.distinct(RecipeImage.recipe_id)` in `routes/recipes.py` auf die in SQLAlchemy 2.1 vorgesehene Form `postgresql.distinct_on` umstellen; API gegen die SQLAlchemy-Doku prüfen. Die DB-Tests decken die Liste mit Titelbild ab; wenn nicht, einen Fall ergänzen.
2. `alembic.ini`: `path_separator` setzen, Warnung weg.
3. Smoke-Test für `_process_image` ohne DB: erzeugtes Bild (Pillow) in `tmp_path`, prüft Thumbnail und optimiertes Bild (Format, Maße höchstens wie konfiguriert), dazu ein Bild mit EXIF-Ausrichtung, falls `_process_image` diese behandelt.
4. Ziel: `uv run pytest` und `pytest -m db` ohne die Warnungen aus dem W.5-Bericht. Verbleibende Warnungen im Bericht mit Grund.

## Ablage
- Geändert: `frontend/vite.config.js`, `frontend/src/router/index.ts`, `frontend/src/js/swUpdate.ts`, `backend/app/config.py`, `backend/tests/conftest.py`, `docker-compose.yml.example`, ggf. `README.md`, `backend/app/routes/recipes.py`, `backend/alembic.ini`, `.claude/rules/frontend.md`
- Neu: Test für `_process_image` unter `backend/tests/`

## Nicht in diesem Auftrag
- Hinweis „Neue Version verfügbar“, weiteres SW-Verhalten (W.22 abgeschlossen)
- Bildarten `photo`/`source` (W.28), AI-Import (W.13 läuft parallel)
- Vitest (W.10)

## Entscheidungen, die ich treffe
- keine

## Fallstricke
- **W.13 läuft parallel:** Er ändert `README.md` (Upload-Grenze, Proxy) und `.claude/rules/ai-import.md`. In der README nur den Abschnitt zu `DB_PASSWORD` anfassen.
- **Server:** Fehlt `DB_PASSWORD` in der Server-`.env`, liefen DB und Backend bisher mit `changeme` und starten danach nicht mehr. Im Bericht als Prüfpunkt vor dem Deploy nennen; `.env` nicht lesen.
- **CI:** Die Smoke-Tests importieren die App ohne `.env`; ohne Testwert in `conftest.py` bricht der Import (wie bei `OIDC_*` in W.3). Der DB-Job setzt `DB_PASSWORD` schon.
- **`config.js` offline:** NetworkFirst ohne Treffer im Cache und ohne Netz liefert nichts; der erste Start nach dem Update braucht also Netz. Verhalten bei Offline-Start mit gefülltem Cache prüfen. `index.html` lädt `/config.js` als klassisches Script vor dem App-Bundle; die Reihenfolge darf sich nicht ändern.
- Der SW läuft nur im Build (`npm run build` + `vite preview` oder Container), nicht im Dev-Server.
- **Zwei Tabs mit fehlendem Chunk:** Nachstellen wie im W.22-Bericht (Szenario S3/Zwei Tabs). Der Fall tritt erst auf, wenn der Server die alten Chunks nicht mehr ausliefert.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `dist/sw.js`: `config.js` nicht im Precache, Runtime-Route NetworkFirst vorhanden; geänderte `config.js` im Container erreicht eine offene PWA beim nächsten Start ohne neuen Build; Offline-Start mit gefülltem Cache funktioniert
- Backend startet ohne `DB_PASSWORD` nicht, mit klarer Meldung; `docker compose config` ohne Variable bricht mit Meldung ab
- Zwei-Tab-Szenario mit fehlendem Chunk: Tab B lädt bei der Navigation neu, genau einmal
- `uv run pytest` und `pytest -m db` (Wegwerf-Container PG 16) grün, ohne die Warnungen zu `distinct` und `path_separator`; Test `_process_image` grün
- Bericht nennt den Prüfpunkt `DB_PASSWORD` für die Server-`.env`
- Verifikation gemäß Projekt-CLAUDE.md (Frontend und Backend, mit Container)
