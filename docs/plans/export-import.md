# Plan: Export/Import der Rezepte in der GUI

Stand: 2026-11-14 · Roadmap: 11.1, 11.2

## Ziel
Admins exportieren den gesamten Rezeptbestand als ZIP und spielen ihn wieder ein, z. B. zur Sicherung von Hand, für einen Umzug oder einen Neuaufbau.

## Entscheidungen (2026-11-14)
- **Berechtigung:** nur `admin`, UI in der Verwaltung (`Administration.vue`).
- **Umfang:** Rezepte, Tags, Bilder (Originale). Nicht enthalten: User, Favoriten, Share-Links, Site-Settings.
- **Konflikt bei gleicher `recipe_uuid`:** im Import-Dialog wählbar „Überspringen“ (Standard) oder „Überschreiben“.
- **Altlasten:** Der Einzel-Export (YAML je Rezept) bleibt. Der Einzel-Import wird mit 11.2 auf die UUID-Logik umgestellt (keine Duplikate mehr). Der Button „Speichern“ (IndexedDB) entfällt.
- **Nicht-Scope:** automatisches Server-Backup.

## Ansatz
- Backend erzeugt und liest das ZIP (`zipfile`, Standardbibliothek; keine neue Abhängigkeit).
- `GET /v1/admin/export` → ZIP, gestreamt:
  - `manifest.json`: Formatversion, Zeitpunkt, App-Commit, Anzahl Rezepte/Bilder
  - `recipes/<uuid>.yaml`: Rezept im Format des bestehenden YAML-Imports, inkl. Tags und Bildreferenzen
  - `images/<image_id>.<ext>`: Original
- `POST /v1/admin/import` (Multipart, Parameter `on_conflict=skip|overwrite`) → Zusammenfassung: angelegt / übersprungen / überschrieben / Fehler je Rezept.
- Bilder beim Import über den vorhandenen Upload-Pfad verarbeiten (Optimierung + Thumbnail neu), nicht roh ins Volume kopieren.

## Offene Punkte für die Umsetzung
- Größe: Export streamen; Import-Limit gegen `MAX_UPLOAD_SIZE_MB` abwägen (gilt heute je Bild).
- Originale: Der Upload schreibt das Original neben die optimierte WebP-Fassung, in der DB stehen aber nur die Pfade von WebP und Thumbnail. Klären, ob das Original zuverlässig auffindbar ist; sonst die WebP-Fassung exportieren.
- Import transaktional je Rezept (ein fehlerhaftes Rezept bricht nicht den ganzen Import ab).
- `created_by` beim Import: importierender Admin oder Wert aus dem Export, falls der User existiert.
