# Auftrag W.12: AI-Import robust, Modell als Admin-Einstellung

> Erstellt 2026-11-15 vom Master · Roadmap: `ROADMAP.md` Punkt W.12 · Basis: `main@c94bb2c` · Aufwand: M–L · Modell: Sonnet

## Ziel
Text-, URL- und Foto-Import funktionieren und melden jeden Fehler verständlich in der Oberfläche, statt still zu scheitern oder ein generisches 500 zu liefern. Das Modell wählt der Admin zentral, das Backend entscheidet; der Client schickt kein Modell mehr. Ob die Antwort künftig per Structured Outputs statt YAML kommt, entscheide ich am Checkpoint. Kamera und Bildverkleinerung sind nicht Teil (W.13).

## Erst lesen
1. `docs/plans/zuverlaessigkeit-login-ai-import.md` – Abschnitt „W.12 AI-Import robust“: Befunde A1–A8, „Entschieden (2026-11-14): Modell, Key, Endpunkt“, „Entscheidung im Auftrag: Structured Outputs statt YAML“
2. `backend/app/routes/ai.py`, `backend/prompts/system_prompt.md`
3. `frontend/src/components/features/AIRecipeImport.vue`, `frontend/src/api/ai.ts`, `frontend/src/api/client.ts` (Timeout, `isClientError`, 401-Retry)
4. `backend/app/routes/admin.py` (`site_settings`), `frontend/src/views/Administration.vue` (Abschnitt Einstellungen)
5. `frontend/.docker/nginx/prod.conf`
6. `.claude/rules/frontend.md`, `.claude/rules/backend-tooling.md`

## Auftrag
1. **A8 Foto-Upload zuerst:** In `AIRecipeImport.vue` per `watch` auf `uploadedFile` reagieren statt per `@change` auf `event.target`. Eigener Commit.
2. **Erkundung Structured Outputs** (Checkpoint 1): Prüfen anhand der OpenAI-Doku und eines echten Aufrufs je Weg:
   - Funktionieren Structured Outputs (JSON-Schema) zusammen mit der Websuche in der Responses API und mit Bildeingabe?
   - Mit welchen aktuellen Modellen (A6: `gpt-4o`, `gpt-4o-mini` und `web_search_preview` gegen die aktuelle Doku prüfen)?
   - Lässt sich das Rezeptschema aus `system_prompt.md` als JSON-Schema abbilden (Pflichtfelder, Zahlen statt Strings bei `yields.value`/`amounts`)?
   - Vorlage an mich: Empfehlung (Structured Outputs vs. YAML mit robustem Parsing), Modellvorschlag als Default, Aufwandsdifferenz. Danach anhalten.
3. **Modell als Admin-Einstellung** (A7):
   - `site_settings` um das Modell erweitern (Text/URL und Foto getrennt, falls die Erkundung unterschiedliche Modelle nahelegt). Default aus der Erkundung.
   - Beim Speichern prüft das Backend, ob das Modell mit dem Key verfügbar ist (z. B. `models.retrieve`), sonst 422 mit Meldung.
   - Admin-Seite: Modellwahl, Anzeige „OpenAI-Key konfiguriert: ja/nein“, Button „Verbindung testen“. Der Key selbst wird nie ausgegeben.
   - AI-Routen lesen das Modell aus `site_settings`; `model` aus Request-Body und Query entfernen.
   - Persönliche Einstellung `gpt_model` entfernen: `types/settings.ts`, `recipeStore.ts`, `ProfileView.vue`, `Settings.vue`, `routes/me.py`. Vorhandene Werte in `app_users.settings` dürfen liegen bleiben (keine Migration).
4. **Antwortformat** nach meiner Entscheidung am Checkpoint:
   - Structured Outputs: Backend validiert gegen das Schema und liefert ein Rezeptobjekt; Frontend ohne YAML-Regex.
   - YAML bleibt: Parsing im Frontend (`js-yaml`) robust machen (A4: `YAML`/`yml`, `\r\n`, Text davor/danach, kein Codeblock) und Parse-Fehler mit Rohtext anzeigen. Kein PyYAML im Backend (mit W.18 entfernt).
5. **Fehlerbehandlung** (A2, A3):
   - `api/ai.ts` über `api/client.ts` führen (401-Retry, Fehlerklassen), mit eigenem Timeout passend zu nginx (A1), nicht dem Default von 15 s.
   - Backend: OpenAI-Fehler abfangen und abbilden: Rate-Limit → 429, Timeout/Verbindung → 504/502, ungültiges Modell oder Key → 503 mit klarer deutscher Meldung; Details nur ins Log.
   - Frontend zeigt jede Fehlermeldung im Import-Dialog; kein Fehler nur in der Konsole.
6. **Grenzen** (A1, A5):
   - `proxy_read_timeout` für `/api/v1/ai/` in `prod.conf` auf einen begründeten Wert (Websuche kann > 60 s dauern), Backend-Timeout des OpenAI-Clients darunter.
   - Upload-Grenze für Fotos einheitlich: nginx `client_max_body_size` und Backend-Limit gleich, Meldung bei Überschreitung verständlich (413 im Frontend abfangen).
7. Prettier-Warnung in `AIRecipeImport.vue` beheben.

## Ablage
- Backend: `routes/ai.py` (Fehlerabbildung, Modell aus Settings), `routes/admin.py` (Settings-Felder, Verbindungstest), ggf. Hilfsmodul `app/services/openai_client.py`, falls `ai.py` und `admin.py` denselben Client brauchen
- Frontend: `AIRecipeImport.vue`, `api/ai.ts`, `api/admin.ts`, `Administration.vue`; Entfernen von `gpt_model` an den genannten Stellen
- `frontend/.docker/nginx/prod.conf`
- `AIRecipeImport.vue` ist groß; neue Parsing-/Fehlerlogik in `src/js/` oder `src/api/`, nicht in die Komponente

## Nicht in diesem Auftrag
- Kamera über native Auswahl, Bildverkleinerung im Client (W.13)
- API-Key in der DB, konfigurierbarer Endpunkt (bewusst nicht, siehe Plan)
- Login-Race in `get_or_create_user` (W.3)
- Tests mit Vitest (W.10); Backend-Smoke-Tests für geänderte Routen gehören dazu

## Entscheidungen, die ich treffe
- Structured Outputs oder YAML (Checkpoint 1)
- Default-Modell(e)

## Fallstricke
- `system_prompt.md` liegt im Betrieb im Volume `recipe_prompts` und wird beim Deploy **nicht** überschrieben. Ändert sich der Prompt (z. B. für Structured Outputs), im Bericht genau angeben, was ich auf dem Server nachziehe.
- `api/client.ts` bricht nach 15 s ab; ein URL-Import mit Websuche dauert länger. Timeout für AI-Aufrufe explizit setzen.
- `PUT /v1/admin/settings` speichert `body.model_dump()` vollständig: Neue Felder mit Default überschreiben gespeicherte Werte, wenn das Frontend sie nicht mitschickt. Admin-Formular muss alle Felder senden, oder das Backend nutzt `exclude_unset`.
- Der äußere Reverse-Proxy auf dem Server hat eigene Timeouts und Body-Grenzen (unbekannt). Im Bericht die nötigen Werte nennen, damit ich sie dort prüfe.
- Echte OpenAI-Aufrufe kosten Geld: Erkundung und Verifikation mit wenigen Aufrufen, kleine Testbilder.
- Lokaler Stack: `docker-compose.yml` und `.env` liegen im Hauptcheckout, nicht im Worktree. `.env` nicht lesen; für Container-Tests ein eigenes Compose im Scratchpad wie in W.4/W.20 oder mich bitten, den Stack zu starten.

## Checkpoints
- Nach Schritt 2 (Erkundung Structured Outputs und Modelle): Vorlage, dann anhalten.

## Abnahme
- Foto-, Text- und URL-Import liefern je ein Rezept (lokal, echter Key); Dauer je Weg im Bericht
- Erzwungene Fehler zeigen eine verständliche Meldung im Dialog: kein Key, ungültiges Modell, Bild zu groß, Netzfehler/Timeout, unparsbare Antwort
- Kein `model` mehr in Request/Query; `gpt_model` nicht mehr in Frontend und `me.py` (`grep`)
- Admin: Modell speichern mit Verfügbarkeitsprüfung, Key-Status und Verbindungstest funktionieren; Key erscheint in keiner Antwort
- Smoke-Tests für die geänderten Routen (Rolle, fehlender Key → 503) grün
- Verifikation gemäß Projekt-CLAUDE.md (Frontend und Backend, mit Container)

## Nacharbeit (2026-11-15, nach Prüfung)

Ausgangsstand: `fd632ab`.

- **N1 Unparsbare Antwort → 500:** openai 3 validiert das Schema schon in `client.responses.parse(...)` (Post-Parser, `model_validate_json`). Die pydantic-`ValidationError` ist kein `OpenAIError` und landet im globalen Handler. `ValidationError` um den `parse`-Aufruf abfangen und als 502 mit verständlicher Meldung („Antwort unvollständig oder ungültig, bitte erneut versuchen“) melden; Antwortstatus `incomplete` (z. B. `max_output_tokens`) ebenso. Test dafür.
- **N2 Dateifeld zurücksetzen:** Beim Reset nach „Rezept importieren“ auch `uploadedFile` auf `null` setzen, damit dieselbe Datei erneut gewählt werden kann (Vorschau erscheint).
- **N3 Log ohne Key-Fragment:** Bei Auth- und Permission-Fehlern von OpenAI nur Fehlertyp und Status loggen, nicht `str(exc)` (enthält den maskierten Key).
- **N4 README:** veraltete Aussagen korrigieren („Chat Completions + Vision“ → Responses API mit Structured Outputs; Prompt nicht mehr extern änderbar, liegt im Image).
- **N5 main einmergen:** `git merge main` im Worktree. Konflikt in `CLAUDE.md` (Abschnitt Konventionen): beide Änderungen behalten, also die Prompt-Zeile aus W.12 **und** die Commit-Bereiche mit `ci` aus `main`. Danach volle Verifikation auf dem Merge-Stand, einschließlich DB-Tests gegen einen Wegwerf-Container PostgreSQL 16 (siehe `.claude/rules/backend-tooling.md`).

### Abnahme Nacharbeit
- Test: `ValidationError` und Status `incomplete` → 502 mit Meldung, kein 500
- Verifikation gemäß Projekt-CLAUDE.md (Frontend und Backend) auf dem Merge-Stand, DB-Tests grün
- Bericht um Abschnitt „Nacharbeit“ fortschreiben
