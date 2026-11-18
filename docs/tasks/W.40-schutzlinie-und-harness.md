# Auftrag W.40: Backend-Schutz gegen leeres `data`, Kleinkram nach W.38, Screenshot-Harness

> Erstellt 2026-11-18 vom Master · Roadmap: `ROADMAP.md` Punkte W.40, W.41, W.42 · Basis: `main@63b5ee9` · Aufwand: M · Modell: Opus

## Ziel
Der Server lehnt ab, wenn ein PUT einem Rezept mit Inhalt sowohl Zutaten als auch Schritte nimmt. Damit können alte, noch installierte PWA-Stände den Datenverlust aus W.37 nicht mehr auslösen. Die Restlücken aus der Prüfung von W.38 sind geschlossen. Screenshots für Berichte entstehen mit einem wiederholbaren Harness im Repo, statt jedes Mal neu gebaut zu werden. Die Wiederherstellung beschädigter Rezepte gehört nicht dazu (W.39).

## Erst lesen
1. `docs/tasks/W.38.bericht.md`: „Offen und Folgepunkte“, „Sichtprüfung“ (Mock-Server, Seed)
2. `.claude/rules/backend-db.md`, `.claude/rules/frontend.md` (Speichern, Vormerkung)
3. Backend: `routes/recipes.py` `update_recipe`, `schemas/recipe.py` (`RecipeUpdate`, `RecipeData`, `normalize_recipe_data`), `tests/db/test_api.py`
4. Frontend: `views/Edit.vue` (`saveRecipe`, Toast bei `local`), `store/saveRecipe.ts` (`stillRejected`), `js/appendFeedback.ts` (`saveFailedMessage`, `rejectReason`), `store/pendingCreates.ts` (`markDeleted`, `deleteOnServer`, `finishDeletion`, `isForeign`), `api/`-Modul für `GET /recipes/{id}`

## Auftrag

### W.40 Backend-Sperre gegen leeres `data`
1. `update_recipe` antwortet mit **422** und einem verständlichen `detail` („Zutaten und Schritte würden geleert …“), wenn diese Bedingungen alle zutreffen:
   - `body.data` ist gesetzt,
   - das gespeicherte Rezept hat Zutaten oder Schritte,
   - die neue Fassung hat weder Zutaten noch Schritte.

   PUT bleibt ein Ersetzen, es gibt keinen Merge. Ein PUT mit nur `tags` oder `recipe_name` bleibt unberührt.
2. Geprüft wird vor jeder Änderung am Objekt, also auch vor `_auto_download_imageurl` und `_sync_tags`. Bei 422 bleiben Rezept, Tags und `updated_at` unverändert.
3. Die Antwort in die OpenAPI unter `responses` eintragen.
4. DB-Tests in `tests/db/test_api.py`:
   - Ablehnung mit 422; Daten, Tags und `updated_at` bleiben unverändert
   - Ein Rezept, das schon leer war, darf leer bleiben.
   - Nur Zutaten zu leeren, nur Schritte zu leeren und ein PUT nur mit `tags` sind erlaubt.
   - Ein PUT im Stil der alten Listenzeile wird abgelehnt: `data` ohne Zutaten und Schritte, dazu `tags`.
5. Die Regel in `.claude/rules/backend-db.md` nachtragen.

### W.41 Frontend-Kleinkram nach W.38
1. **Fremd abgelehntes Rezept:** `Edit.vue` meldet nach dem Speichern eines fremd abgelehnten Rezepts (`stillRejected`) nicht „wird übertragen“. Es meldet, dass das Rezept nur auf diesem Gerät bleibt und abgelehnt ist. Test.
2. **`saveFailedMessage`:** Kennt `IncompleteRecipeError` mit eigenem Text. Die neue 422 aus W.40 erscheint mit verständlichem Grund (`detail` bzw. eigener Text). Test.
3. **Fremde UUID ohne Markierung:** Bevor ein vorgemerktes, nie bestätigtes Rezept per DELETE gelöscht wird, prüft ein `GET /recipes/{id}` den Ersteller:
   - 404: Eintrag entfernen, kein DELETE
   - `created_by` ist der eigene `sub`: DELETE
   - fremder Ersteller: Eintrag entfernen und als fremd behandeln, nie DELETE
   - Ausfall: Markierung bleibt.

   Tests, darunter einer als Admin.

### W.42 Screenshot-Harness
1. Neue devDependency `playwright-core` (freigegeben). Die aktuelle stabile Version beim Einbau prüfen (`npm view playwright-core version`; am 2026-11-18 war es 1.65.1, Lizenz Apache-2.0). Es wird kein Browser heruntergeladen. Genutzt wird ein installierter Browser per `channel` (`msedge`, sonst `chrome`), ein Pfad lässt sich per Umgebungsvariable überschreiben.
2. Ablage in `frontend/scripts/shots/`:
   - **Mock-API:** konfigurierbare Antworten je Endpunkt, mindestens Detail-GET 503, POST 503/403/409.
   - **Seed:** Sitzung, Rezeptliste, Vormerkung (localStorage und IndexedDB).
   - **Szenario-Datei:** Route, Seed, Antworten, Gerät.
   - **Runner:** liefert den Production-Build (`dist/`) statisch aus und fotografiert die Szenarien.
3. Geräte: iPhone 390 × 844 in hell und dunkel, dazu optional ein Desktop-Format. Die Ausgabe landet in einem Ordner, der als Argument übergeben wird, Vorgabe `docs/plans/<thema>/`.
4. Aufruf per npm-Skript, z. B. `npm run shots -- <szenario> <ausgabeordner>`. Drei Beispielszenarien gehören dazu, die die Screenshots aus W.38 nachstellen.
5. Kurzanleitung als Rule `.claude/rules/screenshots.md` mit `paths:` auf `frontend/scripts/shots/**`; in `frontend.md` ein Verweis darauf.
6. Der Harness ist in Lint und Typecheck eingebunden oder ausdrücklich ausgeschlossen (begründen). Er läuft nicht in CI und gelangt nicht in den Build.

## Ablage
- **Backend:** `routes/recipes.py` (eine kleine Prüffunktion, gern in `schemas/recipe.py` neben `normalize_recipe_data`), `tests/db/test_api.py`
- **Frontend:**
  - `views/Edit.vue`, `js/appendFeedback.ts`
  - der Ersteller-Abgleich: `pendingCreates.ts` steht bei 547 Zeilen; die Prüfung wenn möglich als kleine Funktion außerhalb (z. B. `store/listSync.ts` oder ein neues Modul), dort nur der Aufruf
  - Specs daneben
- **Neu:** `frontend/scripts/shots/`, `.claude/rules/screenshots.md`
- **Geändert:** `frontend/package.json`, `package-lock.json`, `.claude/rules/backend-db.md`, `.claude/rules/frontend.md`

## Nicht in diesem Auftrag
- Wiederherstellung beschädigter Rezepte (W.39)
- Teil-Update bzw. Merge von `data`, weitere Plausibilitätsprüfungen im Backend
- Screenshot-Tests als Regressionstests in CI, Pixelvergleich
- U.15, 12.1

## Entscheidungen, die ich treffe
- keine (422-Sperre statt Merge und die Abhängigkeit `playwright-core` sind entschieden)

## Fallstricke
- **Alte Clients:** Ein PWA-Stand von vor W.37 verschluckt die 422 und schreibt die leere Fassung trotzdem in seinen lokalen Cache. Der Server bleibt heil, das alte Gerät zeigt das Rezept bis zum Update leer. Das ist hinnehmbar; im Bericht als Hinweis für die Sichtprüfung nennen.
- **`RecipeData` füllt Standardwerte:** `ensure_sections` legt Abschnitte an, Zutaten und Schritte haben `[]` als Default. Für die Bedingung zählen nur `ingredients` und `steps`, nicht `sections`.
- **Rezepte, die schon beschädigt sind** (leer seit dem Tag-Fehler), sind „schon leer“ und bleiben bearbeitbar. Ein Nutzer kann sie wieder füllen.
- **Ersteller-Abgleich, verlorene Antwort:** Ein POST kann den Server erreicht haben, obwohl seine Antwort verloren ging. Das Rezept ist dann eigen und muss per DELETE gelöscht werden, deshalb ist die GET-Prüfung nötig, statt das DELETE wegzulassen. Für den eigenen `sub` die vorhandene Logik von `createWithClientId` wiederverwenden, nicht duplizieren.
- **Harness unter Windows:** Den Build aus einem Pfad mit großem `C:` erzeugen, sonst lädt die App Pinia doppelt (Rule `frontend.md`).
- **Kein Browser-Download:** Kein `npx playwright install`, kein `playwright`-Vollpaket.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- W.40: 422 laut den DB-Tests; Daten, Tags und `updated_at` bleiben bei Ablehnung unverändert; Rule nachgetragen
- W.41: Meldungen und Ersteller-Abgleich mit Tests, Admin-Fall eingeschlossen
- W.42: `npm run shots` erzeugt die drei Beispielbilder in hell und dunkel; Pfade und Aufruf im Bericht; Version von `playwright-core` belegt
- Verifikation gemäß Projekt-CLAUDE.md: Frontend vollständig, Backend inkl. DB-Tests gegen `postgres:16-alpine`
