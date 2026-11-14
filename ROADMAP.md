# Roadmap my-cookbook

Stand: 2026-11-14 · Legende: `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt · `~~…~~` verworfen
Aufwand: XS ≲ 30 min · S ≲ 1 h · M ≈ 2–4 h · L ≈ 1 Tag+

Erledigt (Archiv): Sprints 0–3, UX-1 bis UX-7, Sprint 9 (Design-System) → [ui-roadmap-2025-26.md](docs/plans/ui-roadmap-2025-26.md)

## W — Wartung 🔜
Projektstandard, Altlasten, Qualitätssicherung und Zuverlässigkeit. Zuerst W.14, W.11 und W.4 parallel, W.12 nach W.4 (Format/SDK-Version), W.13 nach W.12 (gleiche Komponente), danach W.3 + W.19. W.16 nach W.11, W.15 nach W.11–W.13, W.21 nach W.15. W.4 vor dem nächsten Backend-Deploy (Versionen heute ungepinnt). Reihenfolge außerdem: W.4 vor dem Backend-Teil von W.5; W.9 nach W.3 und W.5; W.5 führt die Tests aus W.10 mit aus.
Erledigt (Archiv): W.1, W.2, W.4, W.6, W.7, W.8, W.11, W.14, W.16, W.17, W.18, W.20 → [roadmap-archiv.md](docs/roadmap-archiv.md)

- [ ] W.3 Instanzspezifische Defaults entfernen (IdP und Client-ID in `config.py`/`public/config.js`, StartURL in `index.html`) · S · Sonnet
- [ ] W.5 CI mit GitHub Actions: lint:check, typecheck, build, `npm audit --audit-level=high`; Backend nach W.4 · M · Sonnet
- [ ] W.9 Images per GitHub Actions bauen und nach `ghcr.io` pushen (öffentlich, Tags SHA + `main`), `deploy.sh` auf Pull umstellen · M · Sonnet
- [ ] W.10 Vitest einführen (`vitest`, `@vue/test-utils`, `happy-dom`), erste Tests für `js/` und `composables/` (Skalierung, Draft/Undo); vorher Mapper aus `recipeStore` nach `js/recipeMapping.ts` und `recipeApi.listAll`, Komponententests `Callback.vue`/`App.vue`; `saveSettings` speichert Kopie statt reaktivem Objekt, Tests für `isEqualPlain`/`deepCopyJSON` · M · Sonnet · [Bericht W.11](docs/tasks/W.11.bericht.md)
- [ ] W.12 AI-Import robust: Timeouts, 401-Retry, Fehlermeldungen, YAML-Parsing, Upload-Grenzen, Modell-IDs, Entscheidung Structured Outputs statt YAML · M · Sonnet · [Plan](docs/plans/zuverlaessigkeit-login-ai-import.md#w12-ai-import-robust)
- [ ] W.13 Foto im AI-Import über native Kamera/Fotoauswahl statt `getUserMedia`, Bilder clientseitig verkleinern · S–M · Sonnet · nach W.12 · [Plan](docs/plans/zuverlaessigkeit-login-ai-import.md#w13-foto-aufnahme-im-ai-import)
- [ ] W.15 Frontend-Majors: bootstrap-vue-next 1.x, vite-plugin-pwa 2 (Override und `--legacy-peer-deps` entfernen), pinia 4, vueuse 15, js-yaml 5, lint-staged 17; TypeScript auf 6.0 (`~6.0.3`), TS 7 als Ausnahme bis `vue-tsc` und `typescript-eslint` es unterstützen; `eslint` als direkte devDependency; `tsconfig` `target`/`lib` auf ES2022 · M–L · Sonnet · [Plan](docs/plans/abhaengigkeiten.md)
- [ ] W.19 Apple-Touch-Icon und PNG-Favicons in `index.html` einbinden (iOS-Homescreen) · XS · Sonnet · mit W.3
- [ ] W.21 PostgreSQL 16 → 18: Dump/Restore, Probelauf mit Kopie der Produktivdaten, Checkpoint vor dem Live-Schritt · M · Opus · nach W.15
- [ ] W.22 Service-Worker-Update steuern: kein sofortiges Neuladen mitten in der Sitzung, Update-Prüfung beim Vordergrundwechsel, toten Code in `main.ts` entfernen · S · Sonnet
- [ ] W.23 Auth-Feinschliff: Login-Entscheidung zentral in `session.ts`, `userManager` als eigenes Modul (löst Import-Zyklus); damit Login bei offline → online, Cache-Kurzschluss für `requireRole`, keine doppelte Erneuerung beim Resume, Hinweis statt leerem Bildschirm; Web Locks und Backoff, `silent-renew.html` entfernen; Unit-Tests für `session.ts` · S–M · Opus · nach W.12 und W.10 · [Plan](docs/plans/zuverlaessigkeit-login-ai-import.md#w23-auth-feinschliff)

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

## 12 — Offline-Bearbeitung
Rezepte auch ohne Netz anlegen und bearbeiten, Synchronisation beim Wiederverbinden. Zuletzt, nach allen anderen Abschnitten; setzt W.11 voraus.

- [ ] 12.1 Konzept: Änderungs-Warteschlange, Konflikte (bisher nur `updated_at`), IDs vom Client (Backend vergibt heute die ID), Bilder offline, Token-Ablauf offline; Ergebnis als Plan mit Umsetzungspunkten · M · Opus

## Später
- [ ] S.1 Rezept-Tracking serverseitig: „Zuletzt geöffnet“ je User, „Beliebt“ über alle → [IDEAS.md](docs/IDEAS.md#1-rezept-tracking-beliebt--zuletzt-geöffnet)
- [ ] S.2 Home zum Dashboard ausbauen („Beliebt“, „Zuletzt hinzugefügt“) → [IDEAS.md](docs/IDEAS.md#2-dashboard-statt-galerie)
- [ ] S.3 `root_path` über nginx ablösen (`proxy_pass` ohne `/api`, `uvicorn --root-path /api`, Warnungsfilter in `main.py` entfernen), erst wenn FastAPI den Parameter entfernt · S · Sonnet · [Bericht W.20](docs/tasks/W.20.bericht.md)
