# Bericht W.12: AI-Import robust, Modell als Admin-Einstellung

> Branch `worktree-W.12-ai-import-robust` · Basis `14247dc` (Auftrag: `c94bb2c`, dazwischen nur `docs(roadmap)`) · Stand `e9b9c26` · 2026-11-15 · Dauer: 00:13 – 00:48 (35 min, davon Warten an Checkpoints ca. 16 min, Zeiten geschätzt, Halt nicht einzeln mit `date` erfasst) · Status: fertig (UI-Pfad nicht im Browser geprüft)

## Ergebnis
Text-, URL- und Foto-Import liefern per Structured Outputs (Responses API, `AIRecipe`-Schema) ein validiertes Rezeptobjekt, auch die Websuche und die Bildeingabe zusammen mit dem Schema. Das Modell wählt der Admin in der Administration (Text/URL und Foto getrennt, Verfügbarkeitsprüfung beim Speichern, Key-Status, Verbindungstest); der Client schickt kein Modell mehr. Jeder Fehler (kein Key, ungültiges Modell oder Key, Rate-Limit, Timeout, Netz, Bild zu groß, unauswertbare Antwort) erscheint als deutsche Meldung im Import-Dialog.

## Commits
- `32bd76d` fix(frontend): Foto-Upload per watch auf v-model statt @change (A8, Prettier-Warnung)
- `3debf9f` feat(ai): Modell als Admin-Einstellung, Structured Outputs, Fehlerabbildung
- `94fc05a` feat(frontend): AI-Import über API-Client mit verständlichen Fehlern
- `e9b9c26` docs(ai): Regeln zum AI-Import ablegen (`.claude/rules/ai-import.md`)

## Verifikation
- Erkundung (Checkpoint 1), echte Aufrufe mit `gpt-6-luna`: Text, Bild, URL mit `web_search` und URL mit `web_search_preview`, jeweils mit strict Schema → alle liefern gültiges JSON (4–11 s).
- Echte Abnahme der Backend-Funktionen (`verify.py`, direkt gegen `_extract_recipe`, ohne DB), `gpt-6-luna`:
  - Text 6,6 s: „Pfannkuchen“, 4 Zutaten, 2 Schritte, yields 4,0
  - URL 10,3 s: 6 Zutaten, 6 Schritte, yields 4,0
  - Foto 5,4 s (400×200-PNG): 4 Zutaten, 2 Schritte, yields 2,0
  - ungültiges Modell → 503 „Modell … nicht verfügbar“ (0,3 s)
  - `models.retrieve`: `gpt-6-luna` verfügbar; `gibt-es-nicht` → 422
  - ungültiger Key → 503 „Zugang abgelehnt“ (0,3 s)
  - erzwungener Timeout → 504 (0,1 s)
- Backend `uv sync` (x86_64-Python) + `ruff check` + `ruff format --check` + `pytest` → grün, 95 Tests (24 neu in `tests/test_ai.py`); ~5 s.
- Frontend `npm run lint:check && npm run typecheck && npm run build` → grün; ~80 s (davon fast alles `lint:check`/`typecheck`).
- Container (Scratch-Compose, eigener Stack auf Port 18080): `docker compose build` + `up`, alle Migrationen 001–006 im Log durchgelaufen, `GET /api/health` → `{"status":"ok","database":"connected"}`. Über nginx: `/api/v1/ai/import` und `/import/image` ohne Token → 401 (Pfad bleibt erhalten), 9-MB-Upload → 401 (kommt am Backend an), 11-MB-Upload → 413 von nginx. `nginx -T` zeigt `proxy_read_timeout 150s` und 10M für `/api/v1/ai/`.
- `grep gpt_model` in `frontend/src` und `backend/app`: nur der Kommentar in `schemas/user.py`. `model` in Request-Body und Query entfernt; Test bestätigt, dass ein Modell im Body ignoriert wird.
- Sichtprüfung: keine. Dialog (Fehlermeldungen im UI, Foto-Vorschau nach A8-Fix) und Admin-Seite nicht im Browser gesehen; Login und Key für den Browser-Pfad lagen mir nicht vor. Die Fehlertexte sind im Backend per Test und im Frontend nur per `typecheck` abgesichert.
- Prüfzeit: ~2 min; größter Posten: `lint:check`/`typecheck`.
- Prüfskripte: nur Scratchpad (`probe.py`, `verify.py`, `stack/compose.yml` unter `C:/Users/ce/AppData/Local/Temp/claude/beb48852c7fd70f3/3806b96a-6489-443d-830c-89a36a002031/scratchpad/`).

## Struktur und Doku
- Neue Module: `app/services/openai_client.py` (Client, Key, Fehlerabbildung), `app/services/site_settings.py` (aus `admin.py` herausgelöst, `ai.py` und `admin.py` brauchen dasselbe), `app/schemas/ai.py`. `Administration.vue` ist weiter gewachsen (AI-Abschnitt, jetzt 669 Zeilen); Auslagern in eine Komponente wäre ein Folgepunkt.
- `shares.py` liest `max_share_days` weiter mit eigener Abfrage (`_get_max_share_days`): bewusste Doppelung, liegt außerhalb des Scopes.
- Berührte Aussagen: CLAUDE.md stimmt noch (Prompt-Pfad und Volume unverändert). Neu: `.claude/rules/ai-import.md` (Zeitbudget, Bildgrenze, Prompt im Volume, Modell-Hinweise).

## Abweichungen vom Auftrag
- Auf deine Anweisung nach dem Bericht: Der Prompt liegt jetzt nur noch im Image (`backend/prompts/system_prompt.md`, Pfad relativ zum Code), das Volume `recipe_prompts` und die Einstellung `prompt_dir` sind entfernt. Fehlt die Datei, startet das Backend nicht (vorher stiller Ersatz-Prompt). Geprüft: Im Scratch-Container lädt der Prompt aus dem Image (2840 Zeichen), 95 Tests grün. Angepasst: `docker-compose.yml.example`, `README.md`, `CLAUDE.md`, `.claude/rules/ai-import.md`.
- Das Schema lässt `recipe_uuid`, `lastUpdated` und `haccp` weg: strict verlangt feste Objekte, HACCP-Freitext ist nicht abbildbar, UUID und Zeitstempel setzt `initRecipe`. Der Prompt ist entsprechend gekürzt.
- `UserSettings` ignoriert jetzt unbekannte Felder (`extra: ignore` statt `forbid`). Sonst bekäme jeder PWA-Client mit altem Bundle beim Speichern der Einstellungen ein 422, weil er noch `gpt_model` schickt.
- `web_search_preview` durch `web_search` ersetzt (laut Doku Legacy). Beide funktionierten im Test.
- Expertenmodus zeigt statt „Raw YAML“ nun die Rohantwort als JSON.
- Die Modell-IDs (`gpt-6-luna` u. a.) stammen aus der OpenAI-Doku via WebFetch, nicht aus meinem Vorwissen; der Default war deine Entscheidung.

## Nachgetragen in Specs/Plänen
- nichts (`docs/plans/zuverlaessigkeit-login-ai-import.md` unverändert; A1–A8 sind erledigt, Roadmap-Pflege liegt beim Master).

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Server-Aktionen (du):**
  1. **Volume `recipe_prompts` entfernen:** In deiner `docker-compose.yml` die Zeile `- recipe_prompts:/app/prompts` und den Eintrag unter `volumes:` streichen (Vorlage `docker-compose.yml.example` ist angepasst). Sonst überdeckt das Volume den neuen Prompt im Image. Danach deployen; das alte Volume kann mit `docker volume rm <projekt>_recipe_prompts` weg.
  2. Äußerer Reverse-Proxy: `proxy_read_timeout`/Send-Timeout ≥ 150 s und Body-Grenze ≥ 10 MB für `/api/v1/ai/`; die Werte dort sind unbekannt.
  3. Nach dem Deploy in der Administration „Verbindung testen“ ausführen und die Modelle prüfen.
- Folgepunkt: Modell-IDs `gpt-4o`/`gpt-4o-mini` sind für 2027-01-14 als deprecated gelistet; der Default ist bereits `gpt-6-luna`, in gespeicherten Einstellungen steht (noch) kein altes Modell, weil `ai_model_*` neu ist.
- Folgepunkt (klein, S): `Administration.vue` aufteilen (AI-Einstellungen als eigene Komponente).
- W.10: Vitest für `aiErrorMessage` und `api/ai.ts` (Mengen, 413-Vorabprüfung).
- W.13 bleibt: Bildverkleinerung im Client würde die 10-MB-Grenze meist unnötig machen.
- Lokal (Windows ARM64): `uv sync` braucht `--python cpython-3.14-windows-x86_64-none`, steht schon in `.claude/rules/backend-tooling.md`.

## Status je Roadmap-Punkt
- `W.12` fertig (Sichtprüfung im Browser steht aus)

## Vorschlag Roadmap-Zeilen
`- [x] W.12 AI-Import robust, Modell als Admin-Einstellung · 2026-11-15 · e9b9c26`

## Nacharbeit

> Ausgangsstand `fd632ab` · Stand Merge `c96e346` (Bericht-Commit folgt) · 2026-11-15 · Dauer: 01:20 – 01:28 (8 min, kein Warten) · Status: fertig

### Commits
- `949bbfb` fix(ai): ungültige oder unvollständige AI-Antwort als 502 melden (N1)
- `0599072` fix(frontend): Dateifeld nach Import zurücksetzen (N2)
- `f769b84` fix(ai): Auth-Fehler ohne Key-Fragment loggen (N3)
- `e9d2689` docs(ai): README zu Responses API, Modellwahl und Prompt im Image (N4)
- `c96e346` Merge branch 'main' into worktree-W.12-ai-import-robust (N5)

### Umsetzung
- **N1:** Die `ValidationError` aus `responses.parse()` wird um den Aufruf abgefangen, ebenso `status != "completed"` und leere Antwort: 502 „Die AI-Antwort war unvollständig oder ungültig. Bitte erneut versuchen.“ Drei Testfälle (leer, `ValidationError`, `incomplete`); gegen den alten Code laufen alle drei rot (500 bzw. 200), gegen den neuen grün.
- **N2:** `uploadedFile` wird beim Reset nach „Rezept importieren“ auf `null` gesetzt.
- **N3:** Bei `AuthenticationError`/`PermissionDeniedError` nur Typ und Status im Log. Der zugehörige Test (Fragment `abcd` weder im Log noch in der Antwort) liegt aus Versehen im Commit von N1, weil beide in `tests/test_ai.py` stehen.
- **N4:** README: „Responses API, Structured Outputs, Websuche“, Prompt „liegt im Image“, kurzer Absatz zur Modellwahl.
- **N5:** `git merge main`, Konflikt nur in `CLAUDE.md` (Konventionen). Beide Seiten behalten: Prompt-Zeile aus W.12 (Image, kein Volume) und Commit-Bereiche mit `ci` aus `main`. `README.md` und `backend/app/config.py` ließen sich ohne Konflikt zusammenführen.

### Verifikation (Merge-Stand `c96e346`)
- Backend: `uv sync --frozen` (x86_64-Python) + `ruff check` + `ruff format --check` + `pytest -m "not db"` → grün, 116 Tests, ~7 s.
- DB-Tests: Wegwerf-Container `postgres:16-alpine` (Port 55432, danach entfernt), `DB_HOST=localhost DB_NAME=test_cookbook … uv run pytest -m db` → 5 passed (Warnung `distinct`-DISTINCT-ON in `recipes.py`, nicht aus W.12).
- Frontend: `npm ci` + `lint:check` + `typecheck` + `build` → grün, ~106 s inkl. `npm ci`.
- Container (Scratch-Compose): Backend, Frontend und DB gebaut und gestartet, Migrationen bis `006_add_pending_role` im Log, `GET /api/health` → `{"status":"ok","database":"connected"}`, `POST /api/v1/ai/import` ohne Token → 401.
- Sichtprüfung: keine (Dateifeld-Reset N2 nur per `typecheck`/Lint abgesichert, nicht im Browser).
- Roadmap nicht geändert.
