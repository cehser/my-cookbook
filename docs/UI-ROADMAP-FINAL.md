# UI-Roadmap - my-cookbook

> **Planungsnotizen:** Siehe `PLANNING-NOTES.md` für den Entstehungsprozess  
> **Letzte Aktualisierung:** 28. Dezember 2025

---

## 📊 Übersicht

**Zielgruppe:** Familie · **Primäre Geräte:** Smartphone & Tablet (Küche), Desktop (Admin)  
**Haupt-Use-Case:** Rezept finden → beim Kochen nachschlagen  
**Design-Prinzip:** Funktional, professionell, klar, ansprechend

---

## 🐛 Known Issues

### Tag-Editor in Galerie (RecipeCard)
**Status:** 🔴 Bug | **Priorität:** Mittel

**Problem:**
- ESC-Taste und Toggle-Button zum Schließen des Tag-Editors funktionieren nicht zuverlässig
- Nur der X-Button schließt den Editor konsistent
- Vermutlich Focus-Management und Event-Propagation Issues

**Betroffene Datei:** `src/components/RecipeCard.vue`

**Technische Details:**
- Event-Listener auf window-Ebene für ESC
- Toggle-Button mit @click.prevent.stop
- Focus-Management nach Öffnen des Editors

### Metadaten-Anzeige UI-Qualität
**Status:** ✅ Behoben in Sprint 1 | **Priorität:** Hoch

**Ursprüngliche Probleme:**
- ~~Metadaten-Toggle-Button zu prominent~~ → Icon-only Button auf Rezeptbild
- ~~Metadaten-Overlay zusammenhanglos~~ → Desktop: Sidebar, Mobile: Bottom Sheet
- Keine Bearbeitungsmöglichkeit → wird in Sprint 5 (Editor-Überarbeitung) implementiert

**Betroffene Dateien:** `src/views/Recipe.vue` ✅, `src/views/Edit.vue` (Sprint 5)

---

## 🔧 Code Quality & Refactoring
**Status:** ✅ Abgeschlossen (27.-28.12.2025) | **Sprint:** Post-Sprint 1

**Durchgeführte Verbesserungen:**

### 1. Component Architecture & Refactoring
- ✅ **Recipe.vue Reduktion:** 1,863 → 921 Zeilen (51% Reduktion, -942 Zeilen)
- ✅ **9 Reusable Components erstellt:**
  - MetadataOverlay, PortionControl, IngredientsSection (Sprint 1)
  - MobileIngredientsBar, RecipeFabMenu, StepSection (Post-Sprint 1)
  - CloseButton (shared component)
  - Weitere: ArrayReorderBtnGroup, RecipeCard, AppNavbar
- ✅ **Component Organization:** 14 Komponenten in 6 logische Ordner strukturiert
  - `common/`, `recipe/display/`, `recipe/ui/`, `edit/`, `features/`, `layout/`

### 2. Design System
- ✅ **42 CSS Custom Properties** in App.vue etabliert
  - Radii: `--radius-circle`, `--radius-lg/md/sm`
  - Shadows: `--shadow-fab`, `--shadow-lg/md/sm/xs`
  - Transitions: `--transition-fast/normal`, `--transition-all-*`
  - Z-Index: `--z-fab`, `--z-overlay`, `--z-mobile-bar`, `--z-actions`
  - Dimensions: `--fab-size`, `--action-btn-size`
- ✅ **CSS Variables angewendet** in 6+ Komponenten
- ✅ **CSS Duplikate eliminiert:** CloseButton component erstellt

### 3. Type Safety
- ✅ **Generic Types:** ArrayReorderBtnGroup mit `<T>` statt `any[]`
- ✅ **Zentralisierte Interfaces:** Recipe type aus `@/types/recipe` in 3 Komponenten
- ✅ **Strict TypeScript:** Alle neuen Komponenten mit TypeScript strict mode

### 4. Error Handling & Robustness
- ✅ **Recipe.vue Error Handling:** Try-catch in 5 kritischen Methoden
  - `deleteRecipe()`, `copyRecipe()`, `saveRecipe()`, `toggleEditMode()`
- ✅ **Null-Checks:** current_recipe computed mit Validierung
- ✅ **User Feedback:** Toast-Notifications für Erfolg/Fehler

### 5. Security
- ✅ **XSS-Fix in RecipeCard:** v-html durch safe text-splitting ersetzt
  - Search highlighting jetzt XSS-sicher mit template loops

### 6. Code Quality & Standards
- ✅ **ESLint/Prettier Compliance:** Exit Code 0 (keine Errors, keine Warnings)
- ✅ **Component Naming:** Navbar → AppNavbar (multi-word requirement)
- ✅ **Import Standardization:** Alle `@/` path aliases

### 7. Betroffene Dateien (16+)
- App.vue, Recipe.vue, RecipeCard.vue, RecipeFabMenu.vue
- MobileIngredientsBar.vue, MetadataOverlay.vue, PortionControl.vue
- CloseButton.vue (NEU), StepSection.vue (NEU)
- ArrayReorderBtnGroup.vue, AppNavbar.vue (umbenannt)
- AIRecipeImport.vue, Gallery.vue, Edit.vue, Administration.vue, Settings.vue
- eslint.config.mjs

**Technische Highlights:**
- Recipe.vue Komplexität massiv reduziert (51% weniger Code)
- Design System für zukünftige Konsistenz etabliert
- Security-Schwachstelle geschlossen
- Production-ready: Full linter compliance

---

## 🎯 Implementierungsplan

### Phase 0: Navigation & Informationsarchitektur (Foundation)
**Sprint 0:** Navbar + Metadaten + Suche/Filter ✅ **Abgeschlossen (23.12.2025)**

**Implementierte Features:**
- ✅ Koch-fokussierte Navbar (Galerie, Favoriten, Suche prominent)
- ✅ Admin-Features im Dropdown (Einstellungen, Verwaltung, Cloud-Sync)
- ✅ Experten-Modus für YAML Import/Export (Toggle, Standard: AUS)
- ✅ Galerie & Verwaltung fusioniert (eine Ansicht)
- ✅ Suche & Filter (Suche, Autor, Schwierigkeit, Tags)
- ✅ Sortierung (5 Optionen: Name A-Z, Name Z-A, Neueste, Älteste, Favoriten)
- ✅ Edit-Button aus Navbar → FAB im Rezept-Kontext
- ✅ Quick Actions auf Recipe Cards (Tags, Edit, Delete)
- ✅ Favoriten mit IndexedDB Persistenz
- ✅ AI-Import als Modal
- ✅ Tag-Editor in RecipeCard (⚠️ mit Known Issue, siehe oben)
- 🟡 Metadaten-Anzeige implementiert, aber UI-Qualität unzureichend → Sprint 1

**Implementierte Navbar-Struktur:**
```
🍳 Kochbuch                     [⚙️▼]
[🏠 Galerie] [⭐ Favoriten] [🔍 Suche]
```

**Betroffene Dateien:**
- `src/components/Navbar.vue` (komplette Neugestaltung)
- `src/views/Gallery.vue` (Suche/Filter, Sorting, Quick Actions, AI-Import Modal)
- `src/views/Recipe.vue` (Metadaten-Anzeige mit Toggle, FAB)
- `src/components/RecipeCard.vue` (Quick Actions + Tag-Editor)
- `src/types/recipe.ts` (Interfaces erweitert)
- `src/store/modules/settings.ts` (expert_mode)
- `src/store/modules/uiState.ts` (Sortierung persistent)
- `src/store/actions.ts` (Favoriten-Persistenz)

---

### Phase A: Koch-Ansicht optimieren (Kritisch)

#### Sprint 1: Split-View Desktop/Tablet + Metadaten-Verbesserungen ✅ **Abgeschlossen (27.12.2025)**
**Ziel:** Parallele Ansicht Zutaten + Schritte + Metadaten-Feature finalisieren

**Teil 1: Split-View für Rezeptansicht**
**Priorität:** 🔴 Kritisch | **Aufwand:** M-L | **Status:** ✅ Fertig

**Implementierte Features:**
- ✅ Desktop: 35% Zutaten (sticky) | 65% Schritte
- ✅ Tablet: 40% Zutaten (sticky) | 60% Schritte  
- ✅ Mobile: Bottom Bar (collapsed/expanded) mit Backdrop
- ✅ Filter-Toggle: "Alle Zutaten" / "Nur aktueller Abschnitt" (Desktop + Mobile)
- ✅ Abschnitts-Synchronisation (Intersection Observer mit Debounce)
- ✅ **Portionen-Skalierung:** Prominent in Zutaten-Header (Desktop), Bottom Bar (Mobile)
- ✅ Manual Input + Button Controls auf allen Viewports

**Teil 2: Metadaten-UX Verbesserungen**
**Priorität:** 🔴 Hoch | **Aufwand:** M | **Status:** ✅ Fertig

**Implementierte Verbesserungen:**
- ✅ **Button-Redesign:** Icon-only (`bi-info-circle`), transparent weiß, dezent rechts oben auf Rezeptbild
- ✅ **Desktop-Overlay:** Sidebar rechts (350px/40% Breite), dark background, backdrop-filter, slide-in-right Animation
- ✅ **Mobile-Overlay:** Bottom Sheet (75vh), dark background, backdrop-filter, slide-up Animation, Drag Handle
- ✅ **Content:** Author, Source, Menge (Yields), Zeiten, Schwierigkeit (Badge), Notizen
- ✅ **Computed Properties:** hasTimeInfo, difficultyLabel, difficultyClass
- ✅ **Responsive Design:** 44px Touch-Targets auf Mobile, separate Layouts für Desktop/Mobile

**Editor-Integration verschoben:**
- Metadaten-Bearbeitung wird in **Sprint 5** (Editor-Überarbeitung) implementiert
- Grund: Passt besser zur kompletten Editor-Neugestaltung

**Betroffene Dateien:**
- `src/views/Recipe.vue` ✅ (Split-View + Metadaten-Anzeige komplett)
- `src/composables/useViewport.ts` ✅ (bereits vorhanden)
- `src/composables/useRecipeHelper.ts` ✅ (Yields-Logik)
- CSS: Split-View + Portionen + Metadaten-Overlay Styles ✅

---

#### Sprint 2: ~~Mobile FAB + Slide-In~~ ⏭️ **ÜBERSPRUNGEN**
**Original-Ziel:** Orientierungsabhängige Koch-Ansicht für Smartphones

**Begründung für Skip:**
- ✅ MobileIngredientsBar (Sprint 1) erfüllt bereits 80% der Anforderungen:
  - Bottom Bar mit Expand/Collapse ✓
  - 70vh Höhe beim Öffnen ✓
  - Backdrop ✓
  - Portionen-Skalierung ✓
  - Abschnitts-Synchronisation ✓
- 🟡 Landscape-Modus: Nice-to-have, kein Must-have (seltener Use Case)
- 🟡 FAB statt Bar-Click: Aktueller Click auf Bar funktioniert gut
- 🟡 Swipe-Down Geste: Close-Button reicht aus
- 🎯 **Höhere Priorität:** Inline-Editing hat größeren Business Value

**Status:** Feature-Set ausreichend, Fokus auf Editor-Verbesserungen

---

#### Sprint 2: Inline-Editing (3-4 Tage) - ✅ **Abgeschlossen (29.12.2025)**
**Ziel:** Kleine Anpassungen ohne Editor-Wechsel

**Implementierte Features:**
- ✅ Click auf Zutat → Alle Felder bearbeiten (Menge, Einheit, Name)
- ✅ Click auf Schritt → Text bearbeiten (kein double-click mehr)
- ✅ **Manual Save:** Sticky Action Bar mit [Speichern] [Abbrechen] Buttons
- ✅ **Dirty Tracking:** Gelber Border + 🟡 Badge für geänderte Items
- ✅ **Click-Outside:** Beendet Edit-Modus (wie ESC)
- ✅ **Nur eine Zeile gleichzeitig:** Parent-koordinierte Edit-Kontrolle
- ✅ **Keyboard Shortcuts:** ESC = Abbrechen, Enter = Fertig (Ingredients), Ctrl+Enter (Steps)
- ✅ **Änderungszähler:** Action Bar zeigt Anzahl geänderter Items
- ✅ **FAB Integration:** "Inline-Edit" Button aktiviert den Modus

**Betroffene Dateien:**
- `src/views/Recipe.vue` (inlineEditMode State, dirtyItems tracking)
- `src/components/recipe/ui/InlineEditActionBar.vue` (neu)
- `src/components/recipe/display/IngredientInlineEdit.vue` (refactored)
- `src/components/recipe/display/StepInlineEdit.vue` (refactored)
- `src/components/recipe/display/IngredientsSection.vue` (Koordination)
- `src/components/recipe/display/StepSection.vue` (Koordination)
- `src/components/recipe/display/MobileIngredientsBar.vue` (Event-Weiterleitung)

---

### Phase B: Editor-Neugestaltung (Kritisch)

#### Sprint 3: Rezept-Erstellungs-Wizard (1 Woche)
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

#### Sprint 4: Editor-Überarbeitung (2-3 Wochen)
**Ziel:** Intuitive Bearbeitung auf allen Geräten + Metadaten-Integration

**Lösungen:**
- **Card-Layout:** Ein Abschnitt = Karte (Zutaten + Schritte zusammen)
- **Responsive:** 1 Spalte (Mobile), 2 Spalten (Desktop)
- **Touch-optimiert:** Min. 44x44px Buttons, großzügige Abstände
- **Größere Input-Felder** (besonders Zutaten)
- **Keyboard-Shortcuts** (Enter, Tab, Shift+↑↓)
- **Drag & Drop reparieren** (Touch-Support, visuelles Feedback)
- **Inline-Buttons:** +/− direkt bei Zutat/Schritt
- **Metadaten-Section:** Einklappbare Card mit Autor, Quellen, Zeiten, Schwierigkeit, Notizen
  - Auto-Berechnung Gesamtzeit (prep + cook + bake)
  - URL-Validierung (Warnings, keine Blocker)
  - Touch-optimierte Formular-Felder
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

#### Sprint 5: Tabbed Recipe Interface + Session Restore (3-4 Tage)
**Ziel:** Multi-Rezept Navigation ohne Positionsverlust + PWA Session Restoration

**Teil 1: Tabbed Interface**

**Features:**
- Browser-Style Tabs für mehrere Rezepte
- Scroll-Position pro Tab gespeichert
- Galerie immer als erster Tab
- Max. 5 offene Rezepte
- Swipe-Gesten (Mobile)
- LocalStorage Persistence

**Teil 2: Session State Restoration (iOS PWA Fix)**

**Problem:**
- iOS beendet PWA bei Speicherdruck/Inaktivität komplett
- User landet wieder in Galerie statt im zuletzt geöffneten Rezept
- Besonders nervig beim Kochen (Wechsel zu Kamera/Einkaufsliste)

**Lösung:**
- Route + Scroll-Position automatisch speichern
- Bei App-Start: Letzte Route wiederherstellen (wenn < 30 Min alt)
- Integration in Tabbed Interface State
- Edge Cases abfangen:
  - Rezept wurde gelöscht → Fallback zur Galerie
  - Edit-Modus → nur Lesemodus wiederherstellen
  - Lange Inaktivität (> 30 Min) → normale Startseite

**Features:**
- [ ] Navigation State Persistence (Route, Scroll-Position, Timestamp)
- [ ] Auto-Restore beim App-Start (< 30 Min Expiration)
- [ ] Multiple Tabs mit jeweils eigenem State
- [ ] Aktiver Tab wird gespeichert
- [ ] Router Guards für automatisches Speichern
- [ ] Validation (Rezept existiert noch, kein Edit-Modus)

**Betroffene Dateien:**
- `src/App.vue` (Session Restore beim Mount)
- `src/components/RecipeTabBar.vue` (neu)
- `src/store/modules/navigation.ts` (neu - Tab + Session State)
- `src/router/index.ts` (Guards für Auto-Save, Validation)
- `src/types/navigation.ts` (neu - Interfaces)

---

#### Sprint 6: Einkaufsliste-Export (1-2 Tage) ⚡ Quick Win
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

#### Sprint 7: Koch-Notizen + Spracheingabe (4-5 Tage)
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

#### Sprint 8: URL-Rezept-Sharing (1-2 Tage) ⚡ Quick Win
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

#### Sprint 9: Design-System & Visual Polish
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

| Sprint | Phase | Thema | Aufwand | Priorität | Status |
|--------|-------|-------|---------|-----------|--------|
| 0 | Foundation | Navbar + Metadaten + Suche | 3-4 Tage | 🔴 Kritisch | ✅ Abgeschlossen (23.12.) |
| 1 | Koch-Ansicht | Split-View + Metadaten-UX | 4-6 Tage | 🔴 Kritisch | ✅ Abgeschlossen (27.12.) |
| ~~2~~ | ~~Koch-Ansicht~~ | ~~Mobile FAB + Slide-In~~ | ~~2-3 Tage~~ | ⏭️ Übersprungen | ✅ Feature-Set ausreichend |
| 2 | Koch-Ansicht | Inline-Editing | 3-4 Tage | 🔴 Kritisch | ✅ Abgeschlossen (29.12.) |
| 3 | Editor | Rezept-Wizard | 1 Woche | 🔴 Kritisch | 📋 Geplant |
| 4 | Editor | Editor-Neugestaltung | 2-3 Wochen | 🔴 Kritisch | 📋 Geplant |
| 5 | Workflow | Tabbed Interface + Session Restore | 3-4 Tage | 🟢 Optional | 📋 Geplant |
| 6 | Workflow | Einkaufsliste-Export | 1-2 Tage | 🟢 Optional | 📋 Geplant |
| 7 | Workflow | Koch-Notizen + Sprache | 4-5 Tage | 🟢 Optional | 📋 Geplant |
| 8 | Workflow | URL-Rezept-Sharing | 1-2 Tage | 🟢 Optional | 📋 Geplant |
| 9 | Design | Design-System | variabel | 🔵 Parallel | 📋 Geplant |

**Geschätzte Gesamtdauer:**
- **Sprint 0 (Abgeschlossen):** ✅ 4 Tage (19.-23.12.2025)
- **Sprint 1 (Abgeschlossen):** ✅ 4 Tage (24.-27.12.2025)
- **Sprint 2 (Abgeschlossen):** ✅ 2 Tage (28.-29.12.2025)
- **Kritische Sprints (3-4):** 3-4 Wochen (Rezept-Wizard + Editor-Neugestaltung)
- **Optionale Sprints (5-8):** +2-3 Wochen
- **Design-Polish (9):** Parallel zu Sprint 4

---

## ✅ Feature-Checkliste

### Muss erhalten bleiben:
- [x] Portionen skalieren/umrechnen → neu platzieren in Recipe Header

### Neue Features - Phase 0 (Foundation): ✅ Sprint 0 Abgeschlossen
- [x] Navbar-Neugestaltung (Koch-fokussiert)
- [x] Galerie/Verwaltung-Fusion
- [x] Suche & Filter (Suche, Autor, Schwierigkeit, Tags)
- [x] Sortierung (5 Optionen, persistent)
- [x] Experten-Modus (YAML versteckt)
- [x] Edit-Button → FAB im Rezept
- [x] Quick Actions auf Cards (Tags, Edit, Delete)
- [x] Favoriten mit Persistenz
- [x] AI-Import als Modal
- [x] Tag-Editor in RecipeCard
- [x] Metadaten-Typen definiert und Grundanzeige (⚠️ UI-Qualität → Sprint 1)

### Neue Features - Sprint 1 (Split-View + Metadaten): ✅ Abgeschlossen
- [x] Split-View (Desktop/Tablet, sticky Zutaten + Mobile Bottom Bar)
- [x] Portionen-Skalierung prominent (Zutaten-Header/Bottom Bar)
- [x] Metadaten-Button dezent (icon-only, auf Rezeptbild)
- [x] Metadaten-Overlay visuell integriert (Desktop Sidebar, Mobile Bottom Sheet)
- [ ] Metadaten-Editor → verschoben zu Sprint 5 (Editor-Überarbeitung)

### Neue Features - Phase A (Koch-Ansicht):
- [x] Split-View Desktop/Tablet (Sprint 1)
- [x] Mobile Bottom Bar (Sprint 1)
- [x] Portionen-Skalierung prominent (Sprint 1)
- [x] Abschnitts-Synchronisation (Sprint 1)
- [ ] ~~Mobile FAB + Landscape-Modus~~ (Sprint 2 übersprungen - Feature-Set ausreichend)
- [x] Inline-Editing (Manual Save, Dirty Tracking, Click-Outside) → Sprint 2

### Neue Features - Phase B (Editor):
- [ ] Rezept-Erstellungs-Wizard (4 Schritte, guided) → Sprint 3
- [ ] Editor-Neugestaltung (Card-Layout, Touch, Drag & Drop) → Sprint 4
- [ ] Metadaten-Editor (vollständig) → Sprint 4

### Neue Features - Phase C (Workflow, Optional):
- [ ] Tabbed Interface (Multi-Rezept, Position merken)
- [ ] Session State Restoration (iOS PWA Fix - letzte Route wiederherstellen)
- [ ] Einkaufsliste-Export (Clipboard + Native Share)
- [ ] Koch-Notizen (Text + Spracheingabe)
- [ ] URL-Rezept-Sharing (Link-basiert, ohne WebDAV)

### Neue Features - Phase D (Design):
- [ ] Design-System
- [ ] Visual Consistency
- [ ] Optional: Dark Mode

---

## 🚀 Aktueller Stand & Nächste Schritte

**Sprint 2 Status:** ✅ Abgeschlossen (29.12.2025)  
**Code Quality Session:** ✅ Abgeschlossen (27.-28.12.2025)

**Was funktioniert:**
- ✅ Koch-fokussierte Navbar mit Galerie/Favoriten/Suche (Sprint 0)
- ✅ Vollständige Filter- und Sortier-Funktionen (Sprint 0)
- ✅ Admin-Features im Dropdown (Sprint 0)
- ✅ Quick Actions in RecipeCards (Sprint 0)
- ✅ FAB in Rezeptansicht (Sprint 0)
- ✅ Favoriten mit IndexedDB-Persistenz (Sprint 0)
- ✅ AI-Import als Modal (Sprint 0)
- ✅ **Split-View Desktop/Tablet** (Sprint 1)
- ✅ **Mobile Bottom Bar** mit Zutaten (Sprint 1)
- ✅ **Intersection Observer** für Abschnitts-Synchronisation (Sprint 1)
- ✅ **Portionen-Skalierung** prominent mit Manual Input (Sprint 1)
- ✅ **Metadaten-Overlay** dezent und visuell integriert (Sprint 1)
- ✅ **Recipe.vue Refactoring** 51% Code-Reduktion (Post-Sprint 1)
- ✅ **Design System** mit 42 CSS Custom Properties (Post-Sprint 1)
- ✅ **Type Safety & Error Handling** verbessert (Post-Sprint 1)
- ✅ **Security** XSS-Schwachstelle behoben (Post-Sprint 1)
- ✅ **Code Quality** Full ESLint/Prettier Compliance (Post-Sprint 1)
- ✅ **Inline-Editing** mit Manual Save und Dirty Tracking (Sprint 2)

**Codebase Status:**
- 🟢 Production-ready: Keine ESLint-Fehler, keine Warnungen
- 🟢 Security: XSS-Schwachstelle in RecipeCard gefixt
- 🟢 Maintainability: 51% weniger Code in Recipe.vue, 9+ reusable components
- 🟢 Type Safety: Generic types, zentralisierte interfaces
- 🟢 Design System: 42 CSS Custom Properties für Konsistenz
- 🟢 UX: Inline-Editing mit präziser Kontrolle (Manual Save, nur eine Zeile gleichzeitig, Click-Outside)

**Was noch verbessert werden muss:**
- Tag-Editor Close-Funktionalität (ESC, Toggle) → siehe Known Issues
- Metadaten-Bearbeitung im Editor → Sprint 4 (Editor-Überarbeitung)
- Optional: [+ Zutat] / [+ Schritt] Buttons im Inline-Edit Modus

**Nächster Schritt:** Sprint 3 (Rezept-Wizard) - Geschätzt 1 Woche  
**Focus:** Guided Recipe Creation für bessere User Experience beim Rezept-Anlegen

---

*Siehe `PLANNING-NOTES.md` für Hintergründe und verworfene Ideen.*
