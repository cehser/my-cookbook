# UI-Roadmap - my-cookbook

> **Planungsnotizen:** Siehe `PLANNING-NOTES.md` für den Entstehungsprozess  
> **Letzte Aktualisierung:** 7. Dezember 2025

---

## 📊 Übersicht

**Zielgruppe:** Familie · **Primäre Geräte:** Smartphone & Tablet (Küche), Desktop (Admin)  
**Haupt-Use-Case:** Rezept finden → beim Kochen nachschlagen  
**Design-Prinzip:** Funktional, professionell, klar, ansprechend

---

## 🎯 Implementierungsplan

### Phase 0: Navigation & Informationsarchitektur (Foundation)
**Sprint 0:** Navbar + Metadaten + Suche/Filter (3-4 Tage)

**Ziele:**
- Koch-fokussierte Navbar (Galerie, Favoriten, Suche prominent)
- Admin-Features im Dropdown (Einstellungen, Verwaltung, Cloud-Sync)
- Experten-Modus für YAML Import/Export (Toggle, Standard: AUS)
- Galerie & Verwaltung fusioniert (eine Ansicht)
- Vollständige Metadaten-Unterstützung (Autor, Quelle, Zeiten, Notizen, Tags)
- Suche & Filter (Titel + Tags, Multi-Select)
- Edit-Button aus Navbar → FAB im Rezept-Kontext
- Quick Actions auf Recipe Cards (✏️ ⭐ 🗑️)

**Neue Navbar-Struktur:**
```
🍳 Kochbuch                     [⚙️▼]
[🏠 Galerie] [⭐ Favoriten] [🔍 Suche]
```

**Betroffene Dateien:**
- `src/components/Navbar.vue`
- `src/views/Gallery.vue` (Suche/Filter, Quick Actions)
- `src/views/Recipe.vue` (Metadaten-Anzeige, FAB)
- `src/views/Edit.vue` (Metadaten-Felder)
- `src/components/RecipeSearchBar.vue` (neu)
- `src/components/TagFilter.vue` (neu)
- `src/components/RecipeMetadata.vue` (neu)
- `src/types/recipe.ts` (Interfaces erweitern)
- Settings Store (`expertMode`)

---

### Phase A: Koch-Ansicht optimieren (Kritisch)

#### Sprint 1: Split-View Desktop/Tablet (3-5 Tage)
**Ziel:** Parallele Ansicht Zutaten + Schritte, kein Hin-und-Her mehr

**Features:**
- Desktop: 35% Zutaten (sticky) | 65% Schritte
- Tablet: 40% Zutaten (sticky) | 60% Schritte
- Filter-Toggle: "Alle Zutaten" / "Nur aktueller Abschnitt"
- Abschnitts-Synchronisation (Scroll → Highlight)
- **Portionen-Skalierung:** Prominent im Header `[− 4 +]`
- Optional: Resizable Splitter

**Betroffene Dateien:**
- `src/views/Recipe.vue`
- CSS: Split-View Styles

---

#### Sprint 2: Mobile FAB + Slide-In (2-3 Tage)
**Ziel:** Orientierungsabhängige Koch-Ansicht für Smartphones

**Features:**
- **Portrait:** FAB rechts unten → Slide-In Panel (70% Höhe), beide Bereiche scrollbar
- **Landscape:** Automatisch Split-View (40/60)
- Swipe-Down zum Schließen
- Abschnitts-Synchronisation

**Betroffene Dateien:**
- `src/views/Recipe.vue`
- `src/components/IngredientsPanelMobile.vue` (neu)
- CSS: FAB, Slide-In Animation, Landscape Media Queries

---

#### Sprint 3: Inline-Editing (3-4 Tage)
**Ziel:** Kleine Anpassungen ohne Editor-Wechsel

**Features:**
- Klick auf Zutat → Menge bearbeiten (größere Input-Felder)
- Doppelklick auf Schritt → Text bearbeiten
- Auto-Save nach 1 Sekunde Inaktivität
- Visuelles Feedback (✓ Gespeichert)
- Optional: Undo-Funktion (10 Sek)

**Betroffene Dateien:**
- `src/views/Recipe.vue`
- `src/components/IngredientInlineEdit.vue` (neu)
- `src/components/StepInlineEdit.vue` (neu)

---

### Phase B: Editor-Neugestaltung (Kritisch)

#### Sprint 4: Rezept-Erstellungs-Wizard (1 Woche)
**Ziel:** Guided Recipe Creation statt leerer Editor

**4-Schritte-Assistent:**
1. Grunddaten (Titel, Bild, Beschreibung, Portionen, Zeiten)
2. Metadaten (Autor, Quelle, Tags) - überspringbar
3. Erster Abschnitt (Zutaten + Schritte)
4. Weitere Abschnitte oder Fertig → Vorschau → Speichern

**Betroffene Dateien:**
- `src/components/RecipeWizard.vue` (neu)
- `src/views/Edit.vue` (Wizard-Integration)

---

#### Sprint 5: Editor-Überarbeitung (2-3 Wochen)
**Ziel:** Intuitive Bearbeitung auf allen Geräten

**Lösungen:**
- **Card-Layout:** Ein Abschnitt = Karte (Zutaten + Schritte zusammen)
- **Responsive:** 1 Spalte (Mobile), 2 Spalten (Desktop)
- **Touch-optimiert:** Min. 44x44px Buttons, großzügige Abstände
- **Größere Input-Felder** (besonders Zutaten)
- **Keyboard-Shortcuts** (Enter, Tab, Shift+↑↓)
- **Drag & Drop reparieren** (Touch-Support, visuelles Feedback)
- **Inline-Buttons:** +/− direkt bei Zutat/Schritt
- **Optional:** Live-Preview, Collapse/Expand Abschnitte

**Mock-up:**
```
┌─────────────────────────────────────────┐
│ [← Zurück] Rezept bearbeiten [💾 Speichern] │
├─────────────────────────────────────────┤
│ 📸 [Bild] Titel: [Apfelkuchen_____]    │
│ Portionen: [4_] Zeit: [60_] Min        │
├─────────────────────────────────────────┤
│ ┌─ 📦 TEIG ──────────── [▲][▼][✕]      │
│ │ ZUTATEN    │  SCHRITTE              │
│ │ [200]g     │  1. [Mehl und...]      │
│ │ [Mehl___]  │  [+ Schritt]           │
│ │ [+ Zutat]  │                        │
│ └────────────────────────────────────  │
│ [+ Neuer Abschnitt]                    │
└─────────────────────────────────────────┘
```

**Betroffene Dateien:**
- `src/views/Edit.vue` (Komplett-Überarbeitung)
- `src/components/SectionEdit.vue` (neu - Card)
- `src/components/IngredientEdit.vue` (vereinfachen)
- `src/components/StepEdit.vue` (vereinfachen)
- Vuedraggable aktualisieren oder SortableJS

---

### Phase C: Koch-Workflow-Features (Optional)

#### Sprint 6: Tabbed Recipe Interface (3-4 Tage)
**Ziel:** Multi-Rezept Navigation ohne Positionsverlust

**Features:**
- Browser-Style Tabs für mehrere Rezepte
- Scroll-Position pro Tab gespeichert
- Galerie immer als erster Tab
- Max. 5 offene Rezepte
- Swipe-Gesten (Mobile)
- LocalStorage Persistence

**Betroffene Dateien:**
- `src/App.vue`
- `src/components/RecipeTabBar.vue` (neu)
- `src/store/modules/recipeTabs.ts` (neu)
- `src/router/index.ts`

---

#### Sprint 7: Einkaufsliste-Export (1-2 Tage) ⚡ Quick Win
**Ziel:** Zutaten für Einkauf ohne Abtippen

**Features:**
- Button "📋 Einkaufsliste" im Recipe Header
- Modal mit allen Zutaten (gruppiert nach Abschnitten)
- **Clipboard API:** Kopiert als formatierten Text
- **Native Share API:** Teilen per iOS Notizen, WhatsApp, E-Mail
- Kein Abhaken (bewusst simpel)

**Betroffene Dateien:**
- `src/views/Recipe.vue`
- `src/components/ShoppingListModal.vue` (neu)
- `src/composables/useClipboard.ts` (neu)

---

#### Sprint 8: Koch-Notizen + Spracheingabe (4-5 Tage)
**Ziel:** Hands-free Notizen während des Kochens

**Features:**
- Einklappbares Notizen-Panel
- **Spracheingabe:** Web Speech API (Chrome, Safari, Edge)
- Text-Notizen als Fallback
- Notiz-Kategorien (💡 Idee, ⚠️ Warnung, ✅ Funktioniert)
- Timestamps
- "In Rezept übernehmen" Button
- LocalStorage (temporär, nicht im Rezept)

**Browser-Support:** Chrome ✅ | Safari ✅ | Firefox ❌

**Betroffene Dateien:**
- `src/views/Recipe.vue`
- `src/components/CookingNotes.vue` (neu)
- `src/components/VoiceInput.vue` (neu)
- `src/composables/useSpeechRecognition.ts` (neu)
- `src/store/modules/cookingNotes.ts` (neu)

---

#### Sprint 9: URL-Rezept-Sharing (1-2 Tage) ⚡ Quick Win
**Ziel:** Rezepte via Link teilen, ohne WebDAV-Zugriff

**Features:**
- Rezept komprimieren via `json-url` (lzma codec)
- URL-Parameter: `https://my-cookbook.app/?r=XQA...`
- Share-Button in Recipe.vue (Native Share API)
- Deep Link Handler: URL → Parse → LocalStorage → Anzeige
- Fallback: Clipboard Copy
- Bild-URL statt Base64 (Größenlimit)
- Toast: "Rezept aus Link importiert" ✓

**Technische Details:**
- Kompression: ~60-80% Reduktion (5KB → 1-2KB)
- Browser-Limit: ~2000 Zeichen (IE), 8000+ (modern)
- Keine Bilder inline (URL-Referenz oder weglassen)

**Flow:**
```
[Teilen] → Rezept → JSON → compress → URL
         → navigator.share() oder clipboard.writeText()

Empfänger: URL öffnen → Parse → "Rezept hinzufügen?" → LocalStorage
```

**Betroffene Dateien:**
- `src/views/Recipe.vue` (Share-Button)
- `src/composables/useRecipeShare.ts` (neu)
- `src/router/index.ts` (Deep Link Handler)
- `src/App.vue` (URL-Parameter beim Start prüfen)

---

### Phase D: Design-Modernisierung

#### Sprint 10: Design-System & Visual Polish
**Ziel:** Konsistentes, professionelles Erscheinungsbild

**Themen:**
- Farbschema (gedeckt, gute Kontraste)
- Typografie (gut lesbar in Küche, größere Schrift)
- Touch-Targets (min. 44x44px)
- Spacing-System
- Animationen & Transitions
- Optional: Dark Mode

---

## 📋 Sprint-Übersicht (Reihenfolge)

| Sprint | Phase | Thema | Aufwand | Priorität |
|--------|-------|-------|---------|-----------|
| 0 | Foundation | Navbar + Metadaten + Suche | 3-4 Tage | 🔴 Kritisch |
| 1 | Koch-Ansicht | Split-View + Portionen | 3-5 Tage | 🔴 Kritisch |
| 2 | Koch-Ansicht | Mobile FAB + Slide-In | 2-3 Tage | 🔴 Kritisch |
| 3 | Koch-Ansicht | Inline-Editing | 3-4 Tage | 🔴 Kritisch |
| 4 | Editor | Rezept-Wizard | 1 Woche | 🔴 Kritisch |
| 5 | Editor | Editor-Neugestaltung | 2-3 Wochen | 🔴 Kritisch |
| 6 | Workflow | Tabbed Interface | 3-4 Tage | 🟢 Optional |
| 7 | Workflow | Einkaufsliste-Export | 1-2 Tage | 🟢 Optional |
| 8 | Workflow | Koch-Notizen + Sprache | 4-5 Tage | 🟢 Optional |
| 9 | Workflow | URL-Rezept-Sharing | 1-2 Tage | 🟢 Optional |
| 10 | Design | Design-System | variabel | 🔵 Parallel |

**Geschätzte Gesamtdauer:**
- **Kritische Sprints (0-5):** 6-8 Wochen
- **Optionale Sprints (6-9):** +2-3 Wochen
- **Design-Polish (10):** Parallel zu Sprint 5

---

## ✅ Feature-Checkliste

### Muss erhalten bleiben:
- [x] Portionen skalieren/umrechnen → neu platzieren in Recipe Header

### Neue Features - Phase 0 (Foundation):
- [ ] Navbar-Neugestaltung (Koch-fokussiert)
- [ ] Galerie/Verwaltung-Fusion
- [ ] Metadaten vollständig (Autor, Quelle, Zeiten, Notizen)
- [ ] Experten-Modus (YAML versteckt)
- [ ] Suche & Filter (Titel + Tags)
- [ ] Edit-Button → FAB im Rezept
- [ ] Quick Actions auf Cards

### Neue Features - Phase A (Koch-Ansicht):
- [ ] Split-View (Desktop/Tablet, sticky Zutaten)
- [ ] Mobile Koch-Ansicht (FAB + Slide-In, orientierungsabhängig)
- [ ] Inline-Editing (Mengen, Text, Auto-Save)
- [ ] Portionen-Skalierung prominent

### Neue Features - Phase B (Editor):
- [ ] Rezept-Erstellungs-Wizard (4 Schritte, guided)
- [ ] Editor-Neugestaltung (Card-Layout, Touch, Drag & Drop)
- [ ] Metadaten-Editor (vollständig)

### Neue Features - Phase C (Workflow, Optional):
- [ ] Tabbed Interface (Multi-Rezept, Position merken)
- [ ] Einkaufsliste-Export (Clipboard + Native Share)
- [ ] Koch-Notizen (Text + Spracheingabe)
- [ ] URL-Rezept-Sharing (Link-basiert, ohne WebDAV)

### Neue Features - Phase D (Design):
- [ ] Design-System
- [ ] Visual Consistency
- [ ] Optional: Dark Mode

---

## 🚀 Start-Empfehlung

**Empfohlener Einstieg: Sprint 0 (Foundation first)**

**Warum?**
- Schafft solide Basis für alle weiteren Features
- Navbar-Probleme sind fundamental
- Galerie wird zum professionellen Herzstück
- Metadaten funktionieren → Wizard kann darauf aufbauen
- Suche/Filter = sofortiger Mehrwert
- Edit-Button-Konflikt mit FAB wird vermieden

**Nächster Schritt:** Sprint 0 implementieren

---

*Siehe `PLANNING-NOTES.md` für Hintergründe und verworfene Ideen.*
