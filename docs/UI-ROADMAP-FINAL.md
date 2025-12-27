# UI-Roadmap - my-cookbook

> **Planungsnotizen:** Siehe `PLANNING-NOTES.md` für den Entstehungsprozess  
> **Letzte Aktualisierung:** 23. Dezember 2025

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

#### Sprint 6: Tabbed Recipe Interface + Session Restore (3-4 Tage)
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

| Sprint | Phase | Thema | Aufwand | Priorität | Status |
|--------|-------|-------|---------|-----------|--------|
| 0 | Foundation | Navbar + Metadaten + Suche | 3-4 Tage | 🔴 Kritisch | ✅ Abgeschlossen (23.12.) |
| 1 | Koch-Ansicht | Split-View + Metadaten-UX | 4-6 Tage | 🔴 Kritisch | ✅ Abgeschlossen (27.12.) |
| 2 | Koch-Ansicht | Mobile FAB + Slide-In | 2-3 Tage | 🔴 Kritisch | 📋 Geplant |
| 3 | Koch-Ansicht | Inline-Editing | 3-4 Tage | 🔴 Kritisch | 📋 Geplant |
| 4 | Editor | Rezept-Wizard | 1 Woche | 🔴 Kritisch | 📋 Geplant |
| 5 | Editor | Editor-Neugestaltung | 2-3 Wochen | 🔴 Kritisch | 📋 Geplant |
| 6 | Workflow | Tabbed Interface + Session Restore | 3-4 Tage | 🟢 Optional | 📋 Geplant |
| 7 | Workflow | Einkaufsliste-Export | 1-2 Tage | 🟢 Optional | 📋 Geplant |
| 8 | Workflow | Koch-Notizen + Sprache | 4-5 Tage | 🟢 Optional | 📋 Geplant |
| 9 | Workflow | URL-Rezept-Sharing | 1-2 Tage | 🟢 Optional | 📋 Geplant |
| 10 | Design | Design-System | variabel | 🔵 Parallel | 📋 Geplant |

**Geschätzte Gesamtdauer:**
- **Sprint 0 (Abgeschlossen):** ✅ 4 Tage (19.-23.12.2025)
- **Sprint 1 (Abgeschlossen):** ✅ 4 Tage (24.-27.12.2025)
- **Kritische Sprints (2-5):** 6-8 Wochen
- **Optionale Sprints (6-9):** +2-3 Wochen
- **Design-Polish (10):** Parallel zu Sprint 5

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
- [ ] Mobile Koch-Ansicht (FAB + Slide-In, orientierungsabhängig)
- [ ] Inline-Editing (Mengen, Text, Auto-Save)
- [ ] Portionen-Skalierung prominent

### Neue Features - Phase B (Editor):
- [ ] Rezept-Erstellungs-Wizard (4 Schritte, guided)
- [ ] Editor-Neugestaltung (Card-Layout, Touch, Drag & Drop)
- [ ] Metadaten-Editor (vollständig)

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

**Sprint 1 Status:** ✅ Abgeschlossen (27.12.2025)

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

**Was noch verbessert werden muss:**
- Tag-Editor Close-Funktionalität (ESC, Toggle) → siehe Known Issues
- Metadaten-Bearbeitung im Editor → Sprint 5 (Editor-Überarbeitung)

**Nächster Schritt:** Sprint 2 (Mobile FAB + Slide-In) - Geschätzt 2-3 Tage

---

*Siehe `PLANNING-NOTES.md` für Hintergründe und verworfene Ideen.*
