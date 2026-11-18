# Auftrag U.13: Konzept Editor für Gelegenheitsnutzer

> Erstellt 2026-11-18 vom Master · Roadmap: `ROADMAP.md` Punkt U.13 · Basis: `main@dffd720` · Aufwand: M · Modell: Opus

## Ziel
Eine Entscheidungsvorlage, wie der Rezept-Editor für Gelegenheitsnutzer aussehen soll: Familienmitglieder, die ein paarmal im Jahr ein Rezept erfassen oder korrigieren, meist am iPhone. Es entsteht ein Gegenentwurf zum heutigen Editor mit Skizzen und Optionen. Grundlage für U.5 (Editor) und U.6 (Editor mobil). Kein Code.

## Erst lesen
1. `docs/plans/ux-audit.md`:
   - Personas und Kernaufgaben (2), Walkthrough K4 bis K6
   - Befunde E-01 bis E-11 und A-01 bis A-04 (5.4)
   - X-03 und X-07 (Ziele, 16-px-Eingaben)
   - Screenshots `docs/plans/ux-audit/*edit*`, `*ai-import*`
2. `docs/plans/ui-roadmap-2025-26.md`: Editor-Grundsätze („Kein separates Inline-Edit. Nur Full-Editor.“) und Sprint 7 Rezept-Wizard (Roadmap 7.1)
3. `docs/plans/konzept-profil-verwaltung.md` als Vorbild für Aufbau und Tiefe; Abschnitt 2.2 (YAML im Editor entfällt mit U.15)
4. Code:
   - `frontend/src/views/Edit.vue`
   - `components/edit/*` (`SectionCard`, `IngredientRow`, `StepRow`, `InlineEditField`)
   - `js/recipeSections.ts`
   - `types/recipe.ts`
   - Entwurf und Speichern: `.claude/rules/frontend.md`, Absätze Entwurf und Speichern
5. Backend-Modell der Rezeptdaten: `backend/app/schemas/recipe.py` (`RecipeData`, `Ingredient`, `Step`, `Section`, `normalize_recipe_data`)

## Auftrag
1. **Bestandsaufnahme** in einer Tabelle, je Bedienelement des Editors:
   - was es tut
   - wie oft ein Gelegenheitsnutzer es braucht
   - Zielgröße am iPhone
   - zugehöriger Audit-Befund

   Bereiche: Kopfleiste, Metadaten, Bild, Abschnitte, Zutaten, Schritte, Tags, Entwurf, Vorschau. Dazu die Datenstruktur dahinter: Wie hängen Zutaten und Schritte an Abschnitten, und was erzwingt das Modell?
2. **Gegenentwurf** für die vier Reizpunkte des PO, je 2–3 Optionen mit Folgen für Nutzer, Code und Datenmodell und mit Empfehlung:
   - **Abschnitte anlegen:** Wann braucht ein Rezept Abschnitte, wie legt man sie an, benennt sie um, verschiebt sie und löscht sie? Gilt ein Rezept ohne Abschnitte als Normalfall?
   - **Zutatzeile:** Reihenfolge Menge, Einheit, Name; Eingabe als ein Textfeld mit Zerlegung oder als getrennte Felder; Notiz; Löschen ohne 18 rote Papierkörbe (E-03, E-05); Brüche und Komma (E-04).
   - **Tag-Feld:** Tags im Editor bearbeiten (E-08), Vorschläge aus vorhandenen Tags, Abgleich mit der Tag-Bedienung an der Karte (U.14).
   - **Kopfleiste:** Speichern, Verwerfen, Abbrechen, Vorschau (E-01, E-02); Verlassen mit Rückfrage; wie der Entwurf (W.29) sichtbar wird.
3. **Skizzen** für iPhone als ASCII bzw. Markdown, mindestens:
   - Editor oben (Kopfleiste, Titel, Bild)
   - Zutaten in einem Abschnitt
   - Schritte
   - Tags
   - Rückfrage beim Verlassen
4. **Abgrenzung zu verwandten Punkten:**
   - Rezept-Wizard 7.1: Ersetzt der Gegenentwurf den Wizard, ergänzt er ihn oder macht er ihn überflüssig?
   - KI-Import: Der Editor nach dem Import nutzt dieselbe Ansicht (A-01 bis A-04).
   - Offline-Bearbeitung 12.1: Was ändert sich am Konzept, falls sie kommt?
5. **Ergebnis** `docs/plans/konzept-editor.md`:
   - Bestandsaufnahme, Optionen mit Empfehlung, Skizzen
   - Liste der Entscheidungen für mich, je mit Empfehlung
   - Folgen für U.5 und U.6: neuer Zuschnitt, Aufwand, neue oder entfallende Befunde. Bei Bedarf ein Vorschlag, U.5 und U.6 anders zu schneiden, z. B. nach Bereichen statt nach Desktop und mobil.
   - Folgen für 7.1, U.14 und gegebenenfalls das Datenmodell. Muss das Modell geändert werden, braucht es eine Migration; dann als eigenen Punkt vorschlagen.

## Ablage
- Neu: `docs/plans/konzept-editor.md`. Vorhandene Screenshots aus `docs/plans/ux-audit/` verlinken. Neue Screenshots nur, wenn nötig, per `npm run shots` (Rule `screenshots.md`).

## Nicht in diesem Auftrag
- Umsetzung (U.5, U.6)
- YAML-Funktionen im Editor (entfallen mit U.15)
- KI-Import-Ablauf außerhalb des Editors (U.7)
- Speicher- und Entwurfslogik ändern (W.29, W.37, W.38 bleiben maßgeblich)

## Entscheidungen, die ich treffe
- Nach dem Bericht: die Optionen aus Schritt 2 und die Abgrenzung zu 7.1.

## Fallstricke
- **Datenmodell:** Zutaten und Schritte tragen ihren Abschnitt als Feld (`section`). `sections` füllt `ensure_sections` im Backend mit einem leeren Abschnitt auf. Ein Entwurf „Rezept ohne Abschnitte“ muss zu diesem Modell passen oder die Änderung ausdrücklich vorschlagen. Alte Rezepte und der YAML- bzw. ZIP-Austausch (11.1, `docs/plans/export-import.md`) müssen weiter gelesen werden können.
- **Speichern ist abgesichert:** Seit W.38 und W.40 kann eine unvollständige Fassung nicht gespeichert werden, und der Server lehnt mit 422 ab, wenn Zutaten und Schritte gemeinsam geleert würden. Eine Rückfrage beim Verlassen darf den Entwurf (W.29) nicht verwerfen, ohne dass der Nutzer das bestätigt.
- **Abgleich mit dem PO:** Der Punkt entstand aus dessen Reizpunkten: Abschnitte anlegen, Zutatzeile, Tag-Feld, Kopfleiste. Das ist der Anlass. Andere Befunde aus dem Audit dürfen dadurch nicht verdrängt werden.
- **Parallel läuft U.15** und ändert `Edit.vue` minimal („YAML anzeigen“ entfällt). Das Konzept bezieht sich auf den Stand nach U.15.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `docs/plans/konzept-editor.md` mit:
  - Bestandsaufnahme
  - Optionen mit Empfehlung zu den vier Reizpunkten
  - Skizzen
  - Abgrenzung zu 7.1, U.7, U.14 und 12.1
  - Entscheidungsliste
  - Folgen für U.5 und U.6
- Keine Änderungen außerhalb von `docs/plans/konzept-editor.md`, gegebenenfalls neuer Screenshots darunter und des Berichts
