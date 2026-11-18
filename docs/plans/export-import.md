# Plan: Export/Import der Rezepte in der GUI

Stand: 2026-11-18 (11.1 umgesetzt) · Roadmap: 11.1, 11.2

## Ziel
Admins exportieren den gesamten Rezeptbestand als ZIP und spielen ihn wieder ein, z. B. zur Sicherung von Hand, für einen Umzug oder einen Neuaufbau.

## Entscheidungen (2026-11-14)
- **Berechtigung:** nur `admin`, UI in der Verwaltung (`Administration.vue`; Rezeptverwaltung mit Einzel-Import/-Export und „Speichern“ seit W.27 in `components/admin/AdminRecipes.vue`, Sichtbarkeit setzt die Seite).
- **Umfang:** Rezepte, Tags, Bilder (Originale; nach W.28 auch Vorlagen mit `kind` und `sort_order`). Nicht enthalten: User, Favoriten, Share-Links, Site-Settings.
- **Konflikt bei gleicher `recipe_uuid`:** im Import-Dialog wählbar „Überspringen“ (Standard) oder „Überschreiben“.
- **Altlasten:** Der Einzel-Export (YAML je Rezept) bleibt. Der Einzel-Import wird mit 11.2 auf die UUID-Logik umgestellt (keine Duplikate mehr). Seit W.33 vergibt der YAML-Import (`HomeView.vue`, `AdminRecipes.vue`) bewusst eine neue UUID, weil `POST /recipes` die Client-ID übernimmt (sonst 409/422 bei Dateien mit vorhandener oder ungültiger `recipe_uuid`); 11.2 ersetzt das durch Überspringen/Überschreiben nach UUID. Der Button „Speichern“ (IndexedDB) entfällt.
- **Nicht-Scope:** automatisches Server-Backup.

## Entscheidungen 11.1 (Master, 2026-11-17)
- **JSON statt YAML im ZIP:** Das Backend hat seit W.18 keine YAML-Bibliothek; JSON braucht keine neue Abhängigkeit und lässt sich verlustfrei einlesen.
- **Keine Thumbnails im Export:** 11.2 erzeugt sie beim Import neu.
- **Temporäre Datei statt Streaming:** Der Bestand ist klein, `zipfile` braucht zum Schreiben `seek`.

## Ansatz
- Backend erzeugt und liest das ZIP (`zipfile`, Standardbibliothek; keine neue Abhängigkeit).
- `GET /v1/admin/export` (11.1, `app/services/export.py`): ZIP in eine temporäre Datei (`tempfile`, nicht `UPLOAD_DIR`), Auslieferung per `FileResponse`, danach gelöscht; liegengebliebene Dateien (Client-Abbruch) löscht der Start des Backends. Gelesen wird in einer eigenen Transaktion `REPEATABLE READ, READ ONLY`, also ein Stand für Rezepte, Tags und Bilder. Verschwindet eine Bilddatei bis zum Schreiben, gilt sie als fehlend. Format siehe unten.

## Exportformat, Version 1
Dateiname `my-cookbook-export-<JJJJ-MM-TT>.zip` (Datum UTC). Pfade im ZIP nur aus IDs, nie aus `filename` oder `recipe_name`. JSON UTF-8, `ZIP_DEFLATED`; Bilder unverändert, `ZIP_STORED`.

- `manifest.json`:
  - `format`: `"my-cookbook-export"`, `version`: `1`
  - `exported_at`: UTC, ISO 8601 (`2026-11-18T10:39:49Z`)
  - `app_commit`: kurzer SHA aus `COMMIT_HASH` (Image-ENV), sonst `"dev"`
  - `recipe_count`, `image_count` (exportierte Bilddateien)
  - `missing_images`: `[{recipe_id, image_id, kind}]` für Bilder, deren Datei fehlt
- `recipes/<recipe_id>.json`: `id`, `recipe_name`, `data` (JSONB unverändert), `tags` (sortiert), `created_at`, `updated_at` (ISO 8601 mit Offset), `created_by`, `updated_by` (`sub` oder `null`), `images: [{id, kind, sort_order, filename, mime_type, file}]`. Reihenfolge der Bilder: `kind`, dann `sort_order`. `file` ist der Pfad im ZIP, `null` bei fehlender Datei. `mime_type` ist der DB-Wert (immer `image/webp`, die optimierte Fassung); das Format der Datei ergibt sich aus der Endung von `file`. `filename` ist der Name beim Upload (vom Client, ungeprüft).
- `images/<image_id>.<ext>`: das Original (`originals/<id>.<ext>`, die Endung stammt aus dem Dateinamen des Uploads; ungewöhnliche Endungen werden `.bin`), sonst die optimierte WebP-Fassung. Bei einem WebP-Upload überschreibt die Verarbeitung das Original mit der optimierten Fassung; dann gibt es nur diese.

Messung (lokal, Windows, Test-DB `postgres:16-alpine`): 200 Rezepte mit je Foto (1,0 MiB) und Vorlage (0,7 MiB) → 5,7 s, 341 MiB. Unter dem nginx-Timeout von 60 s bis zum ersten Byte; der Client wartet bis 15 min, weil der Timeout den Body einschließt.
- `POST /v1/admin/import` (Multipart, Parameter `on_conflict=skip|overwrite`) → Zusammenfassung: angelegt / übersprungen / überschrieben / Fehler je Rezept.
- Bilder beim Import über den vorhandenen Upload-Pfad verarbeiten (Optimierung + Thumbnail neu), nicht roh ins Volume kopieren.

## Offene Punkte für die Umsetzung (11.2)
- Import-Limit gegen `MAX_UPLOAD_SIZE_MB` abwägen (gilt heute je Bild); ein Gesamtexport ist schnell einige hundert MiB groß (nginx `client_max_body_size` 10M für `/api/`).
- Original-Endung kommt aus dem Client-Dateinamen, nicht aus `mime_type`: Beim Import das Bild über den Upload-Pfad neu verarbeiten, nicht der Endung vertrauen.
- Import transaktional je Rezept (ein fehlerhaftes Rezept bricht nicht den ganzen Import ab).
- `created_by` beim Import: importierender Admin oder Wert aus dem Export, falls der User existiert.
