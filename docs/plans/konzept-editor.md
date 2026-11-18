# Konzept: Rezept-Editor für Gelegenheitsnutzer

> U.13 · Stand 2026-11-18 · Basis `main@92355ed` (inhaltlich `main@dffd720`, dazwischen nur Roadmap-Commits) · Entscheidungsvorlage, kein Code
> Grundlage: [UX-Audit](ux-audit.md) K4–K6, 5.4 (E-01–E-11, A-01–A-04), X-03, X-07; [UI-Roadmap](ui-roadmap-2025-26.md) Phase X und Sprint 7; Code `views/Edit.vue`, `components/edit/*`, `composables/use*Editor.ts`, `useDraft.ts`, `backend/app/schemas/recipe.py`
> Bezugsstand: nach U.15. Der Block „YAML anzeigen“ und `settings.expert_mode` in `Edit.vue` gelten als entfernt.

## Kurzfassung

- **Zielgruppe neu:** Familienmitglieder, die ein paarmal im Jahr am iPhone ein Rezept korrigieren oder vom Zettel abtippen (Persona P4, Abschnitt 1). Der heutige Editor ist für P2 gebaut, die viel importiert und am Tablet arbeitet. Dort funktioniert er gut, am iPhone nicht.
- **Abschnitte nur bei Bedarf.** Ein Rezept ohne Abschnitte ist der Normalfall und passt schon heute zum Datenmodell: genau ein Abschnitt mit leerem Namen. Gegliedert wird über „In Abschnitte aufteilen“, verwaltet über ein Menü am Abschnitt. Das Modell bleibt, es braucht keine Migration. Dazu kommen Regeln im Editor gegen doppelte Namen (neuer Befund E-13).
- **Zutatzeile einzeilig** in Lesereihenfolge: Menge | Einheit | Name | ⋯. Notiz, Verschieben und Löschen liegen im ⋯-Menü, Löschen mit Rückgängig-Toast. Damit verschwinden die 18 roten Papierkörbe. Die Menge wird ein Textfeld mit Parser: Komma, Punkt und Brüche, leer bleibt leer.
- **Tags im Editor** als Chips mit einem Auswahl-Sheet (vorhandene Tags, Suche, neu anlegen). Die Karte auf Home nutzt dasselbe Sheet (U.14). Keine API-Änderung, die Tags gehen schon heute mit dem PUT.
- **Kopfleiste:** links „Schließen“, in der Mitte der Speicherstand, rechts ↶ ↷ ⋮ und der Text-Knopf „Speichern“. Beim Schließen mit Änderungen fragt ein Sheet: Speichern, Als Entwurf behalten, Verwerfen, Weiter bearbeiten. Ein Entwurf wird nie ohne Bestätigung verworfen.
- **7.1 Wizard:** streichen, neu schneiden als „Anlegen erst beim Speichern, ein Anlegeweg“. Der Editor bekommt einen geführten leeren Zustand, ein Wizard daneben wäre eine zweite Bearbeitungsoberfläche.
- **U.5/U.6 nach Bereichen statt nach Gerät schneiden:** U.5 umfasst Rahmen und Kopf, U.6 den Rezeptinhalt. U.11 (Sheet- und Dialog-Komponente) sollte vorher kommen.

Fakten stammen aus dem Code am Basis-Stand (Fundstellen genannt). Annahmen und Einschätzungen sind gekennzeichnet. Was nur am iPhone sicher zu klären ist, steht in [Abschnitt 9](#9-am-gerät-prüfen).

---

## Inhalt
1. [Zielgruppe und Aufgaben](#1-zielgruppe-und-aufgaben)
2. [Bestandsaufnahme](#2-bestandsaufnahme)
3. [Datenmodell hinter dem Editor](#3-datenmodell-hinter-dem-editor)
4. [Gegenentwurf: vier Reizpunkte](#4-gegenentwurf-vier-reizpunkte)
5. [Skizzen iPhone](#5-skizzen-iphone)
6. [Abgrenzung zu verwandten Punkten](#6-abgrenzung-zu-verwandten-punkten)
7. [Entscheidungen](#7-entscheidungen)
8. [Folgen für die Roadmap](#8-folgen-für-die-roadmap)
9. [Am Gerät prüfen](#9-am-gerät-prüfen)

---

## 1. Zielgruppe und Aufgaben

| | Persona | Gerät | Rolle | Merkmale |
|---|---|---|---|---|
| **P4** (neu) | Familienmitglied, bearbeitet gelegentlich | iPhone, installierte PWA | `editor` | wenige Male im Jahr; kennt den Editor nicht und lernt ihn nicht; tippt vom Zettel oder korrigiert nach dem Kochen; erwartet iOS-Muster (Sheets, Text-Knöpfe, Wischen zurück); bricht bei Unsicherheit ab |
| P2 (Audit) | Editor mit vielen Importen | iPad quer, iPhone | `editor` | bleibt Maßstab für Tablet und Import; der Gegenentwurf darf P2 nicht bremsen |

| # | Aufgabe P4 | Häufigkeit (Einschätzung) | Berührt |
|---|---|---|---|
| G1 | Menge oder Tippfehler korrigieren, speichern | am häufigsten | Zutatzeile, Kopfleiste |
| G2 | Notiz zu einem Schritt ergänzen („bei uns 10 min länger“) | oft | Schrittzeile |
| G3 | Tag ergänzen („Weihnachten“) | gelegentlich | Tag-Feld |
| G4 | Rezept vom Zettel neu erfassen, ohne Abschnitte | gelegentlich | alles; 7.1 |
| G5 | Rezept mit Teig und Füllung erfassen | selten | Abschnitte |
| G6 | Foto ergänzen | selten | Bild |
| G7 | Abbrechen, ohne etwas kaputtzumachen | bei jedem Unsicherheitsfall | Kopfleiste, Verlassen |

Folgerung: G1, G2 und G7 müssen ohne Nachdenken gehen. G5 darf einen Schritt mehr kosten, solange es auffindbar ist.

---

## 2. Bestandsaufnahme

Maße aus dem Audit (iPhone 390 × 844 pt, X-03). „Häufigkeit“ meint P4, eingeschätzt. Zielgröße für alle Tippziele 44 × 44 pt, Eingaben 16 px Schrift und 44 pt hoch (X-03, X-07; die 16-px-Regel gilt seit U.3 bereits per `App.vue` für `pointer: coarse`).

### 2.1 Bedienelemente

| Bereich | Element (Code) | Was es tut | Häufigkeit P4 | Ist iPhone | Ziel iPhone | Befund |
|---|---|---|---|---|---|---|
| Kopfleiste | ✕ „Abbrechen“ (`goBack`) | zurück **ohne** Rückfrage, Änderungen bleiben still als Entwurf | jedes Mal | 44 pt, Symbol | Text „Schließen“, Rückfrage bei Änderungen | E-01 |
| | Titel „Bearbeiten“ | nur Text, schrumpft auf „Bearbei…“ | – | abgeschnitten | entfällt, Platz für den Speicherstand | E-02 |
| | ↶ ↷ (`useEditHistory`) | Undo/Redo, Strg/Cmd+Z/Y | selten | 44 pt | bleiben (Rettungsweg) | – |
| | ⊗ „Änderungen verwerfen“ (`revertRecipe`) | lädt das Original, löscht den Entwurf, `confirm()` | selten | 44 pt, verwechselbar mit ✕ | ins ⋮-Menü | E-02, X-08 |
| | 🗑 „Entwurf löschen“ (nur mit Entwurf) | löscht nur den localStorage-Eintrag, der Editor bleibt geändert | kaum | 44 pt | entfällt, geht in „Verwerfen“ auf | E-02 |
| | 👁 Vorschau | `BModal` mit `RecipeDisplay` | selten | 44 pt | ins ⋮-Menü | E-02 |
| | ✓ Speichern | `saveRecipe`, Strg/Cmd+S; deaktiviert ohne Änderung | jedes Mal | 44 pt, nur Symbol | Text-Knopf „Speichern“, primär | E-02 |
| Status | Speicherstand | nur erkennbar an hell/grauen Symbolen | – | fehlt | Text: „Nicht gespeichert“, „Entwurf“, „Gespeichert“ | E-02 |
| Entwurf | Wiederherstellen (`useDraft`) | beim Öffnen automatisch, Toast „Entwurf wiederhergestellt.“ | gelegentlich | Toast, 5 s | Banner mit Datum und „Verwerfen“ | neu (E-01) |
| Metadaten | Titel, Untertitel | Pflicht bzw. frei | oft | 31 pt, 14 px | 44 pt, 16 px | X-03, X-07 |
| | „Metadaten“ (`details`) | klappt Autor, Quelle, 4 Zeiten, Schwierigkeit, Notizen auf | kaum | doppelter Pfeil | „Weitere Angaben“, ans Ende | E-09 |
| | Quelle | ein Feld, Heuristik `http…` → `source_url`, sonst `source_book` | kaum | 31 pt | bleibt | – |
| Portionen | Menge, Einheit, „Umrechnen“, „Exponent“ | Ergibt-Angabe; der Schalter rechnet beim Ändern alle Mengen um | gelegentlich | 31 pt, Fachbegriffe | „Ergibt [4] [Portionen]“, Umrechnen erklärt, Exponent in „Weitere Angaben“ | E-07, E-04 (Leer → 0) |
| Bild | Vorschau, 🗑, `BFormFile` | Bild wählen, beim Speichern hochladen bzw. entfernen | selten | „oder hierher ziehen“, kein `alt` | „Foto wählen“ / „Foto ersetzen“, Entfernen nur bei Bild | E-10 |
| | Vorlage (`SourceImages`) | Seiten des Foto-Imports zum Abgleich | nach Import | Links 2 × 120 px | Links als Block, 44 pt | E-10 |
| Abschnitte | Kopf nur bei > 1 Abschnitt | Griff, Name (`InlineEditField`), ▲ ▼, 🗑 | selten | ▲▼🗑 32 pt; Name per Tippen | Name als Überschrift, ein ⋯-Menü | E-06, E-13 |
| | „Abschnitt hinzufügen“ | hängt `{section: ""}` an | selten | Knopf am Ende | „In Abschnitte aufteilen“ bzw. „Abschnitt hinzufügen“ mit Namensabfrage | E-13 |
| | Ziehen am Griff (SortableJS) | Abschnitte umsortieren | kaum | 44 pt-Griff | mobil über ⋯ „Nach oben/unten“ | – |
| Zutaten | Zeile: Griff, Name (Tippen-zum-Bearbeiten), Menge, Einheit, 💬, 🗑 | zwei Zeilen je Zutat auf dem iPhone | jedes Mal | 31–32 pt, Name ohne Label | eine Zeile Menge \| Einheit \| Name \| ⋯ | E-03, E-05 |
| | Menge `type="number"` | `Number("")` → 0 | oft | Tastatur ungeklärt | Textfeld `inputmode="decimal"` mit Parser | E-04 |
| | Einheit mit `datalist` | Vorschläge aus allen Rezepten | oft | 31 pt | bleibt, 44 pt | – |
| | 💬 Notiz hinzufügen | hängt `""` an `notes`; die Zeile erscheint erst beim zweiten Tippen | gelegentlich | 32 pt | im ⋯-Menü, Feld erscheint sofort mit Fokus | E-17 (neu) |
| | 🗑 löschen | sofort, nur Undo in der Kopfleiste rettet | gelegentlich | 32 pt, rot, 18 × je Bildschirm | im ⋯-Menü, Rückgängig-Toast | E-03 |
| | „+ Zutat“ | neue Zeile mit Namen „Neue Zutat“ als **Wert** | oft | 32 pt, Bootstrap-Blau | 44 pt, leere Zeile mit Fokus auf Menge | E-14 (neu), X-02 |
| | Ziehen, auch zwischen Abschnitten | Reihenfolge, Abschnittswechsel | kaum | Griff 44 pt je Zeile | Tablet: bleibt; iPhone: ⋯ „Nach oben/unten“, „In Abschnitt …“ | – |
| Schritte | Nummer, Textfeld (autosize), 💬, 🗑, Griff | Text bearbeiten | oft | 32 pt, 14 px | Textfeld 16 px, ⋯-Menü | E-03, E-11 |
| | Nummerierung je Abschnitt | `localIdx + 1` | – | – | folgt der Entscheidung R-13 | E-11 |
| Tags | – | im Editor nicht vorhanden, nur am Karten-Menü auf Home | gelegentlich | fehlt | Chips + Auswahl-Sheet | E-08 |
| Vorschau | Modal `size="xl"` | zeigt `RecipeDisplay` | selten | `no-footer` bereits gesetzt | im ⋮-Menü, sonst unverändert | – |

### 2.2 Befund der Bestandsaufnahme

- **Rund 50 Tippziele** je Bildschirm, davon 44 unter 44 pt (X-03). Für G1 braucht P4 genau zwei: das Mengenfeld und „Speichern“.
- **Löschen ist das am stärksten betonte Element.** 18 rot umrandete Knöpfe stehen Speichern ohne Text gegenüber.
- **Drei Bedienmuster nebeneinander:** Tippen-zum-Bearbeiten beim Zutat- und Abschnittsnamen, feste Felder bei Menge und Einheit, Ziehen am Griff. P4 muss für jede Zeile erst herausfinden, was antippbar ist.
- **Neue Befunde aus dem Code** (abgeleitet, nicht live geprüft), Nummern im Anschluss an das Audit:

| ID | Stufe | Befund | Beleg |
|---|---|---|---|
| E-12 | 2 | **Verwaiste Einträge sind im Editor unsichtbar.** `SectionCard` zeigt nur Einträge, deren `section` in `sections` steht. Zutaten oder Schritte mit einem anderen Namen (KI-Import, YAML, Tippfehler im Modell) zeigt die Rezeptansicht als eigenen Abschnitt (`effectiveSections`). Im Editor fehlen sie, werden aber unverändert mitgespeichert. | `SectionCard.vue:47-57`, `js/recipeSections.ts` |
| E-13 | 2 | **Doppelte Abschnittsnamen.** „Abschnitt hinzufügen“ legt `{section: ""}` an. Heißt der vorhandene Abschnitt ebenfalls `""`, zeigen beide Karten dieselben Einträge. Benennt P4 die neue Karte in „Füllung“ um, zieht `updateSectionName` **alle** Einträge mit `""` dorthin, die erste Karte ist leer. Löschen einer der beiden Karten löscht den Inhalt beider. Dasselbe gilt beim Umbenennen auf einen schon vorhandenen Namen. | `useSectionEditor.ts:5-29` |
| E-14 | 1 | „+ Zutat“ setzt „Neue Zutat“ als Wert statt als Platzhalter. Wird der Name nicht überschrieben, wird „Neue Zutat“ gespeichert. | `useIngredientEditor.ts:21-27` |
| E-17 | 2 | Der Notiz-Knopf bei Zutaten und Schritten fügt `""` an. `hasNotes` prüft die Länge des zusammengefügten Texts, bleibt also `false`. Das Feld erscheint erst beim zweiten Tippen, zurück bleiben leere Notizen. | `IngredientRow.vue:17-18, 42-47`, `StepRow.vue:25-35` |

(E-15/E-16 sind frei gelassen. Hinweis: `composables/useUnsavedGuard.ts` existiert, wird aber nirgends genutzt. Es ist ein Ansatz für E-01 mit `confirm()`.)

---

## 3. Datenmodell hinter dem Editor

**Struktur** (`backend/app/schemas/recipe.py`, `frontend/src/types/recipe.ts`):

```
RecipeData
├─ sections:    [ {section: "Teig"}, {section: "Füllung"} ]   ← nur Name, Reihenfolge = Abschnittsreihenfolge
├─ ingredients: [ {name, amounts:[{amount, unit}], section:"Teig", notes[], processing[], substitutions[]}, … ]
└─ steps:       [ {step, section:"Teig", notes[], haccp{}}, … ]
```

- **Zuordnung über den Namen:** Zutaten und Schritte tragen den Abschnitt als String. Es gibt keine Abschnitts-ID. Die Reihenfolge innerhalb eines Abschnitts ist die Reihenfolge in der flachen Liste.
- **Was das Modell erzwingt:**
  - mindestens einen Abschnitt: `ensure_sections` (Backend, beim Validieren) und `normalize_recipe_data` füllen `[{section: ""}]` auf. `initRecipe` im Frontend tut dasselbe.
  - `section` ist immer ein String, fehlend wird `""`.
  - PUT mit Zutaten **und** Schritten leer → 422, wenn vorher Inhalt da war (W.40). `sections` zählt dabei nicht.
- **Was es nicht erzwingt:**
  - eindeutige Abschnittsnamen (E-13)
  - dass jeder `section`-Wert in `sections` steht (E-12)
  - einen nicht leeren Namen bei mehreren Abschnitten

  Die Rezeptansicht verträgt alles davon (`effectiveSections`). Der Editor verträgt es nicht.
- **„Rezept ohne Abschnitte“ ist schon heute der Normalfall im Modell:** genau ein Abschnitt `""`. Der Editor blendet dann den Abschnittskopf aus (`show-header` bei > 1), die Rezeptansicht die Überschrift (`h5 v-if="section.section"`). Der KI-Prompt verlangt genau das, wenn er keine Struktur erkennt (`backend/prompts/system_prompt.md`, Regel 5).
- **Felder, die der Editor nicht bearbeitet, aber erhält:** `amounts[1…]` (nur `amounts[0]` hat Felder), `processing`, `substitutions`, `haccp`, `servings`. Sie bleiben beim Speichern unverändert, weil die Zeilen geklont werden. Der Gegenentwurf ändert daran nichts. Bearbeitbar machen gehört zu U.4 (Anzeige) bzw. einer eigenen Idee.

**Folgerung:** Der Gegenentwurf kommt **ohne Modelländerung und ohne Migration** aus. Nötig sind Regeln im Editor:
1. **Beim Laden normalisieren**, vor dem Schnappschuss für `isDirty`: fehlende Abschnittsnamen aus den Einträgen an `sections` anhängen (behebt E-12). Ein Rezept wird dadurch nicht „geändert“, gespeichert wird erst mit der nächsten echten Änderung.
2. **Namen eindeutig halten:** Umbenennen auf einen vorhandenen Namen lehnt der Editor mit Hinweis ab. Neue Abschnitte bekommen ihren Namen beim Anlegen, nie `""` neben einem anderen `""` (behebt E-13).
3. **Erlaubt bleibt** ein einziger unbenannter Abschnitt neben benannten (Altbestand, KI-Import). Der Editor zeigt ihn als „Ohne Überschrift“, die Rezeptansicht wie heute ohne Überschrift.

YAML-Dateien und der ZIP-Austausch (11.1, `export-import.md`) bleiben lesbar, weil sich das Format nicht ändert. Regel 1 heilt auch importierte Dateien mit verwaisten Einträgen beim ersten Öffnen.

**Erwogen und verworfen: Abschnitts-IDs.** Eine `id` je Abschnitt und an jedem Eintrag würde Umbenennen trivial machen. Sie braucht aber eine Datenmigration aller Rezepte und eine Formatänderung in YAML, ZIP und KI-Prompt, dazu eine Anpassung der Rezeptansicht. Der Nutzen für P4 ist derselbe wie mit Regel 2. Nicht empfohlen.

---

## 4. Gegenentwurf: vier Reizpunkte

### 4.1 Abschnitte

**Wann braucht ein Rezept Abschnitte?** Wenn Zutaten und Schritte in getrennten Teilen zubereitet werden (Teig/Füllung, Ragù/Béchamel/Schichten). Die Einschätzung: Die Mehrheit der Familienrezepte braucht keine. Prüfbar ohne Schreibzugriff: Anteil der Rezepte mit mehr als einem Abschnitt im Bestand.

| | Option | Folgen Nutzer | Folgen Code | Folgen Modell | Aufwand |
|---|---|---|---|---|---|
| A | **Karten behalten, reparieren:** Regeln 1–3 aus Abschnitt 3, Rückfrage beim Löschen (E-06), Ziele 44 pt | vertraut für P2; P4 sieht weiter Karten mit Rahmen, auch bei nur einem Abschnitt; „Abschnitt hinzufügen“ bleibt ein unklarer Knopf am Ende | `useSectionEditor` (Eindeutigkeit, Normalisierung), `SectionCard` (Größen) | keine | S |
| B | **Abschnitte nur bei Bedarf** (empfohlen): Ohne Abschnitte zeigt der Editor zwei schlichte Listen „Zutaten“ und „Schritte“ ohne Kartenrahmen. Darunter steht ein dezenter Eintrag „In Abschnitte aufteilen …“. Ein Sheet fragt zwei Namen ab: „Bisheriger Teil heißt: [Teig]“ und „Neuer Abschnitt: [Füllung]“. Mit Abschnitten trägt jeder Abschnitt eine Überschrift mit ⋯-Menü: Umbenennen, Nach oben, Nach unten, Löschen. Löschen fragt: „Inhalt in ‚Teig‘ übernehmen“ oder „Abschnitt mit 3 Zutaten und 4 Schritten löschen“, danach Rückgängig-Toast. Bleibt ein Abschnitt übrig, wird er wieder unbenannt und die Gliederung verschwindet. Einträge wechseln den Abschnitt über ihr ⋯-Menü („In Abschnitt …“). | Der Normalfall ist so einfach wie ein Zettel. Gliedern ist auffindbar und benennt sofort, so dass E-13 nicht entstehen kann. Löschen verliert nichts ungefragt. | `SectionCard` erhält einen Modus ohne Rahmen; `useSectionEditor` bekommt Aufteilen, Auflösen und Zusammenführen sowie Regeln 1–3; Sheet für Namen (U.11-Komponente) | keine | M |
| C | **Zwischenüberschriften in getrennten Listen:** Zutaten und Schritte je für sich gliedern, wie in vielen Rezept-Apps | sehr frei, auch Gruppen, die sich nicht entsprechen („Für die Form“ nur bei Zutaten) | Editor bildet Überschriften-Zeilen auf `section` ab; die Rezeptansicht verliert die Kopplung „aktiver Schritt → Zutaten des Abschnitts“ (U.3, R-01), sobald Gruppen nicht übereinstimmen | Kopplung Zutaten ↔ Schritte fällt weg oder braucht getrennte Gruppen → Modelländerung, Migration, Formatänderung | L |

**Empfehlung: B.** Der Normalfall bleibt unsichtbar, die seltene Gliederung bekommt einen geführten Weg, und E-06/E-13 sind strukturell erledigt. C widerspricht der Kopplung, auf der der Koch-Modus aufbaut.

**Reihenfolge auf dem iPhone mit Abschnitten:** wie heute je Abschnitt Zutaten, dann Schritte. Das entspricht der Rezeptansicht am Tablet und dem Modell. Erwogen wurde eine Umschaltung „Zutaten | Schritte“ für die ganze Seite (alle Zutaten aller Abschnitte, dann alle Schritte). Sie passt zum Abtippen eines Zettels, trennt aber, was zusammengehört, und braucht einen zweiten Darstellungsweg. Nicht empfohlen; offen für die Gerätetests.

**Umsortieren mobil:** Ziehen über Griffe kostet je Zeile 44 pt Breite und kollidiert mit Scrollen (Audit 11 Nr. 9). Vorschlag: Griffe nur im breiten Layout (≥ 768 px, Tablet wie heute). Am iPhone „Nach oben“ und „Nach unten“ im ⋯-Menü, optional langes Drücken zum Ziehen (SortableJS `delay` + `delayOnTouchOnly`; ob das auf iOS zuverlässig gegen Scrollen trennt: am Gerät prüfen).

### 4.2 Zutatzeile

| | Option | Folgen Nutzer | Folgen Code | Folgen Modell | Aufwand |
|---|---|---|---|---|---|
| A | **Drei Felder in Lesereihenfolge, eine Zeile** (empfohlen): `[Menge][Einheit][Name……][⋯]`. Notiz erscheint als zweite Zeile nur, wenn vorhanden. „Weiter“ auf der Tastatur springt Menge → Einheit → Name → nächste Zeile; am Listenende legt es eine neue Zeile an. | Liest sich wie der Zettel („200 g Mehl“). Jedes Feld ist sofort bearbeitbar, kein Tippen-zum-Bearbeiten. Kompakt: 11 Zutaten passen auf etwa einen Bildschirm statt 1,5. | `IngredientRow` neu aufbauen, `InlineEditField` entfällt für Namen; `enterkeyhint="next"`; Fokussteuerung | keine | M |
| B | **Ein Textfeld mit Zerlegung:** „200 g Mehl, gesiebt“ → Menge 200, Einheit g, Name Mehl, Notiz „gesiebt“; darunter eine kleine Anzeige, wie es verstanden wurde | am schnellsten beim Abtippen; mehrere Zeilen einfügen wird möglich | Parser im Frontend mit Einheitenliste; mehrdeutig bei „1 Dose (400 g) Tomaten“, „Salz nach Geschmack“, „2–3 Eier“; Rückweg Text ↔ Felder muss verlustfrei sein (`amounts[1…]`, `processing` haben keinen Platz im Text) | keine, aber stille Fehlzerlegungen landen in den Daten | M–L |
| C | **Lesezeile mit Bearbeiten-Sheet:** Die Liste zeigt „200 g Mehl“ als Text, Antippen öffnet ein Sheet mit drei Feldern, Notiz und Löschen | sehr ruhige Liste; jede Änderung kostet einen Tipp mehr und einen Kontextwechsel | neues Sheet; ähnelt dem kritisierten Tippen-zum-Bearbeiten (E-05) | keine | M |

**Empfehlung: A.** Sie entspricht dem Audit-Vorschlag E-05 und vermeidet Parserfehler im Datenbestand. Der Kern von B lohnt sich als spätere Ergänzung: „Zutatenliste einfügen“ zerlegt eingefügten Text einmalig in Zeilen, die man danach in Form A prüft. Das ist eine Idee für `IDEAS.md` oder 7.1, nicht für U.6.

**Platz auf dem iPhone (390 pt, 12 pt Rand):** Menge 64, Einheit 76, ⋯ 44, Abstände 3 × 6 → Name ≈ 164 pt. Das reicht für „Rinderhackfleisch“ in 16 px, unbestätigt mit SF Pro. Längere Namen brechen in der Zeile um, statt abgeschnitten zu werden. Das geht nur, wenn das Namensfeld ein mitwachsendes Textfeld ist: entweder eine einzeilige `textarea` mit Autosize oder ein `input` mit Ellipse plus voller Anzeige beim Fokus. Für U.6 zu entscheiden, beides ohne Datenfolgen.

**⋯-Menü je Zeile** (Sheet bzw. Popover, U.11): Notiz hinzufügen bzw. entfernen · Nach oben · Nach unten · In Abschnitt … (nur mit Abschnitten) · Löschen (rot). Löschen wirkt sofort und zeigt einen Toast „Zutat gelöscht · Rückgängig“ (5 s, nutzt `undo()`). Damit stehen null statt 18 rote Knöpfe im Bild (E-03).

**Erwogen:** Wischen zum Löschen nach iOS-Muster. Es gibt im Web keine native Geste, man müsste sie selbst bauen. Ohne sichtbaren Hinweis findet P4 sie nicht, und sie kollidiert mit dem Wischen zurück am Rand. Allenfalls zusätzlich, nicht statt ⋯.

**Menge (E-04):**
- `type="text"`, `inputmode="decimal"` (iOS: Ziffernblock mit Dezimaltrenner der Region; ob das „,“ bei deutscher Region liefert: am Gerät prüfen).
- Parser: „1,5“, „1.5“, „½ ¼ ¾ ⅓ ⅔“, „1/2“, „1 1/2“ → Zahl. Leer → `null`. Nicht lesbar → Feld rot mit „Zahl, z. B. 1,5 oder 1/2“, der Wert bleibt bis zur Korrektur unverändert.
- Brüche auf dem Ziffernblock: Der Dezimalblock hat kein „/“. Wer „½“ will, tippt „0,5“. Brüche kommen über Einfügen oder die volle Tastatur. Eine Bruchleiste über der Tastatur wäre möglich, lohnt aber nicht für P4.
- Anzeige im Feld: Zahl mit Komma („1,5“), nicht „1.5“. Ob die Rezeptansicht Brüche anzeigt, ist eine Anzeigefrage (U.4 oder Idee), nicht Teil dieses Konzepts.
- Grenze des Modells: Spannen („2–3 Eier“) und „etwas“ gehen nicht als Zahl. Heute landen sie als Name oder Notiz. Das bleibt so; ein Spannenfeld wäre eine Modelländerung und ist nicht vorgeschlagen.
- Dasselbe gilt für die Portionsmenge (E-04, `Edit.vue` `setYieldsValue(Number(v))`).

**Neue Zutat (E-14):** leere Zeile, Platzhalter „Zutat“, Fokus auf Menge. Leere Zeilen (alle drei Felder leer) verwirft der Editor beim Speichern. Die Regel gilt nur für vollständig leere Zeilen, damit „Salz“ ohne Menge bleibt.

**Schrittzeile** entsprechend: Nummer, mitwachsendes Textfeld in 16 px, ⋯-Menü mit Notiz, Nach oben/unten, In Abschnitt …, Löschen mit Rückgängig. Die Notiz erscheint sofort mit Fokus (E-17). Ein Zeilenumbruch bleibt im Schritt erlaubt, „+ Schritt“ ist ein eigener Knopf.

### 4.3 Tag-Feld

| | Option | Folgen Nutzer | Folgen Code | Aufwand |
|---|---|---|---|---|
| A | **Chips mit Eingabefeld und Vorschlagsliste** inline unter dem Untertitel | schnell am Desktop; am iPhone verdeckt die Tastatur die Vorschläge, die Liste klebt unter dem Feld | Autocomplete-Komponente; zweite Tag-Bedienung neben der Karte | S |
| B | **Chips + Auswahl-Sheet** (empfohlen): Im Editor stehen die vorhandenen Tags als Chips (✕ je Chip, 44 pt) und ein Chip „＋ Tag“. Dieser öffnet ein Sheet mit Suchfeld oben, darunter alle vorhandenen Tags als Liste mit Häkchen und, falls nichts passt, „‚Weihnachten‘ neu anlegen“. Dasselbe Sheet öffnet die Karte auf Home (U.14). | bekanntes iOS-Muster (Auswahlliste); vorhandene Tags werden wiederverwendet statt neu getippt; eine Bedienung für beide Orte | eine Komponente `TagPicker` (Sheet aus U.11); im Editor ändert sie `current_recipe.tags` und geht mit dem PUT (`recipeToPayload` sendet `tags` schon heute); an der Karte speichert sie sofort per `setRecipeTags` | S–M |
| C | **Nur an der Karte** (heute) | E-08 bleibt: nach dem KI-Import Editor verlassen, Karte suchen | – | – |

**Empfehlung: B.**
- **Vorschläge** aus den Tags aller geladenen Rezepte (`store.recipes`, wie `RecipeCard` `allTags`), damit auch offline. Keine API-Änderung.
- **Groß- und Kleinschreibung:** Das Backend legt Tags unverändert an (`_sync_tags`, Vergleich `Tag.name == name`), „Kuchen“ und „kuchen“ werden zwei Tags. Das Sheet gleicht ohne Rücksicht auf die Schreibung ab und übernimmt die vorhandene Schreibweise. Eine Bereinigung im Bestand wäre ein Wartungspunkt und gehört nicht hierher.
- **Risiko Gleichzeitigkeit:** Ändert jemand die Tags an der Karte, während ein Entwurf desselben Rezepts offen ist, überschreibt das spätere Speichern im Editor sie. Das gilt heute schon für alle Felder (PUT ersetzt, Konflikte erst mit 12.1). Kein neues Risiko, aber für P4 sichtbarer, sobald Tags an zwei Orten bearbeitbar sind. Hinnehmen bis 12.1.
- **Platz im Editor:** direkt unter Titel und Untertitel, vor dem Bild. Tags gehören zur Einordnung und sind nach dem KI-Import der häufigste Zusatz (K4).

### 4.4 Kopfleiste, Verlassen, Entwurf

| | Option | Folgen Nutzer | Folgen Code | Aufwand |
|---|---|---|---|---|
| A | **Text-Knöpfe oben** (empfohlen): `[Schließen]  Status  [↶][↷][⋮] [Speichern]`. ⋮ enthält Vorschau und „Änderungen verwerfen …“. „Entwurf löschen“ entfällt. | iOS-Muster (Abbrechen links, Fertig rechts); Speichern ist eindeutig; der Status ersetzt den nutzlosen Titel | `Edit.vue` Kopf; ⋮-Menü (U.11 bzw. `BDropdown`) | S |
| B | **Speichern unten** als feste Leiste in der Daumenzone, oben nur Schließen, Status, ⋮ | gut erreichbar | feste Leisten springen auf iOS mit eingeblendeter Tastatur bzw. werden verdeckt (Safe Area, `visualViewport`); am Gerät aufwendig abzusichern; weicht vom Edit-Modus im UX-Konzept ab | M |
| C | **Minimal:** nur Schließen, Status, Speichern; Undo/Redo nur noch per Rückgängig-Toast | am ruhigsten | Redo entfällt, Undo nur für Löschungen; Tastenkürzel bleiben | S |

**Empfehlung: A.** ↶ und ↷ bleiben, weil sie der einzige Rettungsweg für Tippfehler über mehrere Felder sind. Sie kosten 88 pt. Wird es auf kleinen iPhones (375 pt) eng, wandert ↷ ins ⋮-Menü.

**Speicherstand** an der Stelle des Titels, eine Zeile, `aria-live="polite"`:

| Zustand | Text | Quelle |
|---|---|---|
| keine Änderung | „Gespeichert“ (grau) | `!isDirty` |
| Änderungen, noch nicht im Entwurf | „Nicht gespeichert“ | `isDirty` |
| Änderungen als Entwurf gesichert | „Entwurf gesichert“ | `isDirty && hasDraft` (Auto-Save nach 2 s) |
| Speichern läuft | „Speichert …“ | neu, Zustand zwischen Klick und `SaveResult` |
| nur auf diesem Gerät (`local`) | „Nur auf diesem Gerät“ | `SaveResult.status === "local"` |

Der Text übernimmt die Begriffe der Speicherlogik und ändert sie nicht (W.37/W.38 bleiben maßgeblich). Mit 12.1 kommt „Wird übertragen“ hinzu (Abschnitt 6.3).

**Entwurf sichtbar machen:** Öffnet der Editor mit Entwurf, steht unter der Kopfleiste ein Banner: „Entwurf vom 17.11., 14:20 wiederhergestellt · [Verwerfen]“. Er bleibt, bis P4 etwas ändert oder ihn schließt. Heute verschwindet der Hinweis als Toast nach 5 s. Zeitstempel: `useDraft` speichert heute nur das Rezept. Der Zeitpunkt muss in den Entwurf (`{savedAt, recipe}` oder `lastUpdated` des Entwurfs). Das ist eine kleine Änderung an `useDraft`, keine an der Speicherlogik; alte Entwürfe ohne Zeit zeigen „Entwurf wiederhergestellt“.

**Verlassen (E-01):**
- **Ohne Änderungen** schließt der Editor still.
- **Mit Änderungen** erscheint ein Action-Sheet (Skizze 5.5):
  - **Speichern:** wie der Knopf. Bei `saved` oder `local` verlässt der Editor die Seite; bei `failed` bleibt er offen und meldet den Grund, der Entwurf bleibt.
  - **Als Entwurf behalten:** heutiges Verhalten. Der Editor schließt, der Entwurf liegt auf Home unter „Entwürfe“.
  - **Verwerfen** (rot): löscht den Entwurf, verlässt den Editor. Das ist die einzige Stelle, an der ein Entwurf ohne zweiten Schritt endet. Das Sheet ist die Bestätigung.
  - **Weiter bearbeiten:** schließt das Sheet.
- **Zurück-Geste, Tab-Wechsel und Router-Navigation** laufen über dasselbe Sheet (`onBeforeRouteLeave`; das ungenutzte `useUnsavedGuard` wird dafür ersetzt). `beforeunload` (Seite schließen, Neuladen) kann kein eigenes Sheet zeigen. Dort bleibt es beim stillen Sichern des Entwurfs (`flushIfDirty`), wie heute.
- **„Änderungen verwerfen …“ im ⋮-Menü** setzt auf den gespeicherten Stand zurück und bleibt im Editor. Rückfrage über den Bestätigungsdialog aus U.11 statt `confirm()` (X-08).

Damit gilt die Vorgabe aus dem Auftrag: Ein Entwurf geht nur über „Verwerfen“ im Sheet oder „Änderungen verwerfen“ mit Rückfrage verloren.

---

## 5. Skizzen iPhone

Breite 390 pt, hell. `▢` = Feld, `[ ]` = Knopf, `⋯` = Zeilenmenü. Die Kopfleiste nutzt die Chrome-Farbe wie heute.

### 5.1 Editor oben: Kopfleiste, Titel, Tags, Bild

```
┌─────────────────────────────────────┐
│ Schließen  Entwurf  ↶ ↷ ⋮ [Speichern]│  ← Chrome; Speichern primär (Text)
│            gesichert                │  ← Status, 13 px, Texte siehe 4.4
├─────────────────────────────────────┤
│ ⓘ Entwurf vom 17.11., 14:20         │  ← nur mit Entwurf
│   wiederhergestellt     [Verwerfen] │
├─────────────────────────────────────┤
│ Titel                               │
│ ▢ Lasagne alla Bolognese          ▢ │  ← 44 pt, 16 px
│ Untertitel                          │
│ ▢ wie bei Oma                     ▢ │
│                                     │
│ Tags                                │
│ (Pasta ✕) (Ofen ✕) (＋ Tag)         │  ← Chips 44 pt hoch, öffnet Sheet 5.4
│                                     │
│ ┌──────────────┐                    │
│ │    Foto      │  [Foto ersetzen]   │  ← ohne Bild: [Foto wählen]
│ │              │  [Entfernen]       │     Entfernen nur bei echtem Bild (E-10)
│ └──────────────┘                    │
│ ▸ Vorlage (2 Seiten)                │  ← nur nach Foto-Import, zugeklappt
│                                     │
│ Ergibt  ▢ 6  ▢ Portionen            │  ← E-07; „Exponent“ unter Weitere Angaben
│ ◉ Mengen beim Ändern mitrechnen     │
└─────────────────────────────────────┘
```

Die Kopfleiste in einer Zeile: Schließen ≈ 80, ↶ ↷ ⋮ je 44, Speichern ≈ 96 → bleiben ≈ 70 pt für den Status. „Nicht gespeichert“ passt in 16 px nicht ganz. Daher steht der Status in 13 px, notfalls zweizeilig unter der Leiste. Die Ausführung entscheidet sich in U.5 am Screenshot, die Reihenfolge der Elemente steht.

```
 ⋮-Menü:
 ┌───────────────────────────┐
 │ 👁  Vorschau               │
 │ ↷  Wiederherstellen       │  ← nur auf 375-pt-Geräten hier
 │ ───────────────────────── │
 │ Änderungen verwerfen …    │  ← rot, Rückfrage
 └───────────────────────────┘
```

### 5.2 Zutaten in einem Abschnitt

Ohne Abschnitte (Normalfall):

```
│ ZUTATEN                             │
│ ▢ 400 │▢ g    │▢ Rinderhackfleisch │⋯│
│ ▢ 1   │▢ Stück│▢ Zwiebel           │⋯│
│ ▢ 150 │▢ ml   │▢ Rotwein, trocken  │⋯│
│        ↳ ▢ oder Brühe            ✕  │  ← Notiz nur wenn vorhanden
│ ▢     │▢      │▢ Salz              │⋯│  ← Menge leer bleibt leer (E-04)
│ [＋ Zutat]                          │  ← 44 pt, neue Zeile, Fokus auf Menge
│                                     │
│ SCHRITTE  → 5.3                     │
│ …                                   │
│ In Abschnitte aufteilen …           │  ← dezent, Textlink 44 pt
```

Mit Abschnitten:

```
│ Ragù                            ⋯  │  ← Überschrift, ⋯ = Abschnittsmenü
│ ZUTATEN                             │
│ ▢ 3   │▢ EL   │▢ Olivenöl          │⋯│
│ …                                   │
│ [＋ Zutat]                          │
│ SCHRITTE                            │
│ …                                   │
│ ─────────────────────────────────── │
│ Béchamel                        ⋯  │
│ …                                   │
│ [＋ Abschnitt]                      │
```

```
 Zeilenmenü ⋯ (Sheet)                 Abschnittsmenü ⋯ (Sheet)
 ┌───────────────────────────┐        ┌───────────────────────────┐
 │ Rotwein, trocken          │        │ Béchamel                  │
 │ ───────────────────────── │        │ ───────────────────────── │
 │ Notiz hinzufügen          │        │ Umbenennen                │
 │ Nach oben                 │        │ Nach oben                 │
 │ Nach unten                │        │ Nach unten                │
 │ In Abschnitt …          › │        │ Löschen …                 │ ← rot
 │ Löschen                   │ ← rot  │ ───────────────────────── │
 │ ───────────────────────── │        │ Abbrechen                 │
 │ Abbrechen                 │        └───────────────────────────┘
 └───────────────────────────┘
   Löschen → Toast „Zutat gelöscht · Rückgängig“

 Abschnitt löschen (Sheet):
 ┌─────────────────────────────────────┐
 │ „Béchamel“ löschen?                 │
 │ 4 Zutaten und 3 Schritte            │
 │ [Inhalt in „Ragù“ übernehmen]       │  ← vorheriger Abschnitt, beim ersten der nächste
 │ [Abschnitt mit Inhalt löschen]      │  ← rot
 │ [Abbrechen]                         │
 └─────────────────────────────────────┘

 In Abschnitte aufteilen (Sheet):
 ┌─────────────────────────────────────┐
 │ In Abschnitte aufteilen             │
 │ Bisheriger Teil heißt               │
 │ ▢ Teig                            ▢ │
 │ Neuer Abschnitt                     │
 │ ▢ Füllung                         ▢ │
 │ Name schon vergeben → Hinweis       │
 │ [Abbrechen]          [Aufteilen]    │
 └─────────────────────────────────────┘
```

### 5.3 Schritte

```
│ SCHRITTE                            │
│ 1  ▢ Zwiebel, Karotte und Sellerie  │
│      fein würfeln und in Olivenöl   │
│      glasig dünsten.             ⋯  │  ← Textfeld wächst mit, 16 px
│ 2  ▢ Hackfleisch zugeben und        │
│      krümelig braten.            ⋯  │
│      ↳ ▢ Bei uns 10 min länger   ✕  │  ← Notiz erscheint sofort mit Fokus (E-17)
│ 3  ▢ Mit Rotwein ablöschen …     ⋯  │
│ [＋ Schritt]                        │
```

Nummerierung je Abschnitt oder durchgehend folgt der Entscheidung R-13 (U.4). Der Editor übernimmt sie (E-11).

### 5.4 Tags (Sheet)

```
┌─────────────────────────────────────┐
│              ───                    │  ← Griff, nach unten wischen schließt
│ Tags                        [Fertig]│
│ ▢ 🔍 weih                          │  ← Suche, Fokus beim Öffnen
├─────────────────────────────────────┤
│ ✓ Weihnachten                       │  ← vorhandener Tag, Schreibweise übernommen
│   Weihnachtsplätzchen               │
│ ＋ „weih“ als neuen Tag anlegen      │  ← nur wenn kein exakter Treffer
├─────────────────────────────────────┤
│ AUSGEWÄHLT                          │
│ (Pasta ✕) (Ofen ✕) (Weihnachten ✕)  │
└─────────────────────────────────────┘
  Ohne Suchtext: alle Tags alphabetisch, ausgewählte oben.
  Editor: ändert das Rezept (gespeichert mit „Speichern“).
  Karte (U.14): speichert sofort per setRecipeTags, Rückmeldung wie heute.
```

### 5.5 Rückfrage beim Verlassen

```
┌─────────────────────────────────────┐
│  (Editor abgedunkelt)               │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Änderungen an „Lasagne“         │ │
│ │ speichern?                      │ │
│ │ ─────────────────────────────── │ │
│ │          Speichern              │ │  ← primär
│ │ ─────────────────────────────── │ │
│ │      Als Entwurf behalten       │ │  ← heutiges Verhalten, auf Home unter „Entwürfe“
│ │ ─────────────────────────────── │ │
│ │          Verwerfen              │ │  ← rot, löscht Entwurf
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │       Weiter bearbeiten         │ │  ← Abbrechen-Rolle, Escape, Tipp auf Hintergrund
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
  Speichern scheitert → Sheet schließt, Editor bleibt, Meldung (saveFailedMessage).
```

### 5.6 Seitenreihenfolge gesamt

1. Kopfleiste, ggf. Entwurf-Banner
2. Titel, Untertitel
3. Tags
4. Bild, Vorlage
5. Ergibt (Portionen)
6. Zutaten und Schritte, ggf. je Abschnitt
7. „In Abschnitte aufteilen …“ bzw. „＋ Abschnitt“
8. ▸ Weitere Angaben: Autor, Quelle, Zeiten, Schwierigkeit, Notizen, Exponent (zugeklappt, E-09)

Heute stehen die Metadaten vor Portionen und Bild. Für P4 sind sie selten, deshalb ans Ende. Am Tablet bleiben zwei Spalten wie heute (Zutaten | Schritte je Abschnitt), die Zeilen bekommen dieselbe Reihenfolge und dasselbe ⋯-Menü, die Griffe bleiben.

---

## 6. Abgrenzung zu verwandten Punkten

### 6.1 Rezept-Wizard 7.1

Der Wizard (UI-Roadmap Sprint 7) plant vier Schritte: Grunddaten, Metadaten, erster Abschnitt, weitere Abschnitte → Vorschau → Speichern. Sein Ziel ist „Guided Recipe Creation statt leerer Editor“.

| | Option | Bewertung |
|---|---|---|
| a | **Wizard zusätzlich** zum Gegenentwurf | zwei Oberflächen für dieselben Daten; jede Änderung an Zutatzeile oder Abschnitten doppelt; der Wizard endet ohnehin im Editor, sobald man korrigiert. Widerspricht „Kein separates Inline-Edit. Nur Full-Editor.“ sinngemäß |
| b | **Gegenentwurf macht den Wizard überflüssig, 7.1 wird „Anlegen vereinheitlichen“** (empfohlen) | Was der Wizard leisten sollte, übernimmt der Editor selbst. Die Abschnitte stellen sich mit Option 4.1 B erst bei Bedarf, ein Wizard-Schritt dafür entfällt. Die Metadaten sind zugeklappt am Ende, ein Überspringen-Schritt ist nicht nötig. Für den leeren Zustand bekommt ein neues Rezept Titel mit Fokus, eine leere Zutatzeile und eine leere Schrittzeile mit Platzhaltern wie „z. B. 200 │ g │ Mehl“. |
| c | **Wizard ersetzt den Editor für neue Rezepte** | wie a, nur schlimmer: Wer nach dem Anlegen etwas ändern will, lernt eine zweite Oberfläche |

**Empfehlung b.** Der offene Kern von 7.1 ist ohnehin nicht die Führung, sondern das **Anlegemuster** (Audit 8):
- Ein neues Rezept entsteht erst beim ersten Speichern (H-03, keine Karteileiche).
- Der KI-Import geht direkt in den Editor als ungespeichertes Rezept (A-02).
- „Schließen“ ohne Speichern verwirft ohne Spuren bzw. fragt (E-01).
- FAB, KI-Import und Duplizieren nutzen denselben Weg.

Das berührt `appendRecipe`, Vormerkung und Entwurf (W.37/W.38) und ist deshalb nicht Teil von U.5/U.6 („Speicher- und Entwurfslogik ändern“ ist ausgeschlossen). Vorschlag: 7.1 umbenennen in „Anlegen erst beim Speichern, ein Anlegeweg“, Aufwand M, Opus, nach U.6. Den leeren Zustand (Platzhalter, Fokus) liefert U.6 bereits mit.

### 6.2 KI-Import (A-01 bis A-04, U.7)

- Nach dem Import landet P2 bzw. P4 im **selben Editor**. Alles aus Abschnitt 4 gilt dort unverändert, es gibt keinen eigenen Import-Editor.
- Besonders relevant nach dem Import:
  - Tags (E-08 → 4.3)
  - Abschnitte mit verwaisten oder doppelten Namen aus der KI-Antwort (E-12, E-13 → Regeln 1–3)
  - die Vorlage zum Abgleich (E-10, bleibt zugeklappt unter dem Bild)
- Ein Hinweis-Banner „Mit KI erkannt – bitte gegen die Vorlage prüfen“ wäre denkbar. Er braucht aber ein Kennzeichen „frisch importiert“, das es im Rezept nicht gibt; die Vorlage selbst signalisiert es. Nicht vorgeschlagen.
- **A-01** (Footer „Cancel / OK“): Laut `.claude/rules/frontend.md` heißt die Prop `no-footer`, das Vorschau-Modal im Editor setzt sie schon (`Edit.vue:699`). Ob der KI-Dialog noch betroffen ist, prüft U.7. Den Editor betrifft A-01 nicht mehr.
- **A-02** (direkt in den Editor) hängt an 7.1 (6.1). **A-03** und **A-04** liegen im Dialog vor dem Editor und bleiben bei U.7.

### 6.3 Offline-Bearbeitung 12.1

Heute: Der Editor braucht für ein Serverrezept die vollständige Fassung (`loadCompleteRecipe`, sonst Meldung statt Editor). Speichern ohne Verbindung scheitert mit `OfflineError`, der Entwurf bleibt (W.37). Vorgemerkte Rezepte speichern lokal (`local`).

Falls 12.1 eine Änderungs-Warteschlange bringt, ändert sich am Konzept:
- **Speicherstand:** zusätzlicher Zustand „Wird übertragen“ bzw. „Nur auf diesem Gerät“ für Serverrezepte. Die Tabelle in 4.4 ist darauf ausgelegt, Texte und Plätze bleiben.
- **Verlassen-Sheet:** „Speichern“ gelingt dann auch offline. „Als Entwurf behalten“ verliert an Gewicht und kann bleiben oder entfallen; das entscheidet 12.1.
- **Konflikte:** Ein Konflikt beim Übertragen (zwei Geräte, `updated_at`) braucht eine eigene Ansicht, „deine Fassung / Serverfassung“. Die gehört zu 12.1, nicht in den Editor-Rahmen. Das Tag-Risiko aus 4.3 geht darin auf.
- **Tags offline:** Die Vorschläge stammen schon aus der lokalen Liste und funktionieren.
- Zeilen, Abschnitte und Tag-Sheet bleiben unverändert. Das Konzept legt nichts fest, was 12.1 zurückbauen müsste.

### 6.4 Karten und Tags (U.14)

U.14 nennt „Tag-Bedienung in der Übersicht touch-tauglich (Abgleich PO)“. Mit 4.3 B ist das dasselbe `TagPicker`-Sheet, aus dem Kartenmenü geöffnet, mit sofortigem Speichern per `setRecipeTags`. Der heutige Inline-Tag-Editor in `RecipeCard.vue` entfällt. U.14 baut damit keine eigene Bedienung und übernimmt die Komponente aus U.5. Reihenfolge: U.5 vor U.14, wie in der Roadmap ohnehin vorgesehen (U.14 nach U.11).

---

## 7. Entscheidungen

| # | Frage | Empfehlung |
|---|---|---|
| D1 | Persona P4 „Familienmitglied, bearbeitet gelegentlich, iPhone“ als Maßstab für den Editor aufnehmen, P2 bleibt Maßstab für Tablet und Import? | **ja** |
| D2 | Abschnitte: Karten reparieren (A), nur bei Bedarf (B), Zwischenüberschriften in getrennten Listen (C)? | **B** |
| D3 | Abschnittsnamen: eindeutig, beim Anlegen abgefragt; ein unbenannter Abschnitt neben benannten bleibt erlaubt (Altbestand)? Verwaiste Einträge beim Laden als Abschnitt ergänzen? | **ja / ja** (Regeln 1–3, ohne Migration) |
| D4 | Abschnitt löschen: Wahl „Inhalt übernehmen“ oder „mit Inhalt löschen“, danach Rückgängig? | **ja** |
| D5 | Zutatzeile: drei Felder Menge \| Einheit \| Name (A), ein Textfeld mit Zerlegung (B), Lesezeile mit Sheet (C)? | **A**; „Liste einfügen“ aus B als Idee |
| D6 | Notiz, Verschieben, Löschen je Zeile im ⋯-Menü, Löschen mit Rückgängig-Toast; Griffe nur im breiten Layout? | **ja**; langes Drücken zum Ziehen nach Gerätetest |
| D7 | Menge als Textfeld mit Parser (Komma, Punkt, Brüche), leer = `null`, auch für „Ergibt“? | **ja** |
| D8 | Tags: Chips + Auswahl-Sheet, dieselbe Komponente an der Karte (U.14)? | **ja (B)** |
| D9 | Kopfleiste: `Schließen · Status · ↶ ↷ ⋮ · Speichern`; Vorschau und Verwerfen ins ⋮; „Entwurf löschen“ entfällt? | **ja (A)** |
| D10 | Verlassen mit Änderungen: Sheet mit Speichern / Als Entwurf behalten / Verwerfen / Weiter bearbeiten, auch für Zurück-Geste und Tabs? | **ja** |
| D11 | Entwurf beim Öffnen als Banner mit Zeitpunkt statt Toast (Zeitstempel im Entwurf)? | **ja** |
| D12 | Seitenreihenfolge: Weitere Angaben (Autor, Quelle, Zeiten, Schwierigkeit, Notizen, Exponent) zugeklappt ans Ende? | **ja** |
| D13 | 7.1: Wizard streichen und als „Anlegen erst beim Speichern, ein Anlegeweg“ neu schneiden? | **ja (b)** |
| D14 | U.5/U.6 nach Bereichen statt nach Gerät schneiden, U.11 vorziehen? | **ja** (Abschnitt 8) |

Nicht hier zu entscheiden, aber verknüpft: Schrittnummern (R-13, bei U.4) und das Glossar (X-06, bei U.10: „Speichern“, „Entwurf“, „Verwerfen“ sollten dort aufgenommen werden).

---

## 8. Folgen für die Roadmap

### 8.1 Neuer Zuschnitt U.5 / U.6

Heute: U.5 „Editor“ (E-01, E-02, E-04, E-06–E-11) und U.6 „Editor mobil“ (E-03, E-05, X-07). Beide ändern dieselben Dateien (`Edit.vue`, `SectionCard`, `IngredientRow`, `StepRow`, Composables). Die Trennung Desktop/mobil passt nicht: Das Konzept ändert die Komponenten selbst, responsiv, nicht eine mobile Variante. Vorschlag: nach Bereichen.

| Punkt | Inhalt | Befunde | Aufwand | Abhängigkeit |
|---|---|---|---|---|
| **U.5 Editor: Rahmen und Kopf** | Kopfleiste mit Status und ⋮ (D9), Verlassen-Sheet und Route-Guard (D10), Entwurf-Banner mit Zeitstempel in `useDraft` (D11), Seitenreihenfolge und „Weitere Angaben“ (D12), Ergibt-Block mit Parser (D7 für Portionen), Bild (E-10), Tag-Chips und `TagPicker` (D8), 16 px/44 pt für diese Felder | E-01, E-02, E-04 (Portionen), E-07, E-08, E-09, E-10, X-03/X-07 (Kopfbereich) | M | nach U.11 (Sheet, Bestätigung, Menü); sonst baut U.5 eigene Sheets und U.11 muss sie zurückbauen |
| **U.6 Editor: Rezeptinhalt** | Zutatzeile A mit ⋯-Menü, Rückgängig-Toast, Fokusführung, Mengen-Parser (D5–D7); Schrittzeile; Abschnitte B mit Aufteilen/Menü/Löschen-Sheet und Regeln 1–3 (D2–D4); leerer Zustand für neue Rezepte; Griffe nur breit (D6); Schrittnummern nach R-13 | E-03, E-04 (Zutaten), E-05, E-06, E-11, E-12, E-13, E-14, E-17, X-03/X-07 (Inhalt) | **M–L** | nach U.5 (gleiche Dateien `Edit.vue`), nach U.4 wegen R-13 oder R-13 vorab entscheiden |

Falls U.6 als zu groß gilt, geht ein Schnitt sauber: **U.6a** Zeilen (Zutaten, Schritte, ⋯-Menü, Parser) und **U.6b** Abschnitte (Aufteilen, Menü, Regeln 1–3). Sie laufen nacheinander, weil beide `SectionCard` ändern. E-12/E-13 (Regeln 1–3) sind Datenfehler-Vorbeugung und könnten als XS–S vorab laufen, unabhängig von der Oberfläche. Das lohnt sich, falls U.6 noch länger wartet.

**Neue Befunde:** E-12, E-13, E-14, E-17 (Abschnitt 2.2), alle in U.6.
**Entfallende Befunde:** keine ganz. E-02 „🗑 Entwurf löschen“ entfällt als Element. A-01 betrifft den Editor nicht mehr (Vorschau hat `no-footer`).
**Aufwand gesamt:** vorher M + M, nachher M + M–L. Das Mehr kommt aus Abschnitte B, dem `TagPicker` und den neuen Befunden.

### 8.2 Weitere Punkte

- **U.11** vor U.5 ziehen: Sheet, Action-Sheet, Bestätigungsdialog und Menü-Popover sind in U.5/U.6 an fünf Stellen nötig (Verlassen, ⋮, Tags, Zeilenmenü, Abschnitt). In der Roadmap steht U.11 schon frei (W.15 ist erledigt).
- **U.14:** übernimmt `TagPicker` aus U.5 für die Karte, entfernt den Inline-Tag-Editor in `RecipeCard.vue`. Aufwand eher kleiner.
- **7.1:** neu schneiden als „Anlegen erst beim Speichern, ein Anlegeweg“ (6.1): H-03, A-02, Duplizieren; Wizard entfällt. M, Opus, nach U.6. Berührt `appendRecipe`/Vormerkung; daher eigener Punkt mit eigener Verifikation.
- **U.7:** A-02 nur zusammen mit dem neuen 7.1; A-01 prüfen, ob nach W.15 noch offen.
- **U.10 (Glossar):** Begriffe des Editors aufnehmen: Speichern, Schließen, Entwurf, Verwerfen, Abschnitt, „Weitere Angaben“, „Ergibt“.
- **Datenmodell:** **keine Änderung, keine Migration.** Abschnitts-IDs (Abschnitt 3) und Spannen bei Mengen (4.2) sind ausdrücklich nicht vorgeschlagen.
- **Ideen** (für `docs/IDEAS.md`, durch den Master):
  - „Zutatenliste einfügen“ mit einmaliger Zerlegung (4.2 B)
  - Tag-Schreibweisen im Bestand vereinheitlichen (Wartung)
  - Brüche in der Rezeptansicht anzeigen

---

## 9. Am Gerät prüfen

Auf iPhone (installierte PWA) und iPad, vor bzw. während U.5/U.6:

| # | Was | Erwartung | Bezug |
|---|---|---|---|
| 1 | `inputmode="decimal"` bei deutscher Region: welches Trennzeichen? | Ziffernblock mit „,“ | D7 |
| 2 | Zutatzeile mit 164 pt Namensbreite in SF Pro 16 px: wie viele Zeichen passen? | „Rinderhackfleisch“ ohne Umbruch | 4.2 |
| 3 | Fokus „Weiter“ (`enterkeyhint="next"`) Menge → Einheit → Name → neue Zeile; Tastatur bleibt offen | kein Zuklappen zwischen den Feldern | 4.2 |
| 4 | Langes Drücken zum Ziehen (SortableJS `delayOnTouchOnly`) gegen Scrollen | eindeutig, kein versehentliches Verschieben | D6, Audit 11 Nr. 9 |
| 5 | Wischen zurück vom linken Rand in der Standalone-PWA: löst es `onBeforeRouteLeave` aus, und erscheint das Sheet? | Sheet erscheint, Seite bleibt | D10 |
| 6 | Sheets mit eingeblendeter Tastatur (Tag-Suche, Abschnittsnamen): bleibt das Feld sichtbar? | Feld über der Tastatur | 4.3, 4.1 |
| 7 | Kopfleiste auf 375 pt (iPhone SE/mini): passt die Zeile? | sonst ↷ ins ⋮ | D9 |
