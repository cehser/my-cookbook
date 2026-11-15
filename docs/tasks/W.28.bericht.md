# Bericht W.28: Vorlage des Foto-Imports am Rezept speichern (+ Kleinkram W.30)

> Branch `worktree-W.28-vorlage-am-rezept` · Basis `3673f1d` · Stand `c2cee7c` (+ dieser Bericht) · 2026-11-15 · Dauer: 22:58 – 23:53 (54 min, davon Warten an Checkpoints 29 min) · Status: fertig

## Ergebnis
Der Foto-Import speichert seine Seiten als Vorlage (`recipe_images.kind = 'source'`) am neuen Rezept und öffnet danach direkt die Bearbeitung; Text- und URL-Import öffnen ebenfalls die Bearbeitung. Detailansicht und Bearbeitung zeigen einen aufklappbaren Abschnitt „Vorlage“; Titelbild, Rezeptfoto ändern/löschen und Share-Links bleiben bei Fotos. Bilder werden nach EXIF-Ausrichtung gedreht, beim Löschen eines Rezepts verschwinden auch seine Bilddateien.

## Commits
- `bc083b3` feat(db): Bildart kind (photo/source) für Rezeptbilder
- `80d5883` feat(images): Vorlagen (kind=source) speichern, Titelbild nur aus Fotos
- `e6757e0` fix(images): EXIF-Ausrichtung vor dem Verkleinern anwenden
- `fbc463c` fix(backend): leeres DB_PASSWORD beim Start ablehnen
- `3ae7887` test(backend): alembic_config aus den DB-Fixtures herauslösen
- `821de5b` refactor(frontend): formatDate in src/js/formatDate.ts zusammenführen
- `2da6974` feat(ai): Foto-Import speichert Seiten als Vorlage und öffnet Bearbeitung
- `bb6c7cc` feat(frontend): Abschnitt „Vorlage“ in Detailansicht und Bearbeitung
- `eca5ab2` test(ai): Specs für aiErrorMessage, Bildgrenzen, computeTargetSize, useImportPages
- `c2cee7c` fix(frontend): neues und dupliziertes Rezept mit Backend-ID öffnen

## Verifikation
- Frontend `npm run lint:check && npm run typecheck && npm test && npm run build` → grün; Vitest 19 Dateien / 129 Tests, Build ok
- Backend `uv sync --frozen && uv run ruff check && uv run ruff format --check && uv run pytest` → grün; 128 passed, 8 skipped (DB)
- DB-Tests `uv run pytest -m db` gegen Wegwerf-PostgreSQL 16 (Container, Port 55432) → 8 passed: Migrationen up/down/up inkl. Constraint-Name `ck_recipe_images_valid_kind`, Titelbild ignoriert zuerst hochgeladene Vorlagen (Detail und Liste), `sort_order` je `kind`, Listenfilter, 422 bei ungültigem `kind`, Dateien beim Löschen von Bild und Rezept
- EXIF: `tests/test_image_processing.py` (Orientation 6 → aufrecht) grün
- Container: Image aus dem Worktree gebaut, gegen die auf 006 zurückgesetzte Test-DB gestartet → Log `Running upgrade 006_add_pending_role -> 007_image_kind`, `GET /api/health` → `{"status":"ok","database":"connected"}`. Bewusst **nicht** im lokalen Compose-Stack: Migration 007 in der Dev-DB würde den `main`-Backend-Container am Start hindern, falls der Branch verworfen wird. Container und Image danach entfernt.
- Sichtprüfung: keine (kein echter Foto-Import mit Key durchgeführt) – Szenarien unten
- Prüfzeit: Vitest 9,7 s, Build 1,2 s, pytest 2,5 s + DB 4,2 s; größter Posten: Image-Build (ohne Zeitausgabe)
- Prüfskripte: nur Scratchpad

### Szenarien für die Sichtprüfung
1. Desktop: Foto-Import mit 3 Seiten → „Rezept importieren“: Status „Vorlage wird gespeichert (Seite k von 3)“, danach Bearbeitung des neuen Rezepts; Abschnitt „Vorlage (3 Seiten)“ zugeklappt zwischen Bild und „Rezept-Inhalt“, Reihenfolge = Aufnahmereihenfolge; Antippen öffnet das große Bild im neuen Tab.
2. Detailansicht desselben Rezepts: „Vorlage“ unter der Zubereitung; Kachel auf der Startseite ohne Titelbild (Vorlage wird kein Titelbild).
3. In der Bearbeitung Rezeptfoto setzen, speichern, dann wieder entfernen → Vorlagen bleiben vollständig.
4. Share-Link des Rezepts öffnen → keine Vorlage, Titelbild nur das Rezeptfoto.
5. iPhone (PWA, Home-Bildschirm): Hochformatfoto aus der Kamera als Seite → Vorlage aufrecht; Vorlage antippen → Bild öffnet sich zoombar, „Fertig“ führt zurück in die App.
6. iPad quer: Abschnitt „Vorlage“ in Detail (Desktop-Layout) und Bearbeitung.
7. Text-/URL-Import → Bearbeitung öffnet sich, kein Abschnitt „Vorlage“.
8. „Neues Rezept“ auf der Startseite und „Duplizieren“ → die neue Seite lädt das Rezept (vorher Ladezustand, siehe Mitgenommen).
9. Flugmodus beim Import (nach Erkennen): Rezept lokal, Hinweis „… Vorlage wurde nicht gespeichert“.

## Struktur und Doku
- Gewachsen: `AIRecipeImport.vue` 429 Zeilen (Upload-Ablauf), `routes/images.py` 497 Zeilen (dabei drei duplizierte Stellen zusammengefasst: `_next_sort_order`, `_image_to_dict`, `_delete_image_files`). Neu: `components/recipe/display/SourceImages.vue`, `src/js/formatDate.ts`, `backend/tests/alembic_helpers.py`, Migration `007_image_kind.py`. Keine bewussten Duplikate.
- `RecipeDisplay.vue` hat einen neuen Slot `after-steps` (beide Layouts); `SharedRecipe` füllt ihn nicht.
- Rules: `.claude/rules/ai-import.md` nachgetragen (Ablauf „Vorlage am Rezept“, korrigierte Begründung des Modulzustands). CLAUDE.md stimmt noch.

## Mitgenommen
- `c2cee7c` `newRecipe` (HomeView) und `copyRecipe` (Recipe.vue) warten auf `appendRecipe` und navigieren mit der Backend-ID statt der lokalen UUID · S freigegeben

## Abweichungen vom Auftrag
- **Rezept löschen entfernt Bilddateien** (`delete_recipe_files`, nach dem Commit): vorher blieben bei allen Bildarten die Dateien liegen; auf Anweisung in diesem Auftrag erledigt.
- **Share-Link-Titelbild** (`routes/shares.py`) zusätzlich auf `photo` gefiltert, sonst wäre eine Vorlage dort Titelbild geworden.
- **`migrate-images`** zählt nur Fotos als vorhandenes Bild (Rezept mit nur Vorlagen und `imageurl` wird weiter migriert).
- **Index** `idx_images_recipe` unverändert (wenige Bilder je Rezept, kein messbarer Vorteil); am Checkpoint freigegeben.
- **Großes Bild** öffnet im neuen Tab statt in einem Modal: Die App sperrt Pinch-Zoom, die Vorlage muss lesbar zoombar sein.
- **Navigation nach dem Import** liegt in `AIRecipeImport.vue` (testbar ohne `HomeView`); `HomeView` schließt nur den Dialog und zeigt Meldungen.
- `fbc463c` ist für sich nicht lauffähig (Import aus `tests/alembic_helpers.py`, die erst `3ae7887` anlegt); nicht umgeschrieben.
- Kein lokaler Foto-Import mit echtem Key (Abnahmepunkt) – offen für die Sichtprüfung.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Client-UUID beim Anlegen übernehmen** (M): `POST /recipes` nimmt optional `id` an (409 bei Kollision), `appendRecipe` schickt `recipe_uuid` mit. Eine ID in Client und Backend, idempotente Wiederholung, Grundlage für späteres Nachtragen offline angelegter Rezepte. Heute verwirft `appendRecipe` die lokale UUID, das Backend vergibt `gen_random_uuid()`.
- Vorlagen löschen/neu sortieren, Vorlage nachträglich hinzufügen, Export/Import mit `kind` (bereits in Plan bzw. 11.1/11.2).

## Status je Roadmap-Punkt
- `W.28` fertig (Sichtprüfung mit echtem Key offen)
- `W.30` fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.28 Vorlage des Foto-Imports am Rezept speichern · 2026-11-15 · c2cee7c`
`- [x] W.30 Kleinkram (formatDate, db_password, Test-Import) · 2026-11-15 · c2cee7c`
