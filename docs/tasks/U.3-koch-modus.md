# Auftrag U.3: Koch-Modus – Kernfunktionen

> Erstellt 2026-11-18 vom Master · Roadmap: `ROADMAP.md` Punkt U.3 · Basis: `main@b98024f` · Aufwand: M · Modell: Opus

## Ziel
Die Rezeptansicht ist beim Kochen am iPhone und am Tablet zuverlässig bedienbar. Der aktuelle Abschnitt ist wirklich fokussiert, der Bildschirm bleibt an, ein Schritt lässt sich markieren, die Portionen sind leicht zu ändern, und das Zutaten-Sheet funktioniert. Neue Funktionen kommen nicht dazu (Notizen 6.1, Wizard 7.1).

## Erst lesen
1. `docs/plans/ux-audit.md` – Befunde R-01, R-02, R-05, R-06, R-07, R-10, R-11 mit Belegen und Screenshots; dazu X-03 (Touch-Ziele) und X-05 (Zoom), Abschnitt 10 „Was gut funktioniert“ (nicht verschlechtern) und Abschnitt 11 „Am Gerät prüfen“
2. `docs/plans/ui-roadmap-2025-26.md` – „Phase X: UX-Gesamtkonzept“ (Koch-Modus) und Sprint 1/2 (Split-View, Inline-Editing)
3. `.claude/rules/frontend.md` (u. a. Zoom-Sperre als bewusste Regel), `docs/DEVELOPMENT-GUIDELINES.md`
4. `components/recipe/display/RecipeDisplay.vue`, `IngredientsSection.vue`, `StepSection.vue`, `MobileIngredientsBar.vue`, Portionen-Steuerung, `views/Recipe.vue`, `index.html` (Viewport)

## Auftrag
1. **Erkundung (Checkpoint):**
   - Je Befund den Lösungsweg kurz skizzieren.
   - **R-01:** „Nur aktuell“ zeigt nur den aktiven Abschnitt; Zutaten anderer Abschnitte nicht als „verwaist“ voranstellen.
   - **R-05:** Wie wird ein Schritt markiert, und wie wirkt das auf den aktiven Abschnitt?
   - **R-02:** Wake Lock mit Schalter im ⋮-Menü, voreingestellt an.
   - **X-05:** Zoom freigeben und Doppeltipp-Zoom per `touch-action: manipulation` unterdrücken (Empfehlung des Audits). Alternative: Sperre lassen und eine Textgrößen-Einstellung einführen.
   - Vorlegen, dann anhalten.
2. **Umsetzen** nach Freigabe:
   - R-01, R-05, R-06, R-07, R-10, R-11
   - R-02 inkl. erneuter Anforderung nach `visibilitychange`; ohne API-Unterstützung nur ein Hinweis im Menü
   - X-05 nach Entscheidung
   - Touch-Ziele in den berührten Elementen mindestens 44 × 44 pt (X-03)
3. **Tests:**
   - **Vitest:**
     - Filter „Nur aktuell“ (welche Abschnitte und Zutaten)
     - Schritt markieren und Abschnittswechsel
     - Portionen: ohne Angabe, ±, Grenzen
     - Wake Lock: Anforderung, erneute Anforderung, Freigabe beim Verlassen; API gemockt, auch ohne Unterstützung
4. **Sichtprüfung** im Browser (Mock-IdP wie in W.23/U.1) iPhone und Tablet, hell und dunkel. Vorher/Nachher-Screenshots der Ansichten aus den Befunden. Rule `frontend.md` zur Zoom-Sperre nach der Entscheidung anpassen.

## Ablage
- Geändert: die Komponenten unter `components/recipe/display/`, `views/Recipe.vue`, `index.html`, ggf. `ProfileView.vue` (nur falls Textgröße gewählt wird), `.claude/rules/frontend.md`
- Wake Lock als Composable, z. B. `composables/useWakeLock.ts`, mit Spec

## Nicht in diesem Auftrag
- Notizen, Verarbeitung, HACCP, Info-Bereich, Zeiten, Schrittnummern (U.4)
- Teilen-Sheet, Kopfmenü (U.14); Dialog-Komponente (U.11); Farben und Kontraste der Tokens (U.10)
- Koch-Notizen (6.1), PDF (10.1)

## Entscheidungen, die ich treffe
- Am Checkpoint: Lösungsskizzen; Zoom (X-05): freigeben mit `touch-action: manipulation` (Empfehlung) oder Sperre plus Textgrößen-Einstellung.

## Fallstricke
- **Wake Lock auf iOS:** laut Audit (Quellen dort, nicht selbst geprüft) im Standalone-Modus erst ab iOS 18.4. Nur per Feature-Erkennung, ohne Rückfall-Tricks (z. B. kein stummes Video). Am Gerät prüfen gehört in die Szenarien für mich.
- **Split-View am Tablet (Sprint 1)** und Inline-Editing (Sprint 2) nicht brechen; `visibleDesktopSections` hat denselben Fehler wie R-01.
- **Portionen-Umrechnung:** Rundung auf 2 signifikante Stellen (Sprint 9) bleibt; nur die Bedienung ändert sich.
- **Parallel:** W.35 ändert `Recipe.vue` (Lösch-Knopf, Stern). Eigene Änderungen dort klein halten.
- **Design-Tokens** verwenden, keine neuen Bootstrap-Farben (X-02 wird mit U.10 bereinigt).

## Checkpoints
- Nach der Erkundung (Schritt 1): Lösungsskizzen und Zoom-Entscheidung vorlegen, dann anhalten.

## Abnahme
- Befunde R-01, R-02, R-05, R-06, R-07, R-10, R-11 behoben, je mit Vorher/Nachher-Screenshot; Zoom nach Entscheidung
- Touch-Ziele der berührten Elemente ≥ 44 pt (gemessen)
- Vitest aus Schritt 3 grün
- Szenarien für meine Prüfung am iPhone im Bericht (Wake Lock, Zoom, Sheet, Portionen)
- Verifikation gemäß Projekt-CLAUDE.md (Frontend)
