# Bericht W.32: Backend-Schnitt Bilder (+ W.33 Backend: Client-UUID beim Anlegen)

> Branch `worktree-W.32-backend-bilder-client-uuid` · Basis `66447c5` (= `bab174a` + `docs(roadmap)`) · Stand `3ac5049` (+ dieser Bericht) · 2026-11-16 · Dauer: 18:28 – 18:39 (11 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Bildverarbeitung, Ablage, Download und Löschen liegen in `app/services/images.py`. Die Admin-Wartung liegt in `routes/admin_images.py`. `routes/images.py` hat nur noch Upload, Liste, Auslieferung und Löschen (497 → 223 Zeilen). Das OpenAPI-Schema ist nach dem Schnitt byte-identisch. Löschfehler erscheinen mit Pfad als Warnung, fehlende Dateien gelten nicht als Fehler. `POST /v1/recipes` nimmt optional `id` an: Das Rezept wird mit dieser ID angelegt; existiert die ID schon, kommt 409. Ohne ID läuft alles wie bisher.

## Commits
- `c757b00` refactor(images): Bildverarbeitung als Service, Admin-Wartung getrennt
- `983b042` fix(images): Fehler beim Löschen von Bilddateien loggen
- `1febd5d` test(db): Migration 007 setzt kind = 'photo' auf bestehende Bilder
- `3ac5049` feat(backend): POST /recipes übernimmt optional die ID des Clients

## Verifikation
- `uv sync --frozen && uv run ruff check && uv run ruff format --check && uv run pytest` → grün, 133 passed, 12 skipped (DB). Lokal mit `--python cpython-3.14-windows-x86_64-none` (ARM-Falle laut Rule).
- `uv run pytest -m db` gegen eine Wegwerf-DB `postgres:16-alpine` (Port 55432) → 12 passed. Abgedeckt: 007 setzt `kind = 'photo'`; Anlegen mit ID; 409 bei Wiederholung, bestehendes Rezept unverändert (Name, Tags, `updated_at`); drei parallele Anlagen ergeben 201/409/409; bei 409 bleiben keine Bilddateien liegen und der Download wird nicht aufgerufen; nach dem Löschen ist die ID wieder frei. Anlegen ohne ID decken die bestehenden Tests ab (`test_recipe_lifecycle` u. a.).
- Löschfehler: `tests/test_image_files.py` (5 Tests, ohne DB) prüft Einzelbild und Rezeptordner. Ein gesperrter Pfad erzeugt eine Warnung mit Pfad, die übrigen Dateien werden trotzdem gelöscht. Fehlende Dateien und ein fehlender Ordner erzeugen keine Warnung.
- OpenAPI: `app.openapi()` vor und nach dem Schnitt verglichen → identisch (Pfade, Tags, operationIds, Antworten). Nach W.33 unterscheidet sich nur das Feld `id` in `RecipeCreate`.
- Container: Image aus dem Worktree gebaut, gegen die Test-DB gestartet. Log `Database migrations applied successfully.`, `GET /api/health` → `{"status":"ok","database":"connected"}`. Bewusst nicht im lokalen Compose-Stack (keine Migration in diesem Auftrag). Container und Image danach entfernt.
- Sichtprüfung: keine (reine Backend-Änderung, das Frontend schickt noch keine ID)
- Prüfzeit: pytest 2,1 s, DB-Tests 6,3 s; größter Posten: Image-Build (ohne Zeitausgabe)
- Prüfskripte: nur Scratchpad (OpenAPI-Dump)

## Struktur und Doku
- Neu: `app/services/images.py` (203 Zeilen), `app/routes/admin_images.py` (136), `tests/test_image_files.py`. Geschrumpft: `routes/images.py` 497 → 223. Keine bewussten Duplikate. Upload und Download nutzen jetzt gemeinsam `store_image_files`, vorher war die Ablage doppelt implementiert. 11.2 kann die Funktion direkt verwenden.
- `.claude/rules/backend-db.md`: Vertrag für die Client-ID nachgetragen, `paths` um `routes/recipes.py` und `schemas/recipe.py` erweitert, damit die Rule dort greift. README (API-Übersicht): ein Satz zum Vertrag. CLAUDE.md stimmt noch.

## Mitgenommen
- nichts

## Abweichungen vom Auftrag
- **`_process_image` heißt jetzt `process_image`.** Die Funktion ist öffentliche Service-API und wird von Tests und später 11.2 genutzt. Es gibt keinen Re-Export, die Tests importieren aus dem Service.
- **Reihenfolge beim Löschen:** `DELETE …/images/{id}` und `cleanup-images` löschen die Dateien jetzt erst nach dem Commit, wie schon `DELETE /recipes/{id}`. Vorher wurden die Dateien vor dem Commit gelöscht: Scheiterte der Commit, fehlten die Dateien zu einer noch bestehenden Zeile. An der Antwort der Endpunkte ändert sich nichts.
- **Admin-Routen behalten den OpenAPI-Tag `images`** (nicht `admin`), damit das Schema identisch bleibt.
- **README angepasst**, obwohl nicht unter „Ablage“ genannt: Die README enthält die API-Übersicht, die der Auftrag als Ziel der API-Doku nennt.
- **Nur `IntegrityError`, kein Vorab-`SELECT`:** Die Prüfung über `IntegrityError` deckt sowohl einzelne als auch gleichzeitige Anfragen ab. Ein zusätzliches `SELECT` wäre redundant. Erkannt wird SQLSTATE `23505`, auf `recipes` ist nur der Primärschlüssel eindeutig. Andere Integritätsfehler werden weiter geworfen.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- W.33 Frontend: `appendRecipe` schickt `recipe_uuid` als `id` mit und wertet 409 bei einer Wiederholung als Erfolg (nach W.31, wie geplant).

## Status je Roadmap-Punkt
- `W.32` fertig
- `W.33` Backend fertig, Frontend offen (Rest, nach W.31)

## Vorschlag Roadmap-Zeilen
`- [x] W.32 Backend-Schnitt Bilder (Service, Admin-Routen, Löschfehler loggen) · 2026-11-16 · 3ac5049`
`- [ ] W.33 Client-UUID beim Anlegen · Backend erledigt 2026-11-16 (3ac5049), Frontend offen`
