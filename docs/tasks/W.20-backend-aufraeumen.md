# Auftrag W.20: Backend aufräumen, Tags-Handler, PyYAML, Backup-Fehler

> Erstellt 2026-11-14 vom Master · Roadmap: `ROADMAP.md` Punkte W.20, W.1, W.18, W.17 · Basis: `main@1a79fcd` · Aufwand: M · Modell: Sonnet

## Ziel
Das Backend läuft ohne Deprecation-Warnung, protokolliert die Migration sichtbar und hat genau einen Handler für `GET /v1/tags`. Die Rezeptliste paginiert stabil. `backup.sh` erkennt einen fehlgeschlagenen Dump und rotiert dann nicht. Keine fachlichen Änderungen darüber hinaus, keine DB-Migration.

## Erst lesen
1. `docs/tasks/W.4.bericht.md` – Abschnitt „Offen und Folgepunkte“ (Herkunft der W.20-Punkte)
2. `.claude/rules/backend-tooling.md` – Test-Muster, `iter_route_contexts`, Windows-ARM-Falle
3. `backend/app/main.py`, `backend/Dockerfile`, `backend/pyproject.toml`
4. `backend/app/routes/recipes.py` (`list_recipes`, `list_tags`) und `backend/app/routes/tags.py`
5. `frontend/.docker/nginx/prod.conf` – nginx reicht `/api/` **mit** Präfix an das Backend durch
6. `scripts/backup.sh` – läuft per Cron auf dem Server

## Auftrag

### W.20 Backend-Aufräumen
1. **`root_path`:** `root_path="/api"` aus `FastAPI(...)` entfernen, stattdessen `--root-path /api` im `CMD` des Dockerfiles. Die Pfade über nginx (`/api/v1/…`, `/api/health`, `/api/docs`, `/api/openapi.json`) müssen unverändert funktionieren. Smoke-Tests bei Bedarf anpassen (`ASGITransport` kennt `root_path`). Lokalen Startbefehl in CLAUDE.md und README um `--root-path /api` ergänzen.
2. **Migrationslog:** Die Zeile „Database migrations applied successfully.“ muss im Container-Log erscheinen. Minimal lösen (Logging-Konfiguration für den Logger `app`), ohne neue Abhängigkeit; Uvicorns eigenes Logging nicht doppeln.
3. **B904:** die beiden `noqa: B904` (`auth/dependencies.py`, `routes/images.py`) durch `raise … from …` ersetzen. Statuscode und Antworttext bleiben gleich.
4. **ruff:** `per-file-ignores` für `scripts/*` entfernen (`backend/scripts/` ist mit W.8 gelöscht).
5. **xfail:** Mit W.1 entfällt der Doppelhandler; den `xfail`-Marker an `test_no_duplicate_routes` entfernen, der Test muss grün laufen.
6. **Tie-Breaker:** In `list_recipes` nach der Sortierspalte zusätzlich nach `Recipe.id` sortieren (gleiche Richtung), damit `offset`/`limit` bei gleichen Zeitstempeln oder Namen keine Rezepte doppelt liefert oder auslässt.
7. **apt-Pakete:** Prüfen, ob `libjpeg62-turbo-dev` und `libwebp-dev` im Image nötig sind (Pillow bringt manylinux-Wheels mit eigenen Bibliotheken). Wenn nicht: entfernen; Nachweis mit `_process_image` für JPEG, PNG (RGBA), GIF und WEBP im gebauten Container.

### W.1 Doppelten Handler `GET /v1/tags` auflösen
1. `list_tags` aus `recipes.py` entfernen; `tags.py` ist der einzige Handler.
2. Antwort von `tags.py` um `id` erweitern: `{id, name, count}`, gruppiert nach `Tag.id, Tag.name`, sortiert nach Name. Damit bleibt der Frontend-Typ `TagItem {id, name}` gültig, ohne Frontend-Änderung.
3. Ungenutzte Imports und Schemas danach entfernen (`TagResponse` nur, wenn sonst nirgends genutzt).

### W.18 PyYAML entfernen
1. `pyyaml` samt Kommentar aus `dependencies` in `pyproject.toml`, `uv lock`.
2. Vorher prüfen, dass kein `import yaml` im Backend steht.

### W.17 `backup.sh`: Fehler von `pg_dump` erkennen
1. Schlägt `pg_dump` fehl (Container aus, falsche Credentials), bricht das Skript mit Exit-Code ≠ 0 ab, löscht die unvollständige Datei und rotiert **nicht**.
2. Ein leerer oder nur aus dem gzip-Header bestehender Dump gilt ebenfalls als Fehler.
3. Dateinamen, Zielordner, Aufrufschnittstelle und Rotation (30 Dateien) bleiben unverändert.

## Ablage
- Geändert: `backend/app/main.py`, `backend/Dockerfile`, `backend/pyproject.toml`, `backend/uv.lock`, `backend/app/routes/recipes.py`, `backend/app/routes/tags.py`, `backend/app/auth/dependencies.py`, `backend/app/routes/images.py`, `backend/tests/test_app.py` (ggf. `conftest.py`), `scripts/backup.sh`, `CLAUDE.md`, `README.md`
- Je Roadmap-Punkt mindestens ein eigener Commit.

## Nicht in diesem Auftrag
- Frontend (W.16 läuft parallel), auch nicht `frontend/src/api/recipes.ts`
- `ai.py` und der AI-Import (W.12)
- DB-Integrationstests, CI (W.5); DB-Migrationen
- Python-Basisimage, Postgres-Version (W.21)

## Entscheidungen, die ich treffe
- keine. Festgelegt: `tags.py` bleibt, Antwort `{id, name, count}`; nur Tags mit mindestens einem Rezept (wie heute in `tags.py`).

## Fallstricke
- `root_path`: Starlette und Uvicorn behandeln `root_path` beim Routing unterschiedlich, je nach Version (unbestätigt für die Lock-Versionen). nginx entfernt das Präfix **nicht**. Nachweis daher im gebauten Container direkt (`curl http://localhost:8000/api/health`) und über die Compose-Kette, nicht nur in den Smoke-Tests. Funktioniert `--root-path` nicht ohne Umbau der Pfade: `root_path` im Code lassen, Warnung gezielt dokumentieren und im Bericht begründen.
- `/api/docs` lädt `openapi.json` über `root_path`; ein falscher Wert zeigt sich nur dort.
- `uvicorn[standard]` zieht PyYAML transitiv; nach W.18 kann es im Lock bleiben. Ziel ist nur die direkte Abhängigkeit.
- `backup.sh` hat `#!/bin/sh`. `set -o pipefail` ist in älteren `dash`-Versionen nicht verfügbar (Server-Shell unbekannt). Entweder auf `bash` umstellen oder ohne `pipefail` lösen (z. B. Exit-Code von `pg_dump` separat erfassen); Wahl im Bericht begründen.
- Lokal Windows ARM: `uv sync --python cpython-3.14-windows-x86_64-none` (siehe Regeldatei).

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `uv sync --frozen && uv run ruff check && uv run ruff format --check && uv run pytest` grün, kein `xfail` mehr, keine `FastAPIDeprecationWarning` zu `root_path`
- Container gebaut und gestartet: Log zeigt die Migrationszeile der App; `GET /api/health` → 200; `GET /api/docs` lädt das Schema; `GET /api/v1/tags` mit Token liefert `{id, name, count}` (oder ohne Token 401, falls kein Token verfügbar)
- `grep -rn "noqa: B904" backend/app` und `grep -n pyyaml backend/pyproject.toml` finden nichts
- Bilderverarbeitung im Container für JPEG, PNG, GIF, WEBP geprüft, falls apt-Pakete entfernt
- `sh -n scripts/backup.sh` (bzw. `bash -n`) fehlerfrei; Fehlerfall nachgewiesen (z. B. gestoppter `db`-Container → Exit ≠ 0, keine neue Datei, keine Rotation); Erfolgsfall erzeugt ein nicht leeres `.sql.gz`
- Bericht nennt die Zeile, die ich auf dem Server ändern muss, falls Compose oder Cron betroffen sind
- Verifikation gemäß Projekt-CLAUDE.md (Backend, mit Container)
