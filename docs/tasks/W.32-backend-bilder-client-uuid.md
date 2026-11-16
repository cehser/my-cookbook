# Auftrag W.32: Backend-Schnitt Bilder (+ W.33 Backend: Client-UUID beim Anlegen)

> Erstellt 2026-11-16 vom Master · Roadmap: `ROADMAP.md` Punkte W.32, W.33 · Basis: `main@bab174a` · Aufwand: M · Modell: Opus

## Ziel
`routes/images.py` (497 Zeilen) wird zur schlanken Routendatei. Verarbeitung und Ablage der Bilddateien liegen in einem Service, die Admin-Wartung in einer eigenen Routendatei. Fehler beim Löschen von Dateien erscheinen im Log. Zusätzlich nimmt `POST /recipes` optional die ID des Clients an (W.33, nur Backend). Das ist abwärtskompatibel: Das heutige Frontend schickt keine ID und merkt nichts davon. Den Frontend-Teil von W.33 schneide ich nach W.31.

## Erst lesen
1. `docs/tasks/W.28.bericht.md` – Befunde und Folgepunkte
2. `.claude/rules/backend-db.md`, `.claude/rules/backend-tooling.md` (DB-Tests lokal mit `postgres:16-alpine`)
3. `backend/app/routes/images.py`, `app/routes/recipes.py` (importiert `delete_recipe_files`, `download_and_store_image`; `create_recipe`), `app/main.py` (Router), `app/services/` (bestehende Services als Vorbild)
4. `backend/tests/test_image_processing.py` (importiert `_process_image` aus der Route), `tests/db/test_migrations.py`, `tests/db/test_api.py`
5. `docs/plans/export-import.md` – 11.1/11.2 setzen später auf Bildverarbeitung und Anlegen mit vorhandener UUID auf

## Auftrag

### W.32 Backend-Schnitt Bilder
1. **Service** `app/services/images.py` (oder passender Name) mit Dateiablage, `_process_image`, Löschen der Dateien eines Bildes bzw. eines Rezepts und `download_and_store_image`. Das sind die Funktionen, die `recipes.py`, die Admin-Wartung und später 11.2 brauchen. Ohne FastAPI-Abhängigkeiten außer `HTTPException`, wo heute schon geworfen wird.
2. **Admin-Routen** `migrate-images`, `cleanup-images` und `strip-image-ids` in eine eigene Routendatei, z. B. `routes/admin_images.py`. Pfade, Rollen und Antworten bleiben unverändert.
3. `routes/images.py` behält Upload, Liste, Auslieferung und Löschen einzelner Bilder. Imports in `recipes.py`, `main.py` und den Tests nachziehen.
4. **Löschfehler loggen:** Statt `rmtree(ignore_errors=True)` und stillem Ignorieren beim Einzelbild Fehler mit Pfad loggen (`warning`). Eine fehlende Datei ist kein Fehler. Das Löschen in der DB scheitert daran nicht. Dazu ein Test.
5. **Migrationstest:** In `tests/db/test_migrations.py`: Zeilen in `recipe_images` vor 007 anlegen, auf 007 heben, dann ist `kind = 'photo'` gesetzt.

### W.33 Client-UUID beim Anlegen (nur Backend)
1. `RecipeCreate` erhält ein optionales Feld `id: uuid.UUID | None`. Ist es gesetzt, legt `create_recipe` das Rezept mit dieser ID an, sonst vergibt die DB sie wie bisher.
2. Gibt es die ID schon, antwortet der Endpunkt mit **409**, der Detailtext nennt die Kollision. Die Prüfung muss auch bei gleichzeitigen Anfragen greifen: `IntegrityError` auf dem Primärschlüssel abfangen und 409 liefern, nicht nur vorab per `SELECT` prüfen.
3. DB-Tests: Anlegen mit ID ergibt genau diese ID in der Antwort; die zweite Anlage mit derselben ID ergibt 409, das bestehende Rezept bleibt unverändert; Anlegen ohne ID funktioniert wie bisher.
4. Die API-Doku bzw. Rule (`backend-db.md` oder passend) um den Vertrag ergänzen: Die ID kommt vom Client; 409 bedeutet „existiert bereits“, ein Client kann das bei einer Wiederholung als Erfolg werten.

## Ablage
- Neu: `app/services/images.py`, `app/routes/admin_images.py` (Namen nach Ermessen), Tests
- Geändert: `app/routes/images.py` (schrumpft deutlich), `app/routes/recipes.py`, `app/main.py`, `app/schemas/recipe.py`, `tests/test_image_processing.py` (Import), `tests/db/test_migrations.py`, `tests/db/test_api.py`, `.claude/rules/backend-db.md`

## Nicht in diesem Auftrag
- Frontend: UUID mitschicken, 409 bei einer Wiederholung auswerten (W.33 Rest, nach W.31)
- Verhalten oder Pfade der Bild-Endpunkte ändern; Vorlagen löschen oder sortieren
- `PUT` mit Anlegen (Upsert), Export/Import (11.1/11.2)
- Frontend-Dateien generell; `docker-compose`, CI (W.9 läuft parallel)

## Entscheidungen, die ich treffe
- keine. Entschieden ist: Die ID ist optional, bei Kollision gibt es 409, kein Upsert.

## Fallstricke
- **Testimporte:** `tests/test_image_processing.py` importiert `_process_image`, `OPTIMISED_MAX` und `THUMB_SIZE` aus `app.routes.images`. Beim Verschieben mitziehen und nicht über Re-Exporte am Leben halten.
- **Router-Reihenfolge:** Die Admin-Pfade liegen unter `/admin/…`, `routes/admin.py` hat dasselbe Präfix. Pfadkonflikte und die Rollen-Abhängigkeit (`require_admin`) prüfen, die OpenAPI-Pfade müssen vorher und nachher gleich sein. Ein Vergleich der `/openapi.json`-Pfadliste im Test oder im Bericht genügt.
- **`IntegrityError` und Transaktion:** Nach einem gescheiterten `flush` ist die Session im Fehlerzustand: `rollback`, dann 409. `_auto_download_imageurl` läuft in derselben Transaktion und darf vor dem 409 keine Dateien hinterlassen. Die ID-Kollision fällt deshalb idealerweise beim ersten `flush` auf, vor dem Download.
- **Gelöschte Rezepte** hinterlassen keinen Grabstein. Eine ID darf nach dem Löschen wieder verwendet werden, das ist so gewollt.
- **DB-Tests lokal** nur mit `postgres:16-alpine`, Collation `C`, siehe Rule.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `routes/images.py` deutlich kleiner, Service und Admin-Routen getrennt; OpenAPI-Pfade unverändert
- Löschfehler werden geloggt (Test); Migrationstest `kind = 'photo'` grün
- `POST /recipes` mit ID: angelegt mit dieser ID bzw. 409, ohne ID unverändert (DB-Tests)
- Verifikation gemäß Projekt-CLAUDE.md (Backend inkl. DB-Tests; Container bauen und starten, `/api/health`)
