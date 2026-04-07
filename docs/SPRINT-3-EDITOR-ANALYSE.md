# Sprint 3: Editor-Neugestaltung – Analyse

## 1. Datenstruktur

```typescript
Recipe {
  recipe_name, subtitle, author, source_url, source_book,
  servings, prep_time, cook_time, bake_time, total_time,
  difficulty, notes, tags[],
  yields[{ unit, value }], recalc_exp,
  imageurl, first_image_id,
  sections: Section[]        // Abschnitte (z.B. "Teig", "Füllung")
  ingredients: Ingredient[]  // ALLE Zutaten flach, über .section zugeordnet
  steps: Step[]              // ALLE Schritte flach, über .section zugeordnet
}
```

**Kern-Architektur:** Abschnitte werden als separate Liste gepflegt. Zutaten und Schritte sind flache Arrays, deren `.section`-String bestimmt, zu welchem Abschnitt sie gehören. Das ist die Quelle der meisten UX-Probleme.

---

## 2. Aktuelle Komponenten-Struktur

| Komponente | Zeilen | Aufgabe |
|---|---|---|
| **Edit.vue** | ~620 | Haupt-Editor: Titel, Metadaten, Foto, Abschnitte, YAML-Preview |
| **SectionIngredientsEdit.vue** | ~30 | Filtert Zutaten nach section, rendert IngredientEdit pro Zutat |
| **IngredientEdit.vue** | ~110 | Einzelne Zutat: Name (read-only!), Menge, Einheit, Section-Dropdown, Reorder, Notizen, Rename-Modal |
| **IngredientModalDialogRename.vue** | ~60 | Modal um Zutat umzubenennen |
| **IngredientNotesFormRow.vue** | ~50 | Notizen-Liste pro Zutat |
| **StepEdit.vue** | ~70 | Einzelner Schritt: Text-Input, Section-Dropdown, Reorder |
| **ArrayReorderBtnGroup.vue** | ~30 | ▲/▼ Buttons zum Array-Umordnen |

---

## 3. Vollständige Feature-Liste (darf nichts verloren gehen)

### Kopfdaten
- [x] Titel + Untertitel bearbeiten
- [x] Metadaten: Autor, Quellen (URL/Buch), Zeiten (Prep/Cook/Bake/Total), Schwierigkeit, Notizen, Portionen
- [x] Tags: Hinzufügen, Entfernen (Badges mit ×)
- [x] Yields: Menge + Einheit + Umrechnungsexponent + Umrechnen-Toggle
- [x] Bild: Web-URL, Upload, Vorschau, Löschen vorhandener Bilder
- [x] YAML-Vorschau (readonly Textarea)

### Abschnitte
- [x] Abschnitte CRUD (Name bearbeiten, Hinzufügen, Löschen)
- [x] Abschnitte umordnen (▲/▼)

### Zutaten
- [x] Alle Zutaten nach Abschnitt gruppiert anzeigen
- [x] Zutat hinzufügen (→ öffnet sofort Rename-Modal)
- [x] Zutat umbenennen (Modal-Dialog)
- [x] Menge + Einheit bearbeiten (Einheiten-Autocomplete aus allen Rezepten)
- [x] Zutat einem anderen Abschnitt zuweisen (Section-Dropdown)
- [x] Zutat löschen
- [x] Zutat umordnen (▲/▼ innerhalb des Gesamt-Arrays)
- [x] Zutat-Notizen: Hinzufügen, Bearbeiten, Löschen (Collapse-Panel)

### Schritte
- [x] Alle Schritte nach Abschnitt gruppiert anzeigen
- [x] Schritt hinzufügen
- [x] Schritt-Text bearbeiten (einzeiliges Input)
- [x] Schritt einem anderen Abschnitt zuweisen (Section-Dropdown)
- [x] Schritt löschen
- [x] Schritt umordnen (▲/▼)

### Speichern & Navigation
- [x] Speichern-Button (Navbar) + Ctrl+S Shortcut
- [x] Änderungserkennung (deep-equal)
- [x] Toast-Feedback (Gespeichert/Unverändert/Fehler)
- [x] Rezept-Navigation (Dropdown in Navbar)

---

## 4. UX-Probleme des aktuellen Editors

### 🔴 Kritisch

1. **Abschnitte, Zutaten und Schritte sind visuell getrennt**
   - Abschnitte: eigener Block ganz oben
   - Zutaten: gruppiert nach Abschnitt, darunter
   - Schritte: nochmal gruppiert nach Abschnitt, ganz unten
   - → Man sieht nie Zutaten + Schritte eines Abschnitts zusammen
   - → Zuordnung nur über Dropdown-Auswahl, nicht visuell erkennbar

2. **Zutatname nicht direkt editierbar**
   - Name wird nur als Text angezeigt, Änderung nur über Modal-Dialog
   - 3 Klicks für einen Tippfehler: Stift-Button → Feld ausfüllen → OK

3. **Schritte sind einzeilig**
   - Nur `<BFormInput>` (einzeilig) statt Textarea
   - Längere Schritte werden abgeschnitten, nicht scrollbar

4. **Kein visueller Zusammenhang zwischen Abschnitt/Zutaten/Schritten**
   - Ohne Sections-Dropdown erkennt man nicht, wohin ein Item gehört
   - Verschieben zwischen Abschnitten erfordert mentales Mapping

### 🟡 Wichtig

5. **Zu viele kleine Buttons nebeneinander**
   - Pro Zutat: 🗑️ 💬 ✏️ ▲ ▼ = 5 Buttons in einer Zeile
   - Auf Mobile kaum bedienbar (zu klein, kein 44px Target)

6. **Flache Seiten-Hierarchie**
   - Alles ist ein gleichwertiger Formular-Block untereinander
   - Keine visuelle Gruppierung, keine Cards, keine Einrückung
   - Die Seite ist sehr lang und unübersichtlich

7. **Abschnitt-Management umständlich**
   - Abschnitte müssen separat erstellt werden, bevor man sie Zutaten/Schritten zuweist
   - Kein "Abschnitt erstellen und direkt Zutaten zuweisen"

8. **Reorder nur mit Buttons**
   - ▲/▼ funktioniert, aber kein Drag & Drop
   - Langsam bei vielen Items

### 🟢 Minor

9. **YAML-Vorschau ist ein Entwickler-Feature**
   - Nützlich zur Kontrolle, aber nimmt Platz ein
   - Sollte optional/collapsed sein

10. **Kein Undo/Redo**
    - Kein Ctrl+Z auf struktureller Ebene (nur Browser-Undo in Textfeldern)

---

## 5. Konzeptvorschlag: Card-basierter Editor

### Kernidee
Jeder Abschnitt wird als **eine Card** dargestellt, die Zutaten UND Schritte zusammen enthält. Das macht die Zuordnung visuell sofort klar.

```
┌──────────────────────────────────────────────────────────┐
│ 📦 TEIG                                 [▲][▼][🗑][···] │
│ ┌──────────────────────┬───────────────────────────────┐ │
│ │ ZUTATEN              │ SCHRITTE                      │ │
│ │                      │                               │ │
│ │ ≡ 200g Mehl   [▲▼][×]│ 1. Mehl und Zucker           │ │
│ │ ≡ 100g Zucker [▲▼][×]│    vermischen und... [▲▼][×] │ │
│ │ ≡ 3 Eier      [▲▼][×]│ 2. Eier unterrühren  [▲▼][×] │ │
│ │                      │                               │ │
│ │ [+ Zutat]            │ [+ Schritt]                   │ │
│ └──────────────────────┴───────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ 📦 GLASUR                               [▲][▼][🗑][···] │
│ ┌──────────────────────┬───────────────────────────────┐ │
│ │ ZUTATEN              │ SCHRITTE                      │ │
│ │ ...                  │ ...                           │ │
│ └──────────────────────┴───────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘

[+ Neuer Abschnitt]
```

**Legende:**
- `≡` = Drag Handle (Anfasser für Drag & Drop)
- `[▲▼]` = Reorder-Buttons (Fallback für Touch + Accessibility)
- `[×]` / `[🗑]` = Löschen (immer sichtbar)
- `[···]` = Kontextmenü nur für seltene Aktionen (Notizen, Abschnitt umbenennen)
- Klick auf Zutatname/Schritttext → Inline-Edit (Hover zeigt ✏️ + leichter Hintergrund als Affordance)

### Layout-Varianten
- **Desktop:** 2-Spalten innerhalb der Card (Zutaten links, Schritte rechts)
- **Tablet:** 2-Spalten mit schmalerem Zutaten-Teil
- **Mobile:** 1-Spalte (Zutaten oben, Schritte unten) innerhalb jeder Card

### Verbesserungen gegenüber heute

| Problem | Lösung |
|---|---|
| Zutaten/Schritte getrennt | Zusammen in einer Card pro Abschnitt |
| Zutatname nicht editierbar | Inline-Edit: Klick auf Name → wird zum Input |
| Schritte einzeilig | Auto-resize Textarea |
| Kein visueller Zusammenhang | Cards mit Header + Hintergrundfarbe |
| Zu viele Buttons | Primäraktionen (🗑, ▲▼) sichtbar, seltene (Notizen) ins ··· Menü |
| Abschnitt-Management | Expliziter Button „+ Neuer Abschnitt" erstellt neue Card |
| Verschieben zwischen Abschnitten | Drag & Drop einer Zutat/Schritt in andere Card |
| Kein Drag & Drop | Drag & Drop (Handle ≡) + ▲/▼ Buttons als Fallback |

### Rezepte ohne Abschnitte

Viele Rezepte haben keine Sections (nur einen leeren `""` Section-String). Für eine konsistente Bedienung gibt es **kein Sonderlayout** – das Card-Layout wird immer verwendet:

- **Ohne Abschnitte:** Eine einzelne Card ohne Section-Header. Zutaten + Schritte darin, identische Bedienung wie bei Rezepten mit Abschnitten.
- **1+ Abschnitte:** Jede Section ist eine Card mit editierbarem Header.
- **Abschnitt hinzufügen:** Expliziter Button „+ Neuer Abschnitt" erstellt neue Card. Beim ersten Abschnitt wird die bestehende Card um einen Header ergänzt.
- **Letzten Abschnitt löschen:** Header verschwindet, Items bleiben in der einen Card.
- **Prinzip:** Immer die gleiche Card-Struktur, nur der Section-Header ist sichtbar oder nicht. Kein impliziter Layout-Wechsel.

### Entscheidungen

1. **Datenstruktur:** ✅ Keine Änderung. Flache Arrays beibehalten, UI gruppiert nach `.section`.

2. **Drag & Drop:** ✅ `@vueuse/integrations` mit `useSortable` (SortableJS).
   - `@vueuse/core` ist bereits transitive Dependency (via bootstrap-vue-next)
   - Nur `sortablejs` kommt als echte neue Dependency dazu
   - `@vueuse/integrations` ist vollständig tree-shakeable
   - Composable-API (`useSortable(ref, list, options)`) passt zum `<script setup>`-Stil
   - Touch-Support, Drag zwischen Listen, Handles – alles out-of-the-box

3. **Zutat-Bearbeitung:** ✅ Inline, keine Modals. Klick auf Name → wird zum Input (Hover-State mit leichtem Hintergrund + ✏️ als Affordance). Notizen über Collapse-Panel, nicht Modal.

4. **YAML-Vorschau:** ✅ Hinter Experten-Modus-Toggle verstecken (Setting existiert bereits).

5. **Schritt-Nummerierung:** ✅ Pro Abschnitt (konsistent mit RecipeDisplay).

6. **Reorder-Methoden:** ✅ Drag & Drop (mit Handle ≡) + ▲/▼ Buttons als Fallback. Beides für Zutaten, Schritte und Abschnitt-Cards. DnD allein reicht nicht: kleine Touch-Targets sind frustrierend (Fitts' Law), Screenreader können kein DnD (Accessibility).

7. **Button-Sichtbarkeit:** ✅ Primäraktionen (Löschen, Reorder) bleiben sichtbar. Nur seltene Aktionen (Notizen, Abschnitt umbenennen) ins ··· Kontextmenü.

8. **Unsaved Changes Warning:** ✅ `beforeRouteLeave` Guard + `beforeunload` Event bei ungespeicherten Änderungen. Dirty-State aus bestehendem `deep-equal`-Check ableitbar.

9. **LocalStorage Draft (Auto-Save):** ✅ Debounced `watch` auf `current_recipe` speichert Arbeitsversion lokal.
   - `watch(current_recipe, debounce(saveDraft, 2000), { deep: true })`
   - Key: `draft:<recipe_uuid>`, Value: `JSON.stringify(recipe)`
   - `onBeforeUnmount`: sofortiger Flush des pending Debounce
   - Nach erfolgreichem Speichern: `localStorage.removeItem('draft:' + uuid)`
   - Ein Rezept als JSON ~5-10 KB → `setItem` <1ms, kein Performance-Problem
   - Worst Case bei Crash: max. 2 Sekunden Arbeit verloren

10. **Crash Recovery:** ✅ Beim Editor-Öffnung prüfen ob Draft existiert.
    - `localStorage.getItem('draft:' + uuid)` → Draft gefunden?
    - Dialog: „Ungespeicherte Änderungen gefunden – Wiederherstellen oder Verwerfen?"
    - Besonders wertvoll auf Tablet/Mobile in der Küche (App-Wechsel, Akku leer)

11. **Revert-Button:** ✅ Button „↩ Verwerfen" neben „💾 Speichern".
    - Stellt den Stand bei Editor-Öffnung wieder her (Original aus Store)
    - Löscht den LocalStorage Draft
    - Bestätigungsdialog wenn Änderungen vorhanden
    - Button nur aktiv wenn Dirty-State = true

12. **Live-Preview:** ✅ Button „👁 Vorschau" öffnet RecipeDisplay mit Draft-Daten.
    - Nutzt die existierende RecipeDisplay-Komponente – kein neuer Render-Code
    - Liest Rezept aus LocalStorage Draft (oder aktuellem Editor-State)
    - Umsetzung: Modal oder Split-View, je nach Viewport
    - Kostet fast nichts, weil die Anzeige-Komponente schon fertig ist

### UX-Hinweis: 2-Spalten-Balance

Das 2-Spalten-Layout (Zutaten | Schritte) kann unbalanciert wirken, wenn z.B. 2 Zutaten neben 8 Schritten stehen. Akzeptabel, da „+ Zutat" den Leerraum auffängt und der Fokus auf Klarheit (Zusammengehörigkeit) statt Kompaktheit liegt. Auf Mobile (1-Spalte) existiert das Problem nicht.
