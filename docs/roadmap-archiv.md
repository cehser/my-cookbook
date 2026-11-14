# Roadmap-Archiv my-cookbook

Erledigte und verworfene Punkte aus [ROADMAP.md](../ROADMAP.md), wörtlich übernommen. Ältere Sprints: [ui-roadmap-2025-26.md](plans/ui-roadmap-2025-26.md).

## W — Wartung

- [x] W.6 DB-User und -Name in `backup.sh`, Compose-Healthcheck und README-Restore aus Variablen · 2026-11-14 · `de69202`
- [x] W.8 Altlasten der YAML-Migration entfernen (`backend/cookbook.yaml`, `backend/scripts/`, `.gitignore`-Eintrag `backup_pre_d1.sql`) · 2026-11-14 · `c7cf6b2`
- [x] W.2 Vue-CLI-Altlasten entfernen (`vue.config.js`, `jsconfig.json`, `public/index.html`, `echo` im Dockerfile), `dist/index.html` prüfen · 2026-11-14 · `ed39c1e`
- [x] W.7 Base-Images auf Minor pinnen (`node:26-alpine`, `nginx:1.30-alpine`) · 2026-11-14 · `149f745`
- [x] W.14 Frontend-Lock auffrischen (Patch/Minor), `npm audit` ohne high · 2026-11-14 · `f85d041`
- [x] W.4 Backend auf uv + `pyproject.toml` + Lock, ruff, Smoke-Tests; Majors openai 3, Pillow 13, cryptography 50, SQLAlchemy 2.1 · 2026-11-14 · `0c0f76d`
- [x] W.11 Rezepte nach Login und Token-Ablauf zuverlässig laden (inkl. Nacharbeit N1–N12, Abnahme auf dem Gerät nach Deploy) · 2026-11-14 · `451f2a0`
- [x] W.1 Doppelten Handler `GET /v1/tags` auflösen: nur noch `tags.py`, Antwort `{id, name, count}` (nur Tags mit Rezept) · 2026-11-14 · `7048441`
- [x] W.18 PyYAML aus den Backend-Abhängigkeiten entfernen · 2026-11-14 · `51e84fc`
- [x] W.17 `backup.sh`: Fehler von `pg_dump` und leere Dumps erkennen, dann keine Rotation · 2026-11-14 · `2eb553e`
- [x] W.20 Backend-Aufräumen nach W.4: Migrationslog, B904, ruff-Ausnahme, xfail, Tie-Breaker `Recipe.id`, apt-Pakete entfernt; `root_path` → W.24 · 2026-11-14 · `9fded22`
- [x] W.16 Verzichtbare Abhängigkeiten ersetzen: `deep-equal` → `isEqualPlain`, `deepCopyYaml` → `deepCopyJSON`, `sass` → CSS `aspect-ratio`, `@vueuse/integrations` und Font-Cache-Regel entfernt (22 Lock-Einträge weniger; Sichtprüfung Galerie nach Deploy) · 2026-11-14 · `5acab54`
- [x] W.3 Instanz-Defaults entfernen (`OIDC_*` Pflicht, Dev über `frontend/.env.local`), erster Admin per `ADMIN_EMAIL` (nur `email_verified`), Login-Race per `ON CONFLICT` · 2026-11-15 · `e0ce16f`
- [x] W.19 Apple-Touch-Icon und PNG-Favicons · 2026-11-15 · `1606d60`
