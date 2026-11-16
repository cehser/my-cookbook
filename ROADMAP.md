# Roadmap my-cookbook

Stand: 2026-11-15 · Legende: `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt · `~~…~~` verworfen
Aufwand: XS ≲ 30 min · S ≲ 1 h · M ≈ 2–4 h · L ≈ 1 Tag+

Erledigt (Archiv): Sprints 0–3, UX-1 bis UX-7, Sprint 9 (Design-System) → [ui-roadmap-2025-26.md](docs/plans/ui-roadmap-2025-26.md)

## W — Wartung 🔜
Projektstandard, Altlasten, Qualitätssicherung und Zuverlässigkeit. Reihenfolge der offenen Punkte: W.33 abschließen; W.15 und W.34 nach W.33 (gleiche Dateien in Store und Composables); W.21 nach 11.1 (vollständiger Export inkl. Bilder vor dem Umzug), W.15 und W.21 nacheinander, nicht parallel (beide Build/Deploy).
Erledigt (Archiv): W.1, W.2, W.3, W.4, W.5, W.6, W.7, W.8, W.9, W.10, W.11, W.12, W.13, W.14, W.16, W.17, W.18, W.19, W.20, W.22, W.23, W.25, W.26, W.27, W.28, W.29, W.30, W.31, W.32, W.33 → [roadmap-archiv.md](docs/roadmap-archiv.md)

- [ ] W.15 Frontend-Majors: bootstrap-vue-next 1.x, vite-plugin-pwa 2 (Override entfernen), pinia 4, vueuse 15, js-yaml 5, lint-staged 17; TypeScript auf 6.0 (`~6.0.3`), TS 7 als Ausnahme bis `vue-tsc` und `typescript-eslint` es unterstützen; `eslint` als direkte devDependency; `tsconfig` `target`/`lib` auf ES2022 · M–L · Opus · nach W.33 · [Plan](docs/plans/abhaengigkeiten.md)
- [ ] W.21 PostgreSQL 16 → 18: Dump/Restore als Skript (`scripts/pg-major-upgrade.sh`: Backup, Stopp, neues Volume auf `/var/lib/postgresql`, Restore, Gegenprüfung; altes Volume als Rückweg), Probelauf mit Kopie der Produktivdaten, Checkpoint vor dem Live-Schritt · M · Opus · nach 11.1
- [ ] W.34 Rezeptkarten kennzeichnen „nur auf diesem Gerät“, solange ein Rezept vorgemerkt oder abgelehnt ist (`pendingCreates`) · S · Opus · nach W.33 · [Bericht W.33](docs/tasks/W.33.bericht.md)
- [ ] W.35 Nachzug W.33: vorgemerktes, aber schon übertragenes Rezept löschen sendet trotzdem `DELETE` (404 ignorieren); ohne `sub` nicht vormerken („Bitte anmelden“); Ersteller-Abgleich `sub`/`created_by` als UUID normalisiert; PUT-Ablehnung nach Anlage nicht als „nicht angelegt“ melden; IDB-Lesefehler bei vorgemerktem Rezept; Löschen während `settle`; Fehler aus `currentUserSub()` abfangen; Backend: Editoren dürfen eigene Rezepte löschen (`created_by` = `sub`), Admins alle (Entscheidung 2026-11-17), mit Test · S–M · Opus · [Bericht W.33](docs/tasks/W.33.bericht.md)

## U — UX-2
Bewertung und Verbesserung der Bedienung in Rezeptansicht, Bearbeitung, Profil und Verwaltung. Audit blind (ohne Vorwissen), Abgleich mit den Reizpunkten des Product Owners erst beim `/done`; Befunde werden danach je Ansicht zu Punkten gebündelt.

- [~] U.1 UX-Audit: Kernaufgaben und Personas (Cognitive Walkthrough), Nielsen-Heuristiken, Apple HIG, WCAG 2.2 AA, Screenshots iPhone/Tablet → `docs/plans/ux-audit.md` · M · Opus · 2026-11-17 · [Auftrag](docs/tasks/U.1-ux-audit.md)

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

- [~] 11.1 Gesamtexport als ZIP (Rezepte, Tags, Bilder) · M · Opus · 2026-11-17 · [Auftrag](docs/tasks/11.1-gesamtexport-zip.md)
- [ ] 11.2 Import aus ZIP mit Konfliktwahl, Einzel-Import auf UUID-Logik, IndexedDB-„Speichern“ entfernen · M · Opus · nach 11.1

## 12 — Offline-Bearbeitung
Rezepte auch ohne Netz anlegen und bearbeiten, Synchronisation beim Wiederverbinden. Zuletzt, nach allen anderen Abschnitten; setzt W.11 voraus.

- [ ] 12.1 Konzept: Änderungs-Warteschlange, Konflikte (bisher nur `updated_at`), IDs vom Client (Backend vergibt heute die ID), Bilder offline, Token-Ablauf offline; Ergebnis als Plan mit Umsetzungspunkten · M · Opus

## Später
- [ ] S.1 Rezept-Tracking serverseitig: „Zuletzt geöffnet“ je User, „Beliebt“ über alle → [IDEAS.md](docs/IDEAS.md#1-rezept-tracking-beliebt--zuletzt-geöffnet)
- [ ] S.2 Home zum Dashboard ausbauen („Beliebt“, „Zuletzt hinzugefügt“) → [IDEAS.md](docs/IDEAS.md#2-dashboard-statt-galerie)
- [ ] S.3 `root_path` über nginx ablösen (`proxy_pass` ohne `/api`, `uvicorn --root-path /api`, Warnungsfilter in `main.py` entfernen), erst wenn FastAPI den Parameter entfernt · S · Sonnet · [Bericht W.20](docs/tasks/W.20.bericht.md)
