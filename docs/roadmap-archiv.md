# Roadmap-Archiv my-cookbook

Erledigte und verworfene Punkte aus [ROADMAP.md](../ROADMAP.md), wörtlich übernommen. Ältere Sprints: [ui-roadmap-2025-26.md](plans/ui-roadmap-2025-26.md).

## W — Wartung

- [x] W.6 DB-User und -Name in `backup.sh`, Compose-Healthcheck und README-Restore aus Variablen · 2026-11-14 · `de69202`
- [x] W.8 Altlasten der YAML-Migration entfernen (`backend/cookbook.yaml`, `backend/scripts/`, `.gitignore`-Eintrag `backup_pre_d1.sql`) · 2026-11-14 · `c7cf6b2`
- [x] W.2 Vue-CLI-Altlasten entfernen (`vue.config.js`, `jsconfig.json`, `public/index.html`, `echo` im Dockerfile), `dist/index.html` prüfen · 2026-11-14 · `ed39c1e`
- [x] W.7 Base-Images auf Minor pinnen (`node:26-alpine`, `nginx:1.30-alpine`) · 2026-11-14 · `149f745`
- [x] W.14 Frontend-Lock auffrischen (Patch/Minor), `npm audit` ohne high · 2026-11-14 · `f85d041`
- [x] W.4 Backend auf uv + `pyproject.toml` + Lock, ruff, Smoke-Tests; Majors openai 3, Pillow 13, cryptography 50, SQLAlchemy 2.1 · 2026-11-14 · `0c0f76d`
