# Bericht W.20: Backend aufräumen, Tags-Handler, PyYAML, Backup-Fehler

> Branch `worktree-W.20-backend-aufraeumen` · Basis `e88c2d8` · Stand `9fded22` · 2026-11-14 · Dauer: 22:55 – 23:04 (9 min, davon Warten an Checkpoints 0 min) · Status: teilweise

## Ergebnis
W.1, W.18 und W.17 sind fertig, W.20 bis auf Punkt 1 (`root_path`). Der Migrationslog erscheint im Container, `GET /v1/tags` hat einen Handler mit `{id, name, count}`, `backup.sh` bricht bei Dump-Fehlern ab und rotiert dann nicht. `root_path` bleibt im Code, weil `uvicorn --root-path /api` mit dem aktuellen nginx nicht funktioniert.

## Commits
- `7048441` fix(backend): Doppelten Handler GET /v1/tags auflösen (W.1)
- `51e84fc` build(backend): PyYAML als direkte Abhängigkeit entfernen (W.18)
- `8756034` build(backend): ruff-Ignore für scripts/* entfernen
- `64cd28a` refactor(backend): B904 mit raise ... from beheben
- `175d938` fix(backend): Rezeptliste mit Tie-Breaker auf Recipe.id sortieren
- `2eb553e` fix(deploy): backup.sh bricht bei fehlgeschlagenem pg_dump ab (W.17)
- `0e0fe2d` fix(backend): Migrationslog sichtbar, root_path-Warnung gezielt unterdrückt
- `c823a19` build(backend): apt-Pakete für Pillow aus dem Image entfernen
- `9fded22` docs(backend): Regeln zu root_path und Logging ergänzen

## Verifikation
- `uv sync --frozen && uv run ruff check && uv run ruff format --check && uv run pytest` → grün, 64 passed, kein xfail, keine Warnung (auch nicht die FastAPI-Deprecation, siehe Abweichungen)
- `grep -rn "noqa: B904" backend/app`, `grep -n pyyaml backend/pyproject.toml` → keine Treffer
- Container (Image gebaut, Postgres 16, nginx mit `prod.conf` als Kette, isoliertes Netz, ohne Compose-Datei und `.env`): Log zeigt `app.main - Database migrations applied successfully.`; `/api/health` direkt und über nginx → 200; `/api/docs` → 200, lädt `/api/openapi.json`; `servers: [{url: /api}]`; `/api/v1/tags` ohne Token → 401. Mit Token nicht geprüft (kein Token verfügbar). Die SQL-Abfragen für Tags und Rezeptliste (Tie-Breaker) laufen gegen die Container-DB (leer, kein Fehler).
- Bilder im Container ohne apt-Pakete: `_process_image` für JPEG, PNG (RGBA), GIF, WEBP ok. Geprüft auf aarch64; dass die x86_64-Wheels die Bibliotheken ebenfalls mitbringen, ist abgeleitet, nicht geprüft.
- `sh -n scripts/backup.sh` → ok. Mit Docker-Stub: `pg_dump` Exit 1 → Exit 1, keine Datei, keine Rotation; leerer Dump → Exit 1, ebenso; Erfolg → nicht leeres `.sql.gz`, Rotation auf 30. Mit echtem gestopptem `db`-Container nicht geprüft (keine Compose-Datei im Worktree).
- Prüfzeit: ~5 min; größter Posten: Image-Builds
- Prüfskripte: nur Scratchpad (`/tmp`)

## Struktur und Doku
- Gewachsene Dateien, neue Module, bewusste Duplikate: keine
- CLAUDE.md und README: stimmen noch (Startbefehl unverändert, `root_path="/api"` bleibt). Nachgetragen in `.claude/rules/backend-tooling.md`: `root_path`, Logging und `fileConfig`.

## Abweichungen vom Auftrag
- **W.20.1 `root_path`:** verworfen, wie im Auftrag als Rückfall vorgesehen. Mit `--root-path /api` antwortet das Backend unter `/health`, `/docs`, `/v1/tags`; `/api/health` direkt und `/api/api/health` → 404. nginx entfernt das Präfix nicht, die Pfade über nginx würden brechen. `root_path="/api"` bleibt im Code, die Deprecation-Warnung ist in `main.py` mit Begründung per `warnings.filterwarnings` unterdrückt. CLAUDE.md, README und `conftest.py` brauchen keine Änderung.
- **W.20.2 Migrationslog:** zusätzlich `alembic/env.py` geändert (nicht in der Ablage-Liste): `fileConfig` deaktivierte mit dem Default `disable_existing_loggers=True` den Logger `app`. Ohne diese Änderung bleibt die Zeile unsichtbar. Nebeneffekt: Uvicorns eigene Logger bleiben nach der Migration aktiv („Application startup complete“ erscheint jetzt im Log).
- **W.17:** ohne `pipefail`, Dump in Temp-Datei (`.cookbook_<ts>.sql.gz.tmp` und `.sql.tmp` im Zielordner), dann `gzip`; `#!/bin/sh` bleibt. Der Dump liegt kurz unkomprimiert auf der Platte (Platzbedarf = Dumpgröße). Temp-Dateien entfernt ein `trap`.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- `root_path` ablösen (Aufwand S): `proxy_pass http://backend:8000/;` in `frontend/.docker/nginx/prod.conf`, `--root-path /api` im Dockerfile, `root_path` aus `main.py`, Tests mit `ASGITransport(root_path="/api")`. Berührt das Frontend-Image und den Server-Rollout, Abstimmung mit W.16 nötig.
- `/api/docs` und `/api/openapi.json` sind unauthentifiziert erreichbar (unverändert, nur festgestellt).

## Server-Änderungen
- Keine nötig: Compose und Cron bleiben unverändert (`backup.sh`: Aufruf, Dateinamen, Zielordner gleich). Das Backend-Image muss neu gebaut werden (Dockerfile geändert).

## Status je Roadmap-Punkt
- `W.20` teilweise (Punkt 1 `root_path` verworfen, Rest fertig)
- `W.1` fertig
- `W.18` fertig
- `W.17` fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.1 Doppelter Handler GET /v1/tags · 2026-11-14 · 7048441`
`- [x] W.18 PyYAML entfernen · 2026-11-14 · 51e84fc`
`- [x] W.17 backup.sh erkennt pg_dump-Fehler · 2026-11-14 · 2eb553e`
`- [~] W.20 Backend aufräumen (root_path bleibt, siehe Folgepunkt) · 2026-11-14 · 9fded22`
