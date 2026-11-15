# Auftrag W.28: Vorlage des Foto-Imports am Rezept speichern (+ Kleinkram W.30)

> Erstellt 2026-11-15 vom Master · Roadmap: `ROADMAP.md` Punkte W.28, W.30 · Basis: `main@866e649` · Aufwand: M · Modell: Opus

## Ziel
Die Seiten eines Foto-Imports werden als Vorlage (`kind = source`) am neuen Rezept gespeichert und in Detailansicht und Bearbeitung angezeigt, damit man das KI-Ergebnis jederzeit mit dem Original vergleichen kann. Nach dem Import öffnet die App direkt die Bearbeitung. Titelbild und Rezeptfoto bleiben davon unberührt. Dazu drei kleine Aufräumpunkte (W.30).

## Erst lesen
1. `docs/plans/zuverlaessigkeit-login-ai-import.md` – Abschnitt „W.28 Vorlage am Rezept speichern“ (Entscheidungen 2026-11-15)
2. `docs/tasks/W.13.bericht.md` und `.claude/rules/ai-import.md` (Seitenliste, `useImportPages`, Blobs)
3. Backend: `app/models/image.py`, `app/routes/images.py` (Upload, Liste, `download_and_store_image`, `_process_image`, Admin-Aufräumen), `app/routes/recipes.py` (`_get_first_image_id`, Listenabfrage mit `distinct_on`), `alembic/versions/006_*.py`
4. Frontend: `api/images.ts`, `store/recipeStore.ts` (`appendRecipe`, `setRecipePicture`), `components/features/AIRecipeImport.vue`, `composables/useImportPages.ts`, `views/HomeView.vue` (`onAIImport`), `views/Recipe.vue`, `views/Edit.vue`, `components/recipe/display/RecipeDisplay.vue`
5. `.claude/rules/backend-db.md`, `backend-tooling.md` (DB-Tests), `docs/DEVELOPMENT-GUIDELINES.md` (Tests)

## Auftrag

### W.28 Vorlage am Rezept
1. **Migration 007:** `recipe_images.kind` (Text, `NOT NULL`, Server-Default `photo`, Check-Constraint `photo`/`source`), bestehende Zeilen werden `photo`. Downgrade entfernt Spalte und Constraint. Index prüfen (`idx_images_recipe` um `kind` erweitern, wenn die Abfragen davon profitieren; begründen).
2. **Backend:**
   - Upload nimmt `kind` (Default `photo`); `sort_order` wird je `kind` fortgezählt. Die Liste liefert `kind` und lässt sich nach `kind` filtern.
   - Titelbild (`_get_first_image_id`, Listenabfrage) und `download_and_store_image` berücksichtigen nur `photo`.
   - Admin-Aufräumen und Löschen behandeln `source` wie jedes andere Bild (Dateien mit entfernen).
   - `_process_image`: `ImageOps.exif_transpose` vor dem Verkleinern (Hochformatfotos); Test mit EXIF-Ausrichtung.
   - DB-Tests: Titelbild ignoriert `source`, auch wenn eine Vorlage zuerst hochgeladen wurde; Upload mit `kind=source`; Liste mit Filter.
3. **Frontend, Import:**
   - Nach „Rezept importieren“ (Foto-Weg): Rezept anlegen, die 2000-px-Blobs als `source` in Seitenreihenfolge hochladen, dann zur Bearbeitung des neuen Rezepts navigieren. Text- und URL-Import navigieren ebenfalls in die Bearbeitung, ohne Upload.
   - Blobs vor `clearPages()` übernehmen (der Hinweis im Plan); Upload-Fehler einzelner Seiten melden, Rezept bleibt erhalten.
   - Kleinigkeiten aus der Prüfung von W.13: Hinweise der Seitenauswahl nach dem Import zurücksetzen; Fortschritt „k von N“ statt „0 von N“; Begründung in `useImportPages.ts` und `ai-import.md` richtigstellen (der Zustand überlebt den Routenwechsel, `BModal` baut den Inhalt beim Schließen nicht ab).
4. **Frontend, Anzeige:** Abschnitt „Vorlage“ (aufklappbar, standardmäßig zu) mit Vorschaubildern in Reihenfolge; antippen öffnet das Bild groß (vorhandene Bild-URL, kein neuer Viewer, falls ein einfacher reicht). In Detailansicht und Bearbeitung; nur sichtbar, wenn Vorlagen existieren. Vorlagen sind in der Bearbeitung nicht löschbar (kommt bei Bedarf später).
5. **`setRecipePicture`** löscht und ersetzt nur `photo`-Bilder; `first_image_id` bleibt ein `photo`.
6. **Tests (Vitest):** `aiErrorMessage`, `api/ai.ts` (Grenzen, 413-Vorabprüfung), `imageResize.computeTargetSize`, `useImportPages` (Zustand vor jedem Test zurücksetzen), Import-Ablauf mit Upload und Navigation (Store/API gemockt).

### W.30 Kleinkram
1. `formatDate` aus `components/admin/format.ts`, `ShareManager.vue`, `SharedRecipe.vue` nach `src/js/` zusammenführen (gleiches Ausgabeformat je Stelle beibehalten oder Unterschiede im Bericht nennen).
2. `db_password` in `config.py` mit `min_length=1`.
3. `tests/test_database_url.py` ohne Import aus `tests/db/conftest.py`.

## Ablage
- Neu: `backend/alembic/versions/007_*.py`, Anzeige-Komponente für die Vorlage unter `components/recipe/` (eine Komponente für Detail und Bearbeitung), `src/js/formatDate.ts` (oder passender Name), Specs
- Geändert: `routes/images.py`, `routes/recipes.py`, `models/image.py`, `schemas` (falls Bildschema), `api/images.ts`, `recipeStore.ts`, `AIRecipeImport.vue`, `HomeView.vue`, `Recipe.vue`/`RecipeDisplay.vue`, `Edit.vue` (nur Einbindung), `useImportPages.ts`, `.claude/rules/ai-import.md`, `config.py`, Tests

## Nicht in diesem Auftrag
- Vorlagen löschen oder neu sortieren, Vorlage nachträglich zu bestehenden Rezepten hinzufügen
- Galerie für mehrere Rezeptfotos
- Export/Import als ZIP (11.1/11.2)
- Vorlagen in geteilten Rezepten (`SharedRecipe.vue`): nicht anzeigen, siehe Entscheidung

## Entscheidungen, die ich treffe
- Am Checkpoint: Migration (Schema, Default, Index) und ob Vorlagen in geteilten Rezepten (Share-Links) sichtbar sein sollen. Vorschlag des Masters: nicht sichtbar (fremde Inhalte, Urheberrecht).

## Fallstricke
- **Rezept-ID:** Das Backend vergibt die ID beim Anlegen (`recipeApi.create`); `appendRecipe` lädt danach die Liste neu. Für Upload und Navigation braucht der Import die neue ID: `appendRecipe` muss sie zurückgeben. Fällt `appendRecipe` offline auf lokale Speicherung zurück, keinen Upload versuchen und das melden.
- **Bild-Cache:** `/api/v1/images/…` wird im SW CacheFirst gecacht (UUID-basiert, unveränderlich); neue Bilder bekommen neue UUIDs, also kein Problem. Nicht auf Änderungen bestehender Bild-URLs bauen.
- **Titelbild-Abfrage** nutzt `distinct_on` mit `ORDER BY recipe_id, sort_order` (W.26). Der Filter auf `kind = 'photo'` gehört in das `WHERE`, nicht hinter `DISTINCT ON`.
- **`sort_order`** ist heute je Rezept fortlaufend; eine Vorlage darf die Reihenfolge der Fotos nicht verschieben.
- **Migration** läuft beim Start im `lifespan`; DB-Tests prüfen up/down/up. Check-Constraint-Namen folgen der Namenskonvention (siehe `backend-db.md`, doppeltes Präfix beachten).
- **Upload-Grenze** für `/api/v1/images/` ist 10 MB je Anfrage (`/api/` in `prod.conf`); die verkleinerten Seiten liegen weit darunter, aber je Seite eine Anfrage.
- **EXIF:** `exif_transpose` vor `thumbnail()`; Pillow-Version siehe Lock.

## Checkpoints
- Vor dem Anwenden der Migration: Migrationsdatei und Entscheidung „Vorlagen in Share-Links“ vorlegen, dann anhalten.

## Abnahme
- Migration up/down/up in den DB-Tests grün; Titelbild ignoriert Vorlagen (Test)
- Foto-Import mit mehreren Seiten (lokal, echter Key): Rezept angelegt, Vorlagen in Reihenfolge gespeichert, App in der Bearbeitung, Abschnitt „Vorlage“ in Bearbeitung und Detailansicht; Rezeptfoto ändern lässt Vorlagen unangetastet
- Hochformatfoto mit EXIF-Ausrichtung erscheint aufrecht (Test)
- Vitest-Specs aus Schritt 6 und W.30 grün
- Szenarien für meine Sichtprüfung im Bericht (inkl. iPhone/iPad)
- Verifikation gemäß Projekt-CLAUDE.md (Frontend und Backend, mit Container wegen Migration)
