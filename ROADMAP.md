# Roadmap my-cookbook

Stand: 2026-11-18 · Legende: `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt · `~~…~~` verworfen
Aufwand: XS ≲ 30 min · S ≲ 1 h · M ≈ 2–4 h · L ≈ 1 Tag+

Erledigt (Archiv): Sprints 0–3, UX-1 bis UX-7, Sprint 9 (Design-System) → [ui-roadmap-2025-26.md](docs/plans/ui-roadmap-2025-26.md)

## W — Wartung 🔜
Projektstandard, Altlasten, Qualitätssicherung und Zuverlässigkeit. Reihenfolge der offenen Punkte: W.40 vor W.39 (sonst zerstören alte PWA-Stände Wiederhergestelltes erneut), beide sofort; W.41 vor U.15 (Store, `Edit.vue`); W.21 frei (11.1 erledigt: vor dem Umzug Gesamtexport ziehen), nicht parallel zu W.39 (beide Produktiv-DB).
Erledigt (Archiv): W.1, W.2, W.3, W.4, W.5, W.6, W.7, W.8, W.9, W.10, W.11, W.12, W.13, W.14, W.15, W.16, W.17, W.18, W.19, W.20, W.22, W.23, W.25, W.26, W.27, W.28, W.29, W.30, W.31, W.32, W.33, W.34, W.35, W.36, W.37, W.38 → [roadmap-archiv.md](docs/roadmap-archiv.md)

- [ ] W.21 PostgreSQL 16 → 18: Dump/Restore als Skript (`scripts/pg-major-upgrade.sh`: Backup, Stopp, neues Volume auf `/var/lib/postgresql`, Restore, Gegenprüfung; altes Volume als Rückweg), Probelauf mit Kopie der Produktivdaten, Checkpoint vor dem Live-Schritt · M · Opus · nach W.39
- [ ] W.39 Durch Tag-Änderung beschädigte Rezepte wiederherstellen (Fehler seit v2.0.0 `01ab8fb`, 2026-04-12, behoben mit W.37): Skript gleicht Kandidaten (`ingredients` und `steps` leer, `updated_at` ≥ 2026-04-12) gegen einen gewählten `pg_dump` ab und stellt nur `data` wieder her, Tags bleiben; Trockenlauf-Bericht, Checkpoint vor dem Live-Schritt, ein Aufruf, Gegenprüfung · S · Opus · nach Deploy von W.37; Voraussetzung: Backups gesichert, Kandidatenliste vom PO
- [~] W.40 Backend als zweite Linie gegen leeres `data` (aus W.38): `PUT /v1/recipes/{id}` lehnt mit 422 ab, wenn `ingredients` und `steps` vorher gefüllt waren und beide leer würden (Alternative Merge verworfen: PUT bleibt Ersetzen); fängt alte, noch installierte PWA-Stände und Entwürfe von vor W.38 ab · S · Opus · vor W.39 · [Bericht W.38](docs/tasks/W.38.bericht.md) · 2026-11-18 · [Auftrag](docs/tasks/W.40-schutzlinie-und-harness.md)
- [~] W.41 Frontend-Kleinkram nach W.38: `Edit.vue` meldet bei fremd abgelehntem Rezept nicht „wird übertragen“ (`stillRejected` auswerten); `saveFailedMessage` kennt `IncompleteRecipeError`; vor `DELETE` eines nie übertragenen vorgemerkten Rezepts per GET Ersteller abgleichen (fremde UUID ohne Markierung) · S · Opus · [Bericht W.38](docs/tasks/W.38.bericht.md) · 2026-11-18 · [Auftrag](docs/tasks/W.40-schutzlinie-und-harness.md)
- [~] W.42 Screenshot-Harness wiederholbar ablegen (`frontend/scripts/shots/`: Mock-API, Seed für Sitzung und Vormerkung, iPhone hell/dunkel), seit U.1 mehrfach neu gebaut · S · Opus · Abhängigkeit `playwright-core` freigegeben · 2026-11-18 · [Auftrag](docs/tasks/W.40-schutzlinie-und-harness.md)

## U — UX-2
Bewertung und Verbesserung der Bedienung in Rezeptansicht, Bearbeitung, Profil und Verwaltung. Grundlage: [Audit](docs/plans/ux-audit.md) (61 Befunde, IDs in Klammern). Reihenfolge: U.13 (Konzept, ohne Code) sofort; U.4, U.10 und U.11 frei (U.4 nicht parallel zu U.16, beide Rezeptansicht); nach U.13 U.5 → U.6; nach W.38 U.15, danach U.8 und U.9 (U.9 nach 11.1, vor 11.2); danach U.14, U.7. Touch-Ziele (X-03) je Ansicht im jeweiligen Punkt. Offene Entscheidungen beim Zuschnitt: Schrittnummern (R-13) und Zeiten als Zahl (R-08, bei U.4), Glossar (X-06, bei U.10).
Erledigt (Archiv): U.1, U.3, U.12 → [roadmap-archiv.md](docs/roadmap-archiv.md)

- [ ] U.16 Wake Lock in geteilten Rezepten (`SharedRecipe.vue`, `useWakeLock` aus U.3); Entscheidung beim Zuschnitt: immer an oder eigener Schalter · XS–S · Opus · [Bericht U.3](docs/tasks/U.3.bericht.md)
- [ ] U.4 Rezeptinhalt vollständig: Notizen/Verarbeitung/HACCP (R-03), Info-Bereich statt ⓘ (R-04), Zeiten-Anzeige (R-08), unbekanntes Rezept (R-09), Schrittnummern (R-13), ohne Bild (R-14) · S–M · Opus · nach U.3
- [ ] U.5 Editor: Verlassen mit Rückfrage (E-01), Kopfleiste (E-02), Mengen (E-04), Abschnitt löschen (E-06), Begriffe (E-07), Tag-Feld (E-08), E-09–E-11 · M · Opus · nach U.13
- [ ] U.6 Editor mobil: Zielgrößen und Zeilenhöhe (E-03), Zutatzeile (E-05), 16-px-Eingaben (X-07) · M · Opus · nach U.5
- [ ] U.7 KI-Import glätten: Fortschritt (A-03), Seitenreihenfolge (A-04); A-02 nur abgestimmt mit 7.1 · S · Opus
- [ ] U.8 Profil nach [Konzept](docs/plans/konzept-profil-verwaltung.md) 3.1: Name und E-Mail (`/me` um `email` erweitern, E7), Rolle deutsch/`pending` (P-03), Darstellung „dieses Gerät“, Zeile „Verwaltung“ mit Untertitel (P-05) und Zähler wartender Nutzer, auch am Profil-Tab (P-04, E8, ohne Mail); P-01 entfällt mit U.15 · S · Opus · nach U.15
- [ ] U.9 Verwaltung nach [Konzept](docs/plans/konzept-profil-verwaltung.md) 3.2/4: Nutzer mobil mit Rückfrage bei Herabstufung (V-02), Dunkelmodus (V-03), Wartung mit Rückfragen (V-04), Gliederung (V-05), Zurück (V-06), Freigaben mit Link und Max. Laufzeit (V-07); Rezeptliste, „Neues Rezept“, „Beispielrezept“, IndexedDB-„Speichern“ entfernen (E5); sofort speichern, nur KI-Modelle per „Speichern und prüfen“ (E9). Eine Seite mit gegliederten Abschnitten statt Unterseiten, Zähler springt per Anker zu „Nutzer“, abgelaufene Freigaben eingeklappt (E4); externe Bild-URLs: Hinweis „Bild nur verlinkt“ mit „Bild übernehmen“ für Bearbeiter (Editor oder ⋮-Menü, nicht Leseansicht), Wartung zeigt die Anzahl und blendet den Sammelknopf bei 0 aus (E6; Download scheitert auch bei neuen Importen, `recipes.py` `_auto_download_imageurl`) · S–M · Opus · nach U.15
- [ ] U.10 Design-Tokens und Begriffe: Kontraste (X-01), Bootstrap-Farben (X-02), Glossar (X-06), `theme_color` (X-10), Platzhalter dunkel (H-07) · S–M · Opus · nach W.15
- [ ] U.11 Gemeinsame Dialog- und Sheet-Komponente mit Fokus/Escape (X-04), eigene Bestätigungsdialoge statt `confirm()` (X-08) · M · Opus · nach W.15
- [ ] U.15 Rolle statt Schalter ([Konzept](docs/plans/konzept-profil-verwaltung.md) 2, 6.1; E1 C, E2 B, E3): „Nur lesen“ streichen, `canEdit` aus der Rolle an den 9 Stellen; `me.py` leitet `read_only` immer aus der Rolle ab (behebt: gespeicherter Wert schlägt Rolle), Test herab-/hochgestuft; Experten-Modus streichen: YAML-Export im ⋮-Menü für Bearbeiter, Rohantwort KI-Import nur Admin, „YAML anzeigen“ im Editor weg, YAML-Import im FAB weg; YAML-Import der Verwaltung bleibt bis 11.2 für Admins ohne Schalter; ⋮-Menü der Rezeptansicht für alle Rollen (Schalter „Bildschirm anlassen“ aus U.3), Bearbeiten-Einträge nach Recht · S · Opus · nach W.38 (`Recipe.vue`)
- [ ] U.13 Konzept Editor für Gelegenheitsnutzer: Gegenentwurf mit Skizzen (Abschnitte anlegen, Zutatzeile, Tag-Feld, Kopfleiste); Entscheidungsvorlage, kein Code · M · Opus
- [ ] U.14 Karten, Tags und Semantik: Tag-Bedienung in der Übersicht touch-tauglich (Abgleich PO), Demo-Rezept (H-04), Kartenmenü/FAB (H-05), Karten barrierefrei (H-06), Seitenstruktur (X-09), Teilen-Sheet (R-12), Kopfmenü (R-15) · S–M · Opus · nach U.11

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
Erledigt (Archiv): 11.1 → [roadmap-archiv.md](docs/roadmap-archiv.md)

- [ ] 11.2 Import aus ZIP mit Konfliktwahl, Einzel-Import (YAML) auf UUID-Logik; Ort: Verwaltung „Export und Import“ ([Konzept](docs/plans/konzept-profil-verwaltung.md) 6.4), ersetzt den YAML-Import aus U.15; IndexedDB-„Speichern“ entfernt U.9 ; nginx: eigene `location` für den Import mit großem `client_max_body_size` (heute 10M für `/api/`) und längeren Timeouts, Gesamtexport ist schnell mehrere hundert MiB (Bericht 11.1) · M · Opus · nach U.9

## 12 — Offline-Bearbeitung
Rezepte auch ohne Netz anlegen und bearbeiten, Synchronisation beim Wiederverbinden. Zuletzt, nach allen anderen Abschnitten; setzt W.11 voraus.

- [ ] 12.1 Konzept: Änderungs-Warteschlange, Konflikte (bisher nur `updated_at`), IDs vom Client (Backend vergibt heute die ID), Bilder offline, Token-Ablauf offline; Ergebnis als Plan mit Umsetzungspunkten · M · Opus

## Später
- [ ] S.1 Rezept-Tracking serverseitig: „Zuletzt geöffnet“ je User, „Beliebt“ über alle → [IDEAS.md](docs/IDEAS.md#1-rezept-tracking-beliebt--zuletzt-geöffnet)
- [ ] S.2 Home zum Dashboard ausbauen („Beliebt“, „Zuletzt hinzugefügt“) → [IDEAS.md](docs/IDEAS.md#2-dashboard-statt-galerie)
- [ ] S.3 `root_path` über nginx ablösen (`proxy_pass` ohne `/api`, `uvicorn --root-path /api`, Warnungsfilter in `main.py` entfernen), erst wenn FastAPI den Parameter entfernt · S · Sonnet · [Bericht W.20](docs/tasks/W.20.bericht.md)
