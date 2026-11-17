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
- [x] W.5 CI mit GitHub Actions (Frontend, Backend, DB-Tests gegen PostgreSQL 16, Image-Builds ohne Push), `--legacy-peer-deps` entfernt · 2026-11-15 · `d0818e9`
- [x] W.22 Service-Worker-Update steuern: `registerType: prompt`, Aktivierung bei erfolgreicher Navigation oder Rückkehr nach ≥ 10 min, nie bei `hidden` (Dateiauswahl), andere Tabs aufgeschoben (inkl. Nacharbeit N1–N3) · 2026-11-15 · `7951515`
- [x] W.12 AI-Import robust: Structured Outputs (Responses API), Modell als Admin-Einstellung, Fehlerabbildung, Timeouts/Grenzen, Foto-Upload (A8), Prompt im Image statt Volume (inkl. Nacharbeit N1–N5) · 2026-11-15 · `e9d2689`
- [x] W.10 Vitest eingeführt (vitest, @vue/test-utils, happy-dom; 63 Tests, CI), Store-Schnitt `recipeMapping.ts` und `recipeApi.listAll`, `saveSettings` speichert Kopie · 2026-11-15 · `6b061b4`
- [x] W.13 Foto-Import über native Auswahl, 1–10 Seiten in einem Aufruf, Verkleinerung im Client (2000 px, Vorschau 320 px), `detail: "high"`, Grenze `/api/v1/ai/` 20 MB (inkl. Nacharbeit N1–N6; Messung mit synthetischen Seiten, Gerätetest nach Deploy) · 2026-11-15 · `da46b78`
- [x] W.25 Konfig-Härtung: `config.js` NetworkFirst ohne HTTP-Cache, `DB_PASSWORD` Pflicht ohne Vorgabe, DB-URL per `URL.create` (Sonderzeichen), Chunk-Fehler über `vite:preloadError` mit Schleifenschutz, keine SW-Aktivierung offline (inkl. Nacharbeit N1–N6) · 2026-11-15 · `3562451`
- [x] W.26 Backend-Warnungen (`distinct_on`, Alembic `path_separator`) und Test `_process_image` · 2026-11-15 · `1565edc`
- [x] W.27 `Administration.vue` in Abschnittskomponenten unter `components/admin/` aufgeteilt (669 → 44 Zeilen) · 2026-11-15 · `b39d1d5`
- [x] W.29 Undo/Redo als Composable `useEditHistory` mit Tests, `useDraft.spec.ts` räumt ab · 2026-11-15 · `1da343b`
- [x] W.28 Vorlage des Foto-Imports am Rezept: `recipe_images.kind` (photo/source, Migration 007), Titelbild nur aus Fotos, Seiten als Vorlage in Reihenfolge, Abschnitt „Vorlage“ in Detail und Bearbeitung, Sprung in die Bearbeitung, EXIF-Drehung; Mitnahmen: Rezept löschen entfernt Bilddateien, Navigation mit Backend-ID · 2026-11-16 · `c2cee7c`
- [x] W.30 `formatDate` zusammengeführt (leer → „—“), `db_password` nicht leer, Smoke-Test entkoppelt · 2026-11-16 · `c2cee7c`
- [x] W.23 Auth-Feinschliff: Login-Entscheidung zentral in `auth/session.ts` nach Zustandstabelle, `userManager.ts`, Callback-Sperre, Web Locks (Warten max. 15 s), Backoff, Login-Vormerkung, Tests (inkl. Nacharbeit N1–N5) · 2026-11-16 · `f759867`
- [x] W.32 Backend-Schnitt Bilder: `services/images.py`, `routes/admin_images.py` (images.py 497 → 223 Zeilen, OpenAPI unverändert), Löschfehler geloggt, Dateien erst nach dem Commit löschen, Migrationstest `kind = 'photo'` · 2026-11-16 · `e6235ab`
- [x] W.31 Auth-Nachzug nach W.23/W.28 (`loginFollows`, Backoff nach Lock-Timeout, Re-Export entfernt), `appendRecipe` mit Ergebnis `created`/`local`/`failed` ohne Duplikat, `dataSource` nur bei Cache-Daten, Importablauf in `useRecipeImport` · 2026-11-16 · `290d152`
- [x] W.9 Images in der CI bauen und nach `ghcr.io` pushen (Job `publish` nach allen Prüfungen, Tags SHA + `main`, `:main` nur vom Kopf, kein Abbruch auf `main`), Deploy per `docker compose pull && up -d`, Rollback über `IMAGE_TAG`, lokales Bauen über `docker-compose.build.yml`, `deploy.sh` entfernt, `.dockerignore` gehärtet (inkl. Nacharbeit N1–N3) · 2026-11-16 · `02803a2`
- [x] W.33 Client-UUID beim Anlegen (Backend `id` optional, 409, Nil-UUID 422), lokal angelegte Rezepte dauerhaft je Nutzer vorgemerkt und beim nächsten Laden übertragen, 409-Abgleich über den Ersteller mit PUT des vorgemerkten Stands, „Bitte neu anmelden“ statt lokaler Kopie, YAML-Import mit neuer UUID, `crypto.randomUUID` (inkl. Nacharbeit N1–N5) · 2026-11-17 · `6f81a06`
- [x] U.1 UX-Audit Rezeptansicht, Bearbeitung, Profil, Verwaltung (61 Befunde, Cognitive Walkthrough, Nielsen, Apple HIG, axe-core 4.14.1, 86 Screenshots) → `docs/plans/ux-audit.md`; blind gegen die Reizpunkte des PO abgeglichen: Detailbefunde vollständig, Konzeptfragen (Editor, Profil/Verwaltung, Modi) nicht abgedeckt → U.12, U.13 · 2026-11-17 · `30839f7`
- [x] W.15 Frontend-Majors: lint-staged 17.6.1, eslint 10.15.0 (direkt), js-yaml 5.5.0, @vueuse/core 15.0.0, pinia 4.1.0 (+ `@vue/devtools-api`), vite-plugin-pwa 2.0.0, bootstrap-vue-next 1.2.4 (Toast-Wrapper, `unchecked-value`), TypeScript 6.0.3 mit ES2022; Overrides entfernt · 2026-11-17 · `070b027`
