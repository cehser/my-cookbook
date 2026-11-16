# Roadmap my-cookbook

Stand: 2026-11-15 · Legende: `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt · `~~…~~` verworfen
Aufwand: XS ≲ 30 min · S ≲ 1 h · M ≈ 2–4 h · L ≈ 1 Tag+

Erledigt (Archiv): Sprints 0–3, UX-1 bis UX-7, Sprint 9 (Design-System) → [ui-roadmap-2025-26.md](docs/plans/ui-roadmap-2025-26.md)

## W — Wartung 🔜
Projektstandard, Altlasten, Qualitätssicherung und Zuverlässigkeit. Zuerst W.14, W.11 und W.4 parallel, W.12 nach W.4 (Format/SDK-Version), W.13 nach W.12 (gleiche Komponente), danach W.3 + W.19. W.16 nach W.11, W.15 nach W.11–W.13, W.21 nach W.15. W.4 vor dem nächsten Backend-Deploy (Versionen heute ungepinnt). Reihenfolge außerdem: W.4 vor dem Backend-Teil von W.5; W.9 nach W.3 und W.5; W.5 sofort möglich, W.10 hängt seine Tests danach in die CI ein. W.28 nach W.13 (gleiche Komponente) und W.26 (gleiche Bildabfrage).
Erledigt (Archiv): W.1, W.2, W.3, W.4, W.5, W.6, W.7, W.8, W.9, W.10, W.11, W.12, W.13, W.14, W.16, W.17, W.18, W.19, W.20, W.22, W.23, W.25, W.26, W.27, W.28, W.29, W.30, W.31, W.32 → [roadmap-archiv.md](docs/roadmap-archiv.md)

- [ ] W.15 Frontend-Majors: bootstrap-vue-next 1.x, vite-plugin-pwa 2 (Override entfernen), pinia 4, vueuse 15, js-yaml 5, lint-staged 17; TypeScript auf 6.0 (`~6.0.3`), TS 7 als Ausnahme bis `vue-tsc` und `typescript-eslint` es unterstützen; `eslint` als direkte devDependency; `tsconfig` `target`/`lib` auf ES2022 · M–L · Sonnet · [Plan](docs/plans/abhaengigkeiten.md)
- [ ] W.21 PostgreSQL 16 → 18: Dump/Restore, Probelauf mit Kopie der Produktivdaten, Checkpoint vor dem Live-Schritt · M · Opus · nach W.15
- [~] W.33 `POST /recipes` übernimmt die UUID des Clients (409 bei Kollision): gleiche ID in Client und Backend, Wiederholung legt nichts doppelt an, Grundlage für Offline-Anlage · M · Opus · vor 12.1 · 2026-11-16 · [Auftrag](docs/tasks/W.32-backend-bilder-client-uuid.md) · Backend `e6235ab` · Rest: Frontend, lokale Rezepte vormerken und übertragen, 401-Fall, Backend-Kleinkram · M–L · Opus · 2026-11-16 · [Auftrag](docs/tasks/W.33-client-uuid-lokale-rezepte.md) · Nacharbeit N1–N5 offen · [Bericht W.31](docs/tasks/W.31.bericht.md)
- [ ] W.34 Rezeptkarten kennzeichnen „nur auf diesem Gerät“, solange ein Rezept vorgemerkt oder abgelehnt ist (`pendingCreates`) · S · Opus · nach W.33 · [Bericht W.33](docs/tasks/W.33.bericht.md)

## 5 — Einkaufsliste-Export
Zutaten eines Rezepts als Einkaufsliste per Clipboard und Native Share. Plan: [ui-roadmap-2025-26.md](docs/plans/ui-roadmap-2025-26.md#sprint-5-einkaufsliste-export-1-2-tage--quick-win)

- [ ] 5.1 Einkaufsliste-Export · M · Opus · wartet auf die offizielle pon-API ([developers.pon.app](https://developers.pon.app/de/), Stand 2026-11-15: „Bald verfügbar“, keine Funktionen oder Termin genannt); Zuschnitt erst mit veröffentlichter API

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
