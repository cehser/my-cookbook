# Bericht U.3: Koch-Modus – Kernfunktionen

> Branch `worktree-U.3-koch-modus` · Basis `66a2125` (= `b98024f` + `docs(roadmap)`) · Stand `2b12ec2` · 2026-11-18 · Dauer: 08:59 – 11:16 (137 min, davon Warten an Checkpoints 106 min) · Status: fertig

## Ergebnis
Die Befunde R-01, R-02, R-05, R-06, R-07, R-10 und R-11 sind behoben:
- **„Nur aktuell“** zeigt am iPhone und am Tablet genau den aktiven Abschnitt.
- **Schritte** lassen sich antippen und markieren. Der markierte Schritt bestimmt den aktiven Zutatenabschnitt.
- **Bildschirm:** Die Rezeptansicht hält ihn per Wake Lock an. Der Schalter sitzt im ⋮-Menü und ist voreingestellt an.
- **Portionen** stehen in der Leiste nur noch als Anzeige. Bedient werden sie im Sheet mit 44-px-Zielen. Ohne Portionsangabe gilt 1 Portion als Basis.
- **Zutaten-Sheet:** Es schließt per Hintergrund und Escape. Die Abschnitts-Chips sind lesbar und funktionieren.

Pinch-Zoom ist wieder freigegeben (X-05). Den Doppeltipp-Zoom unterdrückt `touch-action: manipulation`, Eingaben auf Touch-Geräten haben 16 px.

Nebenbei behoben: Die Editor-Vorschau änderte beim Antippen von ± Portionen und Mengen des Entwurfs. Jetzt wird nur noch für die Anzeige umgerechnet.

## Commits
- `ad6afb0` feat(frontend): Bildschirm im Koch-Modus anlassen (Wake Lock)
- `3d6ccdc` fix(frontend): Pinch-Zoom freigeben, Doppeltipp-Zoom unterdrücken
- `85926ab` fix(frontend): Koch-Modus der Rezeptansicht überarbeiten
- `61ef160` fix(frontend): Umschalter und Menü-Schalter mit Tokens, Sprung bei „Alle“
- `ea5dff4` docs(frontend): Zoom, Koch-Modus und Laufwerksbuchstaben-Falle in Regeln
- (dieser Bericht) docs(roadmap): Abschlussbericht U.3

## Verifikation
- `npm run lint:check && npm run typecheck && npm test && npm run build` (aus `C:`, siehe Struktur und Doku) → grün. Ergebnis: 31 Testdateien, 279 Tests in 3,01 s; Build in 571 ms. Lauf von 11:14:22 bis 11:14:47.
- Neue Specs, alle grün:
  - `js/recipeSections.spec.ts` (5): Filter „Nur aktuell“, verwaiste Zutaten, Fallback auf den ersten Abschnitt, aktiver Abschnitt ohne Zutaten
  - `composables/usePortions.spec.ts` (7): ohne Angabe, ±, Grenzen 1/100, `recalc_exp`, keine Mutation, Rezeptwechsel
  - `composables/useWakeLock.spec.ts` (8): Anforderung, erneute Anforderung nach `visibilitychange`, keine Doppelanforderung, Freigabe beim Verlassen und während einer laufenden Anforderung, Schalter, Ablehnung, ohne API
  - `components/recipe/display/RecipeDisplay.spec.ts` (12): Schritt markieren und Abschnittswechsel, „Nur aktuell“ am Tablet und im Sheet, Portionen inklusive Grenzen und ungültiger Eingabe, R-10, Leiste mit einem Ziel, Sheet schließen per Hintergrund und Escape
- **Sichtprüfung:**
  - Aufbau: Production-Build hinter dem Mock-Server aus U.1 (Mock-IdP, Mock-API, Fixtures plus ein Rezept ohne Portionen), Edge 156 headless über playwright-core 1.65.1.
  - Geräte: iPhone 390 × 844 und Tablet 1180 × 820, jeweils hell und dunkel.
  - Vorher: sauberer Build von `66a2125`. Nachher: `61ef160`.
  - 18 Vergleichsbilder liegen unter `docs/plans/u3-koch-modus/`:

    | Befund | Bilder |
    |---|---|
    | R-01 | `iphone-*-zutaten-nur-aktuell.png`, `tablet-*-nur-aktuell.png` |
    | R-02 | `iphone-*-menu.png` |
    | R-05 | `iphone-*-schritt-markiert.png` |
    | R-06 | `tablet-*-schichten.png` |
    | R-07 | `iphone-*-lasagne.png` |
    | R-10 | `iphone-*-ohne-portionen*.png` |
    | R-11 | `iphone-*-zutaten-alle.png` |

  - Proben:
    - R-06: Der aktive Block „Schichten und Backen“ liegt vorher bei y = 1042–1233 (Bildschirmhöhe 820), nachher bei y = 589–781.
    - R-02: Chromium meldet `wakeLock` vorhanden, nachher 1 Anforderung und 1 erfolgreich, vorher 0.
    - X-05: Viewport nachher `width=device-width, initial-scale=1, viewport-fit=cover`, `touch-action` am `html` = `manipulation`.
- **Touch-Ziele (X-03), gemessen am iPhone hell:**

  | Bereich | Vorher (unter 44 px) | Nachher (unter 44 px) |
  |---|---|---|
  | Leiste | 3 von 4 | 0 von 1 |
  | Sheet „Nur aktuell“ | 5 von 6 | 0 von 6 |
  | Sheet „Alle“ | 8 von 9 (Chips 10 px) | 0 von 9 |
  | ⋮-Menü | 4 von 4 (39 px) | 0 von 5 |
  | Tablet-Zutatenkopf | 4 von 4 | 0 von 5 |

  Schritte: Der Knopf selbst misst nur 25 px Höhe. Antippbar ist aber die ganze Zeile über `::after`, einzeilig mindestens 57 px.
- Prüfzeit: ~12 min; größter Posten: Screenshot-Läufe und die Klärung des defekten Vorher-Builds (siehe unten).
- Prüfskripte: nur im Scratchpad unter `C:\Users\ce\AppData\Local\Temp\claude\beb48852c7fd70f3\2fb033fa-301d-405f-937b-10c3012d740a\scratchpad\ux\`:
  - `shoot-u3.mjs`: Aufnahmen, Messung, Proben
  - `compose.mjs`: Vergleichsbilder
  - `server.mjs`, `fixtures.mjs`, `lib.mjs`: kopiert aus U.1; `lib.mjs` mit `DIST`/`OUT` aus der Umgebung

## Struktur und Doku
- **Neue Module:**
  - `js/recipeSections.ts`: Abschnittslogik, die vorher doppelt in Step- und IngredientsSection stand
  - `composables/usePortions.ts`
  - `composables/useWakeLock.ts`
  - `components/recipe/display/IngredientFilterToggle.vue`: Segmented Control für Tablet und Sheet
- **Größere Dateien:**
  - `RecipeDisplay.vue` mit 362 Zeilen, vorher 402
  - `MobileIngredientsBar.vue` mit 303 Zeilen, vorher 230; dazu kamen Hintergrund, Escape und Chip-Sprung
  - `PortionControl.vue` mit 179 Zeilen, vorher 318; aus drei Varianten wurde eine
- **Bewusst eigene Umsetzung:** `useWakeLock` statt `useWakeLock` aus VueUse 15. Dort fängt die erneute Anforderung nach `visibilitychange` (`forceRequest`) Ablehnungen nicht ab, und der Schalter müsste daneben koordiniert werden.
- **Rules:** `.claude/rules/frontend.md` nachgetragen.
  - Die Aussage „Viewport sperrt Pinch-Zoom absichtlich“ war veraltet und ist ersetzt.
  - Neu: Koch-Modus-Struktur und eine **Falle unter Windows:** `npm test` und `npm run build` aus einem Arbeitsverzeichnis mit kleinem `c:`. Diese Schreibweise liefert die VS-Code-Sitzung.
    - vitest scheitert dann mit „failed to find the current suite“.
    - Der Build läuft scheinbar fehlerfrei durch, die App bricht aber beim Start ab („reading '_s'“, Pinia doppelt geladen).
    - Belegt durch Gegenproben mit großem und kleinem `C:` an derselben Quelle. CI und Docker laufen unter Linux und sind nicht betroffen.

## Mitgenommen
- nichts. Der defekte Chip-Selektor (`.ingredient-section` statt `.ingredients-section`) gehört zu R-11 und steckt in `85926ab`.

## Abweichungen vom Auftrag
- **Portionen:** Wie am Checkpoint freigegeben, rechnet `usePortions` nur für die Anzeige um und ändert das Rezept nicht mehr. Die Rundung auf 2 signifikante Stellen bleibt.
- **R-05:** Einen Weiter-Knopf habe ich nicht gebaut, er wäre eine neue Funktion.
- **R-11:** Wischen nach unten und Fokusfalle fehlen noch, sie gehören zu U.11.
- **R-06:** Der Filter steht am Tablet weiter auf „Alle“, wie am Checkpoint vorgeschlagen.
- **⋮-Menü für `readonly`:** Entscheidung B vom Checkpoint. Der Wake Lock ist für alle Rollen an, den Schalter sehen `readonly`-Nutzer aber nicht, weil das Menü an `!read_only` hängt. Den Konflikt mit W.35 habe ich vermieden.
- **Schritt-Layout:** Die Schrittnummer steht jetzt in einer eigenen Spalte mit hängendem Einzug. Grund ist das Flex-Layout für die ganze Zeile als Ziel. Folge: etwa 17 px weniger Textbreite. Die Nummerierung selbst ist unverändert, R-13 gehört zu U.4.
- **Vorher-Build:** Der erste Vorher-Build war aus der `c:`-Falle defekt (siehe oben). Neu gebaut aus `C:`, danach sauber.

## Nachgetragen in Specs/Plänen
- `docs/plans/u3-koch-modus/`: Vorher/Nachher-Bilder

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Schalter „Bildschirm anlassen“ für `readonly`** (XS, nach W.35): Das ⋮-Menü für alle Rollen zeigen, die Bearbeiten-Einträge weiter an `!read_only` binden.
- **Wake Lock in der geteilten Ansicht** `SharedRecipe.vue` (XS–S): Dort gibt es kein ⋮-Menü. Eine fachliche Entscheidung ist nötig: immer an oder mit eigenem Schalter?
- **Sheet:** Wischen nach unten, Fokusfalle und `role="dialog"` kommen mit U.11.
- **Kontrast:** Mengen in `--color-text-muted` und Weiß auf Grün im Dunkelmodus kommen mit U.10 (X-01). Unverändert, nicht verschlechtert.

**Szenarien für deine Prüfung am iPhone:** installierte PWA und Safari, jeweils iOS < 18.4 und ≥ 18.4, soweit verfügbar.

| # | Was | Erwartung |
|---|---|---|
| 1 | Wake Lock: Rezept öffnen, Gerät > Auto-Sperre liegen lassen | bleibt an (Standalone erst ab iOS 18.4, laut Audit unbestätigt) |
| 2 | Wake Lock: App in den Hintergrund und zurück, erneut liegen lassen | bleibt wieder an |
| 3 | Wake Lock: ⋮ → „Bildschirm anlassen“ aus, liegen lassen | sperrt normal; Einstellung bleibt nach Neustart erhalten |
| 4 | Wake Lock ohne Unterstützung (iOS < 16.4 bzw. Standalone < 18.4) | Hinweis im ⋮-Menü „von diesem Gerät nicht unterstützt“, kein Fehler |
| 5 | Zoom: Pinch in Rezeptansicht, PWA und Safari | vergrößert |
| 6 | Zoom: Doppeltipp auf einen Schritt | markiert den Schritt, **kein** Zoom |
| 7 | Zoom: Fokus in ein Editorfeld und ins Portionenfeld | kein Hineinzoomen (16 px) |
| 8 | Sheet: Zutaten öffnen, auf die abgedunkelte Fläche tippen | schließt |
| 9 | Sheet: Portionenfeld antippen, Tastatur erscheint | Feld bleibt sichtbar (Audit Nr. 8) |
| 10 | Sheet bei „Alle“: Chips antippen | springt zum Abschnitt, Chips voll lesbar |
| 11 | Portionen: ± im Sheet, Sheet schließen | Leiste zeigt „Zutaten · n Portionen“, Mengen umgerechnet |
| 12 | Portionen bei Rezept ohne Angabe | „1 Portion“, + verdoppelt die Mengen |
| 13 | Safe Area: Leiste und Sheet über dem Home-Indikator | nichts verdeckt |

## Status je Roadmap-Punkt
- `U.3` fertig (Szenarien am Gerät offen)

## Vorschlag Roadmap-Zeilen
`- [x] U.3 Koch-Modus: Kernfunktionen · 2026-11-18 · 2b12ec2`

## Nachtrag: Merge von `main` (2026-11-18, 11:27 – 11:31, 4 min)
Auf deine Freigabe habe ich `main` (`39914c0`, mit W.35 und U.12) in den Branch gemergt. Der Merge-Commit ist `fa6b7b3`. Ein Probe-Merge nach `main` (`git merge-tree`) ist jetzt konfliktfrei.
- **Konflikte:**
  - `Recipe.vue`: Der Schalter „Bildschirm anlassen“ steht vor dem Trenner. Den zeigt W.35 jetzt nur noch mit Löschrecht.
  - `rules/frontend.md`: Die Abschnitte Zoom, Koch-Modus und Laufwerksbuchstabe stammen aus U.3. Anlegen, Vormerkung, Löschen und Favoriten stehen in der Fassung von W.35.
- **Integrationsfehler:**
  - Problem: Die neue `views/Recipe.spec.ts` aus W.35 mockt `uiStore` ohne `recipe`. Dadurch schlugen 4 Tests mit `reading 'keepAwake'` fehl.
  - Lösung: Den Mock habe ich um `recipe.keepAwake` und `setRecipeKeepAwake` ergänzt. Die Änderung steckt im Merge-Commit.
- **Verifikation:**
  - `npm run lint:check && npm run typecheck && npm test && npm run build` → grün: 36 Testdateien, 325 Tests in 3,19 s, Build in 957 ms; Lauf von 11:29:14 bis 11:30:22.
  - Sichtprüfung des gemergten Builds: Aufnahmen und Messung wie oben, keine Ziele unter 44 px außer dem bekannten Schritt-Knopf. Im ⋮-Menü erscheint „Bildschirm anlassen“ korrekt, beim Editor ohne Löschrecht ohne Trenner und ohne „Löschen“.
  - Backend nicht geprüft: Der Branch ändert dort nichts, die Backend-Änderungen kommen unverändert aus `main`.
- **Folgepunkt unverändert:** Das ⋮-Menü hängt auch nach W.35 an `!settings.read_only`. Den Schalter für `readonly` gibt es also weiterhin nicht.

## Nachtrag: Overlay-Token und Schlussverifikation (2026-11-18, 11:34 – 11:39, 5 min)
- **Merge mit Mock-Fix:** war bereits abgeschlossen (`fa6b7b3`, siehe oben).
- `2b12ec2` fix(frontend): Sheet-Hintergrund über Token `--color-surface-overlay`.
  - Statt der festen Farbe `rgba(0, 0, 0, 0.35)` gilt jetzt das vorhandene Token: hell 0,5, dunkel 0,65.
  - Der Hintergrund dunkelt dadurch stärker ab als vorher, im Dunkelmodus deutlich. Geprüft am iPhone dunkel: Der Rezepttext dahinter tritt klar zurück, das Sheet bleibt gut abgesetzt.
- **Volle Verifikation auf dem Merge-Stand** (`npm run lint:check && npm run typecheck && npm test && npm run build`, aus `C:`):
  - grün: 36 Testdateien, 325 Tests in 14,70 s, Build in 978 ms
  - Lauf von 11:35:51 bis 11:37:11
- **Sichtprüfung:** Aufnahmen des gemergten Builds wiederholt, Lauf ohne Fehler.
- **Merge nach `main`:** Ein Probe-Merge per `git merge-tree` ist konfliktfrei.
