# UI-Roadmap - my-cookbook

> **Letzte Aktualisierung:** 6. April 2026

---

## 📊 Übersicht

**Zielgruppe:** Familie · **Primäre Geräte:** Smartphone & Tablet (Küche), Desktop (Admin)  
**Haupt-Use-Case:** Rezept finden → beim Kochen nachschlagen  
**Design-Prinzip:** Funktional, professionell, klar, ansprechend

---

## 🐛 Known Issues

Keine bekannten Bugs.

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
- ✅ Admin-Features im Dropdown (Einstellungen, Verwaltung)
- ✅ Experten-Modus für YAML Import/Export (Toggle, Standard: AUS)
- ✅ Galerie & Verwaltung fusioniert (eine Ansicht)
- ✅ Suche & Filter (Suche, Autor, Schwierigkeit, Tags)
- ✅ Sortierung (5 Optionen: Name A-Z, Name Z-A, Neueste, Älteste, Favoriten)
- ✅ Edit-Button aus Navbar → FAB im Rezept-Kontext
- ✅ Quick Actions auf Recipe Cards (Tags, Edit, Delete)
- ✅ Favoriten mit IndexedDB Persistenz
- ✅ AI-Import als Modal
- ✅ Tag-Editor in RecipeCard
- ✅ Metadaten-Anzeige (Sprint 1: Overlay, Sprint 4: Editor in Edit.vue)

**Implementierte Navbar-Struktur:**
```
🍳 Kochbuch                     [⚙️▼]
[🏠 Galerie] [⭐ Favoriten] [🔍 Suche]
```

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

**Metadaten-Editor:** ✅ Inzwischen in Edit.vue vollständig implementiert (Autor, Quellen, Zeiten, Schwierigkeit, Notizen).

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

---

### Phase B: Editor-Neugestaltung (Kritisch)

#### Sprint 3: Editor-Überarbeitung ✅ **Abgeschlossen (04/2026)**
**Ziel:** Intuitive Bearbeitung auf allen Geräten
**Priorität:** 🟡 Wichtig | **Status:** ✅ Abgeschlossen

**Implementierte Features:**
- ✅ **Card-Layout:** Ein Abschnitt = Karte (Zutaten + Schritte zusammen)
- ✅ **Responsive:** 1 Spalte (Mobile), 2 Spalten (Desktop)
- ✅ **Touch-optimiert:** Min. 44x44px Buttons, großzügige Abstände
- ✅ **Größere Input-Felder** (besonders Zutaten)
- ✅ **Keyboard-Shortcuts** (Ctrl+Z Undo, Ctrl+Y Redo, Ctrl+S Speichern)
- ✅ **Drag & Drop** (SortableJS, Touch-Support, visuelles Feedback)
- ✅ **Inline-Buttons:** +/− direkt bei Zutat/Schritt
- ✅ **Metadaten-Section** in Edit.vue
- ✅ **Live-Preview** (Vorschau-Button → RecipeDisplay Modal)
- ✅ **Draft Auto-Save** (localStorage, Debounced)
- ✅ **Undo/Redo** (useDebouncedRefHistory)
- ✅ **Composable-Extraktion:** useIngredientEditor, useStepEditor, useSectionEditor
- ✅ **Legacy-Editor entfernt** (EditV2 → Edit umbenannt)

---

### Phase C: Koch-Workflow-Features (Optional)

#### Sprint 4: Tabbed Recipe Interface + Session Restore (3-4 Tage)
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

---

#### Sprint 5: Einkaufsliste-Export (1-2 Tage) ⚡ Quick Win
**Ziel:** Zutaten für Einkauf ohne Abtippen

**Features:**
- Button "📋 Einkaufsliste" im Recipe Header
- Modal mit allen Zutaten (gruppiert nach Abschnitten)
- **Clipboard API:** Kopiert als formatierten Text
- **Native Share API:** Teilen per iOS Notizen, WhatsApp, E-Mail
- Kein Abhaken (bewusst simpel)

---

#### Sprint 6: Koch-Notizen + Spracheingabe (4-5 Tage)
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

---

#### Sprint 7: Rezept-Erstellungs-Wizard (1 Woche)
**Ziel:** Guided Recipe Creation statt leerer Editor
**Priorität:** 🟢 Optional

**4-Schritte-Assistent:**
1. Grunddaten (Titel, Bild, Beschreibung, Portionen, Zeiten)
2. Metadaten (Autor, Quelle, Tags) - überspringbar
3. Erster Abschnitt (Zutaten + Schritte)
4. Weitere Abschnitte oder Fertig → Vorschau → Speichern

---

#### ~~Sprint 8: URL-Rezept-Sharing~~ ✅ **Obsolet**

Ersetzt durch serverseitige Share-Links (Backend Sprint B5):
- `POST /v1/recipes/{id}/share` — zeitlich begrenzter Token-Link
- `GET /v1/shared/{token}` — öffentliche Rezeptansicht
- ShareManager-Komponente mit Erstellen/Widerrufen/Kopieren
- Admin-Übersicht aller Share-Links

---

### Phase X: UX-Gesamtkonzept (vor weiterer Umsetzung)

#### Sprint UX: UX-Konzept erarbeiten
**Ziel:** Stimmiges Gesamtkonzept für Navigation, Startseite und Informationsarchitektur — bevor einzelne Features isoliert umgesetzt werden.
**Priorität:** 🔴 Kritisch (Blocker für Sprint 4–7) | **Status:** 📋 Nächster Schritt

**Hintergrund:** Mehrere geplante Features greifen ineinander und beeinflussen dieselben UI-Bereiche (Navbar, Galerie, Router). Ohne ein abgestimmtes Konzept entstehen Inkonsistenzen.

**Usability-Ziele:**

1. **Schnell zum richtigen Rezept finden** — egal ob Favorit, kürzlich geöffnet oder neu
2. **Auf einen Blick sehen, wo ungespeicherte Änderungen liegen** (Draft-Indikator)
3. **Zwischen mehreren Rezepten wechseln, ohne den Kontext zu verlieren** (Position, Zustand)
4. **Nach einem App-Neustart dort weitermachen, wo man aufgehört hat** (besonders iOS PWA)
5. **Favoriten schnell und intuitiv erreichen** — ohne Umwege
6. **Klare, aufgeräumte Navigation** — nur das Nötigste sichtbar, kein Feature-Overload
7. **Auf dem Smartphone in der Küche gut bedienbar** — große Buttons, erreichbare Zonen

**Konzept: "Immersive + Bottom Nav"** ✅ Bestätigt (04/2026)

Drei klar getrennte Modi mit einer einzigen Bottom Nav. Kein Top-Navbar mehr.

**Drei Modi:**

| Modus | Bottom Nav | View-Header | Zweck |
|---|---|---|---|
| **Browsing** | ✅ sichtbar | View-spezifisch (Titel, Sort) | Rezepte finden, stöbern |
| **Koch-Modus** | ❌ versteckt | `← Rezeptname ⭐ ⋮` (minimal) | Kochen, max. Inhaltsfläche |
| **Edit-Modus** | ❌ versteckt | `✕ Bearbeiten 💾 [↩↪]` | Bearbeiten, eigene Toolbar |

**Bottom Nav — 4 Tabs:**

| Tab | Funktion | View |
|---|---|---|
| 🏠 Home | Card-Grid + Zuletzt + Drafts | HomeView (ehem. Gallery) |
| 🔍 Suche | Suchfeld + Filter (Tags, Autor, Schwierigkeit) | SearchView |
| ⭐ Favoriten | Nur favorisierte Rezepte | FavoritesView |
| 👤 Profil | Einstellungen, Admin, Experten, Logout | ProfileView |

**Wireframes:**

```
🏠 HOME                     🔍 SUCHE
┌──────────────────────┐    ┌──────────────────────┐
│ 🕐 Zuletzt geöffnet  │    │ 🔍 [Suche...      ✕] │
│ [Karte] [Karte]    → │    │ [Tag1] [Tag2] [Tag3] │
├──────────────────────┤    │ Autor: [Alle ▼]      │
│ ✏️ 2 Entwürfe anzeig.│    │ Schwierigk.: [Alle ▼]│
├──────────────────────┤    ├──────────────────────┤
│ Alle Rezepte (142)[↕]│    │ 3 Ergebnisse         │
│ ┌────┐ ┌────┐ ┌────┐│    │ ┌────┐ ┌────┐ ┌────┐│
│ │Bild│ │Bild│ │Bild││    │ │    │ │    │ │    ││
│ │Name│ │Name│ │Name││    │ └────┘ └────┘ └────┘│
│ │⭐⏱30│ │✏️⏱45│ │ ⏱20││    │                      │
│ └────┘ └────┘ └────┘│    │                      │
│            [+]       │    │                      │
├──────────────────────┤    ├──────────────────────┤
│ 🏠    🔍    ⭐    👤 │    │ 🏠    🔍    ⭐    👤 │
└──────────────────────┘    └──────────────────────┘

KOCH-MODUS                   EDIT-MODUS
┌──────────────────────┐    ┌──────────────────────┐
│ ← Apfelkuchen  ⭐  ⋮│    │ ✕ Bearbeiten  💾 ↩ ↪ │
│                      │    │                      │
│ [Rezeptbild]         │    │ [Bild ändern]        │
│                      │    │ Titel: [Apfelkuchen] │
│ Schritt 1...         │    │ ┌─ TEIG ── [▲][▼][✕]│
│ Schritt 2...         │    │ │ Zutaten │ Schritte │
│ ...                  │    │ │ [200g]  │ [Mehl..]│
│                      │    │ │ [Mehl_] │ [+Schri]│
│ [🥕 Zutaten ▲]      │    │ │ [+Zutat]│         │
└──────────────────────┘    │ └────────────────────┤
 Kein Bottom Nav!            │ [+ Abschnitt]        │
                             └──────────────────────┘
                              Kein Bottom Nav!
```

**Design-Entscheidungen (bestätigt):**
- **Home-Tab:** "Zuletzt geöffnet" + "Entwürfe" Sektionen adaptiv (nur wenn Daten vorhanden)
- **Neues Rezept:** FAB (+) im Home-Tab (Long-Press: AI-Import, YAML-Import)
- **Edit-Modi vereinheitlicht:** Kein separates Inline-Edit. Nur Full-Editor.
- **Rezept-Wechsel:** ← Zurück zum letzten Tab → neues Rezept wählen
- **RecipeCards angereichert:** + ⏱ Gesamtzeit, + ✏️ Draft-Badge
- **Suche:** Volltextsuche (auch Zutaten/Schritte), nicht nur Titel
- **PWA-Update:** Automatisch beim nächsten Seitenwechsel, kein User-Prompt
- **Session Restore:** Route + Timestamp in localStorage, < 30 Min → Koch-Modus wiederherstellen
- **Tablet:** Gleiches Interaktionsmodell, mehr Spalten + Split-View
- **Desktop:** Bottom Nav bleibt unten (konsistentes Layout)
- **Infinite Scroll:** Card-Grid als Komponente kapseln (Vorbereitung), nicht sofort implementieren

**Umsetzungsphasen:**

| Phase | Thema | Abhängigkeiten | Status |
|---|---|---|---|
| UX-1 | Bottom Nav + Modi-System (Foundation) | — | ✅ Abgeschlossen (04/2026) |
| UX-2 | Gallery → HomeView, SearchView, FavoritesView | UX-1 | ✅ Abgeschlossen (04/2026) |
| UX-3 | Koch-Modus Header (⭐ Favorit + ⋮ Menü) | UX-1 | ✅ Abgeschlossen (04/2026) |
| UX-4 | Inline-Edit entfernt (−1233 Zeilen, −18 KiB) | UX-1 | ✅ Abgeschlossen (04/2026) |
| UX-5 | ProfileView (Settings/Admin/Logout) | UX-1 | ✅ Abgeschlossen (04/2026) |
| UX-6 | PWA Auto-Update + Session Restore + Sort-Persist | UX-1 | 📋 Geplant |
| UX-7 | RecipeGrid-Komponente kapseln (Infinite Scroll Vorb.) | UX-2 | ✅ Abgeschlossen (04/2026) |

UX-1 ist Blocker. UX-2 bis UX-6 können teilweise parallel laufen (UX-3/4/5 sind unabhängig voneinander).

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
| 3 | Editor | Editor-Neugestaltung | 2-3 Wochen | 🟡 Wichtig | ✅ Abgeschlossen (04/2026) |
| **UX** | **Konzept** | **UX-Gesamtkonzept** | **2-3 Tage** | **🔴 Kritisch** | **✅ Bestätigt (04/2026)** |
| **UX-1** | **UX-Umbau** | **Bottom Nav + Modi-System** | **2-3 Tage** | **🔴 Kritisch** | **✅ Abgeschlossen (04/2026)** |
| **UX-2** | **UX-Umbau** | **Gallery → Home/Suche/Favoriten** | **3-4 Tage** | **🔴 Kritisch** | **✅ Abgeschlossen (04/2026)** |
| **UX-3** | **UX-Umbau** | **Koch-Modus Header (⭐ + ⋮)** | **1 Tag** | **🟡 Wichtig** | **✅ Abgeschlossen (04/2026)** |
| **UX-4** | **UX-Umbau** | **Inline-Edit entfernt** | **1 Tag** | **🟡 Wichtig** | **✅ Abgeschlossen (04/2026)** |
| **UX-5** | **UX-Umbau** | **ProfileView** | **1 Tag** | **🟡 Wichtig** | **✅ Abgeschlossen (04/2026)** |
| **UX-6** | **UX-Umbau** | **PWA Auto-Update + Session Restore** | **1-2 Tage** | **🟢 Optional** | **📋 Nächster Schritt** |
| UX-7 | UX-Umbau | RecipeGrid kapseln (Infinite Scroll Vorb.) | 0.5 Tage | 🟢 Optional | ✅ Abgeschlossen (04/2026) |
| ~~4~~ | ~~Workflow~~ | ~~Tabbed Interface + Session Restore~~ | — | — | ✅ Ersetzt durch UX-Konzept |
| 5 | Workflow | Einkaufsliste-Export | 1-2 Tage | 🟢 Optional | 📋 Geplant |
| 6 | Workflow | Koch-Notizen + Sprache | 4-5 Tage | 🟢 Optional | 📋 Geplant |
| 7 | Editor | Rezept-Wizard | 1 Woche | 🟢 Optional | 📋 Geplant |
| ~~8~~ | ~~Workflow~~ | ~~URL-Rezept-Sharing~~ | — | — | ✅ Obsolet (Share-Links via Backend) |
| 9 | Design | Design-System | variabel | 🔵 Parallel | 📋 Geplant |

**Geschätzte Gesamtdauer:**
- **Sprint 0 (Abgeschlossen):** ✅ 4 Tage (19.-23.12.2025)
- **Sprint 1 (Abgeschlossen):** ✅ 4 Tage (24.-27.12.2025)
- **Sprint 2 (Abgeschlossen):** ✅ 2 Tage (28.-29.12.2025)
- **Sprint 3 (Abgeschlossen):** ✅ Editor-Neugestaltung (04/2026)
- **UX-Konzept (Abgeschlossen):** ✅ Bestätigt (04/2026)
- **UX-Umbau (UX-1 bis UX-7):** ~10-12 Tage (UX-1 Blocker, Rest teilweise parallel)
- **Optionale Sprints (5-7):** +2-3 Wochen
- **Design-Polish (9):** Parallel möglich

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
- [x] Metadaten-Typen definiert und Anzeige (Overlay + Editor)

### Neue Features - Sprint 1 (Split-View + Metadaten): ✅ Abgeschlossen
- [x] Split-View (Desktop/Tablet, sticky Zutaten + Mobile Bottom Bar)
- [x] Portionen-Skalierung prominent (Zutaten-Header/Bottom Bar)
- [x] Metadaten-Button dezent (icon-only, auf Rezeptbild)
- [x] Metadaten-Overlay visuell integriert (Desktop Sidebar, Mobile Bottom Sheet)
- [x] Metadaten-Editor ✅ (in Edit.vue implementiert)

### Neue Features - Phase A (Koch-Ansicht):
- [x] Split-View Desktop/Tablet (Sprint 1)
- [x] Mobile Bottom Bar (Sprint 1)
- [x] Portionen-Skalierung prominent (Sprint 1)
- [x] Abschnitts-Synchronisation (Sprint 1)
- [ ] ~~Mobile FAB + Landscape-Modus~~ (Sprint 2 übersprungen - Feature-Set ausreichend)
- [x] Inline-Editing (Manual Save, Dirty Tracking, Click-Outside) → Sprint 2

### Neue Features - Phase B (Editor):
- [x] Editor-Neugestaltung (Card-Layout, Touch, Drag & Drop) → Sprint 3 ✅
- [ ] Rezept-Erstellungs-Wizard (4 Schritte, guided) → Sprint 7 (Optional)
- [x] Metadaten-Editor ✅ (bereits in Edit.vue implementiert)

### Neue Features - Phase C (Workflow, Optional):
- [x] ~~Tabbed Interface~~ → Ersetzt durch UX-Konzept "Immersive + Bottom Nav" (Modi-System)
- [ ] Session State Restoration (iOS PWA Fix) → UX-6
- [ ] Einkaufsliste-Export (Clipboard + Native Share) → Sprint 5
- [ ] Koch-Notizen (Text + Spracheingabe) → Sprint 6
- [x] ~~URL-Rezept-Sharing~~ → Ersetzt durch serverseitige Share-Links (Backend B5)
- [x] Error-Handler (globaler `app.config.errorHandler` + `unhandledrejection`) — keine User-sichtbare Recovery-UI

### Neue Features - UX-Umbau "Immersive + Bottom Nav":
- [x] Bottom Nav (4 Tabs: Home, Suche, Favoriten, Profil) → UX-1 ✅
- [x] Top-Navbar entfernen → UX-1 ✅
- [x] HomeView mit "Zuletzt geöffnet" + "Entwürfe" Sektionen → UX-2 ✅
- [x] SearchView mit Volltextsuche + Filter → UX-2 ✅
- [x] FavoritesView → UX-2 ✅
- [x] RecipeCards anreichern (⏱ Zeit, ✏️ Draft-Badge) → UX-2 ✅
- [x] FAB (+) für Neues Rezept / AI-Import → UX-2 ✅
- [x] useDraftIndex Composable → UX-2 ✅
- [x] useRecentRecipes Composable → UX-2 ✅
- [x] Koch-Modus View-Header (← Rezeptname) → UX-1 ✅ (⭐ ⋮ → UX-3)
- [x] Edit-Modus View-Header (✕ Bearbeiten 💾 ↩↪) → UX-1 ✅ (Inline-Edit entfernen → UX-4)
- [x] Inline-Edit entfernt (−1233 Zeilen, 4 Komponenten gelöscht) → UX-4 ✅
- [x] ProfileView (Settings/Admin/Logout) → UX-5 ✅
- [ ] PWA Auto-Update beim Seitenwechsel → UX-6
- [ ] Session Restore (Route + Timestamp) → UX-6
- [x] RecipeGrid-Komponente kapseln → UX-7 ✅

### Neue Features - Phase D (Design):
- [ ] Design-System
- [ ] Visual Consistency
- [ ] Optional: Dark Mode

### Code Cleanup (Backlog) — VueUse Migration:

**Hoher Impact (viel Boilerplate eliminierbar):**
- [ ] `useViewport.ts` — gesamte Datei ersetzbar durch `useWindowSize()` (~25 → ~5 Zeilen)
- [ ] `RecipeDisplay.vue` — manueller `IntersectionObserver` + setTimeout-Debounce → `useIntersectionObserver` + `useDebounceFn` (~30 Zeilen)

**Mittlerer Impact:**
- [ ] `RecipeCard.vue` — manueller keydown-Listener in watch → `onKeyStroke("Escape", ...)`
- [ ] `Administration.vue` — manueller keydown + `navigator.clipboard` → `useEventListener` + `useClipboard`
- [ ] `ShareManager.vue` — `navigator.clipboard.writeText` → `useClipboard` (+ `copied` State für UI-Feedback)

**Entfällt durch UX-Umbau:**
- ~~`AppNavbar.vue`~~ → wird komplett entfernt (UX-1)
- ~~`IngredientInlineEdit.vue`~~ → wird komplett entfernt (UX-4)
- ~~`StepInlineEdit.vue`~~ → wird komplett entfernt (UX-4)
- ~~`Gallery.vue` swUpdated~~ → toter Code, wird entfernt (UX-2)

### ~~UX-Prüfung: Navbar-Überarbeitung~~ ✅ Geklärt durch UX-Konzept

Alle Fragen sind durch das "Immersive + Bottom Nav"-Konzept beantwortet:
- Navbar wird komplett durch Bottom Nav ersetzt (UX-1)
- Undo/Redo/Speichern → eigener Edit-Header (UX-4)
- Experten-Modus → Profil-Tab (UX-5)
- Favoriten → eigener Tab (UX-2)
- Suche → eigener Tab (UX-2)
- Dead Code (Props, Loading-Spinner) → entfällt mit Navbar-Entfernung (UX-1)

---

## 🚀 Aktueller Stand & Nächste Schritte

**Sprint 3 Status:** ✅ Abgeschlossen (04/2026)
**UX-Konzept:** ✅ Bestätigt — "Immersive + Bottom Nav" (04/2026)
**Code Quality Session:** ✅ Abgeschlossen (27.-28.12.2025)

**Was funktioniert:**
- ✅ Split-View Desktop/Tablet + Mobile Bottom Bar (Sprint 1)
- ✅ Intersection Observer Abschnitts-Synchronisation (Sprint 1)
- ✅ Portionen-Skalierung + Metadaten-Overlay (Sprint 1)
- ✅ Inline-Editing mit Manual Save und Dirty Tracking (Sprint 2)
- ✅ Card-Layout Editor mit SortableJS Drag & Drop (Sprint 3)
- ✅ Draft Auto-Save + Undo/Redo (Sprint 3)
- ✅ Keyboard Shortcuts Ctrl+Z/Y/S (Sprint 3)
- ✅ Composable-Architektur (useIngredientEditor, useStepEditor, useSectionEditor)
- ✅ Globales Error-Handling
- ✅ Bottom Nav + Modi-System (UX-1)
- ✅ View-Header für Koch- und Edit-Modus (UX-1)
- ✅ HomeView mit Zuletzt-geöffnet, Entwürfe, Alle Rezepte + FAB (UX-2)
- ✅ SearchView mit Volltextsuche + Tag/Autor/Schwierigkeit-Filter (UX-2)
- ✅ FavoritesView mit Empty-State (UX-2)
- ✅ RecipeCard Badges: Zeitanzeige + Draft-Indikator (UX-2)
- ✅ Koch-Modus Header: ⭐ Favorit-Toggle + ⋮ Dropdown (UX-3)
- ✅ Inline-Edit entfernt, −1233 Zeilen, −18 KiB Bundle (UX-4)
- ✅ ProfileView: Settings, Admin-Link, Logout (UX-5)

**Bekannte Probleme (werden durch UX-Umbau gelöst):**
- ✅ ~~/favorites und /search Routen nicht funktional~~ → UX-2 gelöst (eigene Views)
- ✅ ~~Kein Zurück-Button in Recipe/Edit~~ → UX-1 gelöst
- ✅ ~~Doppelter Edit-Modus (Inline vs. Full) verwirrend~~ → UX-4 gelöst (Inline-Edit entfernt)
- ✅ ~~RecipeCards zeigen keine Zeit/Schwierigkeit~~ → UX-2 gelöst (Badges)
- ✅ ~~Suche nur nach Titel, nicht nach Zutaten~~ → UX-2 gelöst (Volltextsuche)
- ✅ ~~Drafts unsichtbar in der Gallery~~ → UX-2 gelöst (Entwürfe-Sektion + Badge)
- ✅ ~~PWA-Update-Code ist toter Code~~ → UX-1 gelöst (Gallery.vue bereinigt)

**Nächster Schritt:** Phase UX-6 — PWA Auto-Update + Session Restore + Sortierung persistieren

**Hinweis:** Frontend-Code liegt seit B6 unter `frontend/` (nicht mehr im Root). Alle `src/`-Pfade in dieser Roadmap beziehen sich auf `frontend/src/`.

---

*Siehe `PLANNING-NOTES.md` für Hintergründe und verworfene Ideen.*
