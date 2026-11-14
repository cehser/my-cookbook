# Roadmap my-cookbook

Stand: 2026-11-14 · Legende: `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt · `~~…~~` verworfen
Aufwand: XS ≲ 30 min · S ≲ 1 h · M ≈ 2–4 h · L ≈ 1 Tag+

Erledigt (Archiv): Sprints 0–3, UX-1 bis UX-7, Sprint 9 (Design-System) → [ui-roadmap-2025-26.md](docs/plans/ui-roadmap-2025-26.md)

## W — Wartung 🔜
Projektstandard, Altlasten, Qualitätssicherung und Zuverlässigkeit. Zuerst W.11 und W.12 (Fehler, die Nutzer treffen), W.13 nach W.12 (gleiche Komponente), danach W.2 + W.3. Reihenfolge außerdem: W.4 vor dem Backend-Teil von W.5; W.9 nach W.3 und W.5; W.5 führt die Tests aus W.10 mit aus.

- [ ] W.1 Doppelten Handler `GET /v1/tags` auflösen (recipes.py überdeckt tags.py mit Count) · S · Sonnet
- [ ] W.2 Vue-CLI-Altlasten entfernen (`vue.config.js`, `jsconfig.json`, `public/index.html`, `echo` im Dockerfile), `dist/index.html` prüfen · S · Sonnet
- [ ] W.3 Instanzspezifische Defaults entfernen (IdP und Client-ID in `config.py`/`public/config.js`, StartURL in `index.html`) · S · Sonnet
- [ ] W.4 Backend auf uv + `pyproject.toml` + Lock, ruff, Smoke-Tests für Auth und Routen · M · Opus
- [ ] W.5 CI mit GitHub Actions: lint:check, typecheck, build, `npm audit --audit-level=high`; Backend nach W.4 · M · Sonnet
- [ ] W.6 DB-User und -Name in `backup.sh`, Compose-Healthcheck und README-Restore aus Variablen · XS · Sonnet
- [ ] W.7 Base-Images auf Minor pinnen, `npm ci --legacy-peer-deps` prüfen · XS · Sonnet
- [ ] W.8 Altlasten der YAML-Migration entfernen (`backend/cookbook.yaml`, `scripts/migrate_yaml.py`, `restore_empty.py`, `.gitignore`-Eintrag `backup_pre_d1.sql`) · XS · Sonnet
- [ ] W.9 Images per GitHub Actions bauen und nach `ghcr.io` pushen (öffentlich, Tags SHA + `main`), `deploy.sh` auf Pull umstellen · M · Sonnet
- [ ] W.10 Vitest einführen (`vitest`, `@vue/test-utils`, `happy-dom`), erste Tests für `js/` und `composables/` (Skalierung, Draft/Undo) · M · Sonnet
- [ ] W.11 Rezepte nach Login und Token-Ablauf zuverlässig laden: Single-Flight-Refresh, Laden nach Auth, Offline-Fallback sichtbar · M–L · Opus · [Plan](docs/plans/zuverlaessigkeit-login-ai-import.md#w11-rezepte-zuverlässig-laden)
- [ ] W.12 AI-Import robust: Timeouts, 401-Retry, Fehlermeldungen, YAML-Parsing, Upload-Grenzen, Modell-IDs · M · Sonnet · [Plan](docs/plans/zuverlaessigkeit-login-ai-import.md#w12-ai-import-robust)
- [ ] W.13 Foto im AI-Import über native Kamera/Fotoauswahl statt `getUserMedia`, Bilder clientseitig verkleinern · S–M · Sonnet · nach W.12 · [Plan](docs/plans/zuverlaessigkeit-login-ai-import.md#w13-foto-aufnahme-im-ai-import)

## 5 — Einkaufsliste-Export
Zutaten eines Rezepts als Einkaufsliste per Clipboard und Native Share. Plan: [ui-roadmap-2025-26.md](docs/plans/ui-roadmap-2025-26.md#sprint-5-einkaufsliste-export-1-2-tage--quick-win)

- [ ] 5.1 Einkaufsliste-Export · M · Sonnet

## 6 — Koch-Notizen
Persönliche Notizen am Rezept, auch per Spracheingabe. Plan: [ui-roadmap-2025-26.md](docs/plans/ui-roadmap-2025-26.md#sprint-6-koch-notizen--spracheingabe-4-5-tage)

- [ ] 6.1 Koch-Notizen + Spracheingabe · L · Opus

## 7 — Rezept-Wizard
Geführte Rezepterstellung in vier Schritten. Plan: [ui-roadmap-2025-26.md](docs/plans/ui-roadmap-2025-26.md#sprint-7-rezept-erstellungs-wizard-1-woche)

- [ ] 7.1 Rezept-Erstellungs-Wizard · L · Opus

## 10 — PDF-Export
Rezepte als PDF exportieren (Drucken, Weitergeben). Ansatz offen: Print-CSS im Browser oder serverseitige Erzeugung.

- [ ] 10.1 PDF-Export der Rezepte · M · Opus

## 11 — Export/Import
Admins exportieren den Rezeptbestand samt Bildern als ZIP und spielen ihn wieder ein. Plan: [export-import.md](docs/plans/export-import.md)

- [ ] 11.1 Gesamtexport als ZIP (Rezepte, Tags, Bilder) · M · Opus
- [ ] 11.2 Import aus ZIP mit Konfliktwahl, Einzel-Import auf UUID-Logik, IndexedDB-„Speichern“ entfernen · M · Opus · nach 11.1

## Später
- [ ] S.1 Rezept-Tracking serverseitig: „Zuletzt geöffnet“ je User, „Beliebt“ über alle → [IDEAS.md](docs/IDEAS.md#1-rezept-tracking-beliebt--zuletzt-geöffnet)
- [ ] S.2 Home zum Dashboard ausbauen („Beliebt“, „Zuletzt hinzugefügt“) → [IDEAS.md](docs/IDEAS.md#2-dashboard-statt-galerie)
