# Auftrag U.1: UX-Audit von Rezeptansicht, Bearbeitung, Profil und Verwaltung

> Erstellt 2026-11-17 vom Master · Roadmap: `ROADMAP.md` Punkt U.1 · Basis: `main@48eb468` · Aufwand: M · Modell: Opus

## Ziel
Eine begründete, priorisierte Liste von UX-Befunden für die Hauptansichten, gemessen an anerkannten Kriterien und am bestehenden UX-Konzept. Das Ergebnis ist die Grundlage für die nächsten UX-Aufträge. Es wird kein Produktivcode geändert. Das Audit läuft ohne Vorwissen: Es gibt keine Liste bekannter Probleme, alle Ansichten im Umfang werden gleich gründlich geprüft.

## Erst lesen
1. `docs/plans/ui-roadmap-2025-26.md`:
   - „Phase X: UX-Gesamtkonzept“: Usability-Ziele, Modi, Bottom Nav
   - „Sprint 9: Design-System“
   - Abschnitte zu Koch-Ansicht und Editor (Sprints 1–3)
   - Das ist der Maßstab. Wo das Audit davon abweichen will, begründet es das.
2. `docs/DEVELOPMENT-GUIDELINES.md`, `.claude/rules/frontend.md`
3. Frontend:
   - Ansichten unter `frontend/src/views/`, also `Recipe.vue`, `Edit.vue`, `ProfileView.vue`, `Administration.vue`, `HomeView.vue`
   - Komponenten unter `components/recipe/`, `components/admin/`, `components/layout/`
   - Design-Tokens in den Styles
4. `docs/tasks/W.23.bericht.md`, Abschnitt „Verifikation“: dort ist beschrieben, wie der Build mit einem Mock-IdP und `playwright-core` im Browser angesteuert wurde.

## Auftrag
1. **Erkundung (Checkpoint):**
   - Kernaufgaben festlegen, 6–10 Stück, z. B. Rezept nachkochen, Foto-Rezept importieren und korrigieren, Rezept bearbeiten, Rezept wiederfinden, Einstellungen ändern, Nutzer freischalten.
   - 3 Personas festlegen, z. B. gelegentliche Köchin am iPhone, Editor mit vielen Importen, Admin.
   - Den Weg zu Screenshots klären und vorlegen, siehe Fallstricke.
   - Dann anhalten.
2. **Screenshots** der Ansichten im Umfang, im iPhone-Format (390 × 844, DPR 3) und zusätzlich im Tablet-Querformat (1180 × 820). Hell und dunkel, mit realistischen Testdaten: ein langes Rezept mit Abschnitten, eines mit Vorlage, eines ohne Bild. Ablage unter `docs/plans/ux-audit/`.
3. **Cognitive Walkthrough:** jede Kernaufgabe je passender Persona Schritt für Schritt. An jedem Schritt vier Fragen:
   - Erkennt die Person die richtige Aktion?
   - Passt die Bezeichnung?
   - Ist die Rückmeldung verständlich?
   - Kommt die Person weiter?
4. **Heuristische Prüfung** je Ansicht:
   - die 10 Heuristiken nach Nielsen
   - iOS-Regeln aus den Apple Human Interface Guidelines: Touch-Ziele, Daumenreichweite, Safe Areas, Tastaturtypen, Navigation, Gesten
   - Formular-UX für die Bearbeitung
   - Küchentauglichkeit der Rezeptansicht: Lesbarkeit, Bedienung mit einer Hand, Bildschirm bleibt an, Zutaten und Schritt gleichzeitig sichtbar
5. **Barrierefreiheit:** WCAG 2.2 AA mit axe-core bzw. Lighthouse auf den gerenderten Ansichten; dazu von Hand Kontraste der Tokens, Fokusreihenfolge und Beschriftungen.
6. **Ergebnis** `docs/plans/ux-audit.md`:
   - Je Befund: Ansicht, Aufgabe bzw. Heuristik, Beschreibung, Beleg (Screenshot oder Code-Stelle), Schweregrad 0–4 nach Nielsen, Vorschlag, Aufwand XS–L.
   - Sortiert nach Ansicht, dann nach Schweregrad.
   - Am Ende ein Vorschlag, wie die Befunde zu Roadmap-Punkten gebündelt werden, je Ansicht ≤ M.
   - Dazu eine Liste, was gut funktioniert und nicht geändert werden sollte.

## Ablage
- Neu: `docs/plans/ux-audit.md`, `docs/plans/ux-audit/*.png` (Screenshots, komprimiert, insgesamt < 10 MB)
- Hilfsskripte (Mock-IdP, Mock-API, Playwright) nur im Scratchpad, keine Projektabhängigkeiten

## Nicht in diesem Auftrag
- Änderungen an Produktivcode, Styles oder Texten, auch keine „schnellen“ Korrekturen
- Neue Abhängigkeiten im Projekt
- Galerie, Suche und Favoriten, nur soweit eine Kernaufgabe sie berührt
- Geteilte Rezepte (`SharedRecipe.vue`), Login-Ablauf

## Entscheidungen, die ich treffe
- Am Checkpoint: Kernaufgaben, Personas und der Weg zu den Screenshots.

## Fallstricke
- **Login für Screenshots:** Echte Zugangsdaten sind tabu, die `.env` darf nicht gelesen werden. Möglich ist der Weg aus W.23: den Build über einen eigenen Node-Server mit Mock-IdP ausliefern, dazu eine Mock-API mit Fixture-Daten für `/api/v1/…`. Alternativ der lokale Stack mit einem Testnutzer, falls sich das ohne Geheimnisse einrichten lässt. Am Checkpoint vorlegen. `playwright-core` nur im Scratchpad, wie in W.23.
- **Screenshots ersetzen kein Gerät:** Safe Areas, Tastatur und Verhalten im Standalone-Modus der iOS-PWA lassen sich im Desktop-Browser nur annähern. Befunde, die nur auf dem Gerät prüfbar sind, als „am Gerät prüfen“ markieren statt sie zu behaupten.
- **Keine Doppelungen mit offenen Punkten:** 5.1, 6.1 (Koch-Notizen), 7.1 (Wizard), 10.1 (PDF) und W.34 (Kennzeichnung lokaler Rezepte) sind schon geplant. Befunde dazu als Hinweis an den bestehenden Punkt, nicht als neuen Vorschlag.
- **Schweregrade ehrlich vergeben:** Geschmacksfragen bekommen Schweregrad 1 und eine Begründung, kein Gewicht.
- **Parallel laufen W.33 und 11.1**, beide ändern Frontend-Dateien. Das Audit prüft den Stand von `main` zum Zeitpunkt des Starts und nennt die Basis im Ergebnis.

## Checkpoints
- Nach der Erkundung: Kernaufgaben, Personas und Weg zu den Screenshots vorlegen, dann anhalten.

## Abnahme
- `docs/plans/ux-audit.md` mit Befunden im Format aus Schritt 6, Belege je Befund, Bündelungsvorschlag und Liste der Stärken
- Screenshots aller Ansichten im Umfang (iPhone, Tablet, hell und dunkel)
- Ergebnis der Prüfung auf Barrierefreiheit mit Werkzeug und Version
- Keine Änderungen außerhalb von `docs/plans/ux-audit*`
