# UI-Roadmap für my-cookbook

## Aktueller Stand (Dezember 2025)

### Technische Basis
- Vue 3.4.15 mit Composition API (`<script setup>`)
- Bootstrap 5.3.2 + Bootstrap-Vue-Next 0.40.9
- TypeScript 5.3.3
- Vite 7.2.6
- PWA-fähig mit Workbox

### Bestehende Features
- Rezept-Galerie mit Karten-Ansicht
- Rezept-Editor mit Zutaten und Schritten
- Favoriten-System
- QR-Code Import/Export
- WebDAV Cloud-Synchronisation
- Offline-fähig (PWA)
- AI-Rezept-Import

---

## 👥 Nutzungskontext

**Zielgruppe:** Familie (mehrere Nutzer)
**Primäre Geräte:** Smartphone & Tablet in der Küche, Desktop für Administration
**Haupt-Use-Case:** Rezept finden → beim Kochen nachschlagen
**Design-Präferenz:** Funktional, professionell, klar - aber ansprechend

### 🔥 Top Pain Points (nach Priorität)
1. **🔴 KRITISCH:** Rezeptbearbeitung ist umständlich (auch auf Desktop)
2. **🔴 KRITISCH:** Ständiges Hin- und Herwechseln zwischen Zutaten & Schritten beim Kochen
3. **🔴 KRITISCH:** Navbar fokussiert sich zu sehr auf Admin/Technik statt Koch-Workflow
4. **🟡 WICHTIG:** Viele YAML-Felder (Autor, Quelle, Zeit, Notizen) werden nicht angezeigt/bearbeitet
5. **🟡 WICHTIG:** Kleine Anpassungen (Text, Mengen) beim Kochen nicht möglich ohne Editor
6. **🟡 WICHTIG:** Während des Kochens in anderem Rezept nachsehen → Navigation verliert Position
7. **🟡 WICHTIG:** Neues Rezept anlegen ist nicht intuitiv (kein Wizard/Assistent)
8. **🟢 NICE-TO-HAVE:** Notizen beim Kochen für spätere Bearbeitung (z.B. "mehr Salz", "20 Min statt 15")
9. **🟢 NICE-TO-HAVE:** YAML Import/Export zu technisch für normale Nutzer

---

## 🎯 UI-Verbesserungsziele

### Phase 0: Navigation & Informationsarchitektur
> **Status:** 🔵 In Planung
> **Ziel:** Koch-fokussierte Navigation, Admin-Features im Hintergrund

#### 0.1 Navbar-Neugestaltung
**Priorität:** 🔴 Kritisch | **Aufwand:** M
**Problem:** Navbar zu technisch/administrativ, Koch-Features nicht prominent genug

**Aktuell (vermutlich):**
```
[🏠 Home] [🍽️ Galerie] [✏️ Bearbeiten] [⚙️ Einstellungen] [🔧 Verwaltung]
```

**Neue Struktur:**
```
┌────────────────────────────────────────────────────┐
│ 🍳 Kochbuch                                 [⚙️ ▼] │ ← Dropdown rechts
├────────────────────────────────────────────────────┤
│ [🏠 Galerie] [⭐ Favoriten] [🔍 Suche]             │ ← Hauptnavigation
└────────────────────────────────────────────────────┘

Dropdown-Menü (⚙️):
├─ ⚙️ Einstellungen
├─ 📂 Rezeptverwaltung (Kopieren, Löschen, etc.)
├─ ☁️ Cloud-Sync
└─ 🔬 Experten-Modus
    ├─ 📄 YAML Import
    ├─ 📤 YAML Export
    └─ 🧪 Debug-Info
```

**Features:**
- [ ] **Edit-Button entfernt** aus Navbar → nur noch im Rezept-Kontext (Floating Action Button)
- [ ] **Galerie zentral** als Haupt-Tab (nicht "Home")
- [ ] **Favoriten** als eigener Tab (Schnellzugriff zu häufig genutzten Rezepten)
- [ ] **Suche** prominent in Navbar (statt versteckt)
- [ ] **Admin-Dropdown** rechts: Einstellungen, Verwaltung, Experten-Modus
- [ ] **Experten-Modus Toggle:** Blendet YAML Import/Export ein (Standard: aus)

**Betroffene Dateien:**
- `src/components/Navbar.vue` (komplette Neugestaltung)
- `src/views/Gallery.vue` (als Default-Route)
- Settings Store: `expertMode` boolean

---

#### 0.2 Rezept-Kontext-Aktionen
**Priorität:** 🔴 Kritisch | **Aufwand:** S
**Problem:** Edit-Button in Navbar, nicht rezeptbezogen

**Lösung:**
- [ ] **Floating Action Button (FAB)** in `Recipe.vue`: ✏️ (Bearbeiten)
- [ ] **Kontext-Menü** im Rezept-Header: ⋮ (Teilen, Kopieren, Löschen, Export)
- [ ] **Quick Actions** in RecipeCard: ✏️ ⭐ 🗑️ (Bearbeiten, Favorit, Löschen)

**Betroffene Dateien:**
- `src/views/Recipe.vue` (FAB + Kontext-Menü)
- `src/components/RecipeCard.vue` (Quick Actions)

---

#### 0.3 Galerie & Rezeptverwaltung fusionieren
**Priorität:** 🟡 Wichtig | **Aufwand:** M
**Problem:** Verwaltung und Galerie sind getrennt, sollten eins sein

**Konzept:**
```
┌─────────────────────────────────────────────────────┐
│ 🍳 Galerie                            [+ Neu] [⋮]   │ ← Actions rechts
├─────────────────────────────────────────────────────┤
│ [🔍 Suchen...] [📁 Alle ▼] [⬆️ A-Z ▼]              │ ← Filter/Sort
├─────────────────────────────────────────────────────┤
│ ┌──────┐  ┌──────┐  ┌──────┐                       │
│ │ Bild │  │ Bild │  │ Bild │  Rezept-Karten        │
│ │ ⋮✏️⭐│  │ ⋮✏️⭐│  │ ⋮✏️⭐│  mit Quick Actions     │
│ └──────┘  └──────┘  └──────┘                       │
└─────────────────────────────────────────────────────┘

[+ Neu] Button → Dropdown:
├─ ✏️ Leeres Rezept (mit Assistent)
├─ 📋 Aus Vorlage
├─ 🤖 AI-Import
├─ 📷 Aus Foto (OCR - zukünftig)
└─ 📁 Rezept kopieren

[⋮] Menü → Bulk-Aktionen:
├─ ☁️ Cloud-Sync
├─ 📤 Alle exportieren (ZIP)
├─ 🗑️ Mehrfachauswahl löschen
└─ 📊 Statistiken
```

**Features:**
- [ ] **Galerie = Verwaltung:** Alle Aktionen in einer Ansicht
- [ ] **+ Neu Button prominent:** Dropdown mit allen Erstellungsoptionen
- [ ] **Quick Actions** auf jeder Karte: Bearbeiten, Favorit, Löschen, Teilen
- [ ] **Bulk-Aktionen:** Mehrfachauswahl zum Löschen/Exportieren
- [ ] **Administration View entfernen:** Funktionen in Galerie integrieren

**Betroffene Dateien:**
- `src/views/Gallery.vue` (erweitert)
- `src/views/Administration.vue` (deprecated, Funktionen migrieren)
- `src/components/RecipeCard.vue` (Quick Actions)
- `src/components/RecipeActionMenu.vue` (neu)

---

#### 0.4 Vollständige Rezept-Metadaten anzeigen & bearbeiten
**Priorität:** 🟡 Wichtig | **Aufwand:** M
**Problem:** YAML-Felder wie Autor, Quelle, Zeit, Notizen werden nicht angezeigt

**Nicht genutzte YAML-Felder (aktuell):**
- `author` ✗ (Autor des Rezepts)
- `source_url` ✗ (Quelle: Webseite)
- `source_book` ✗ (Quelle: Kochbuch)
- `bake_time` / `prep_time` / `cook_time` ✗ (Zeiten)
- `subtitle` ✗ (teilweise genutzt)
- `haccp.control_point` ✗ (Hygiene-Kontrollpunkte)
- `haccp.critical_control_point` ✗
- `notes` in steps ✗ (Schritt-Notizen)
- `tags` / `categories` ✗ (falls vorhanden)

**Lösung - Rezeptansicht erweitern:**
```
┌─────────────────────────────────────────────────┐
│ 📷 [Rezeptbild]                                 │
│                                                 │
│ # Apfelkuchen                                   │
│ Von: Oma Hildegard | ⏱️ 60 Min (15+45)         │ ← Autor + Zeiten
│ 📖 Quelle: mein-kochbuch.de                    │ ← Quelle
│                                                 │
│ "Ein klassischer Apfelkuchen..."               │ ← Subtitle
│                                                 │
│ [🍽️ 8 Portionen]  [⭐ Favorit]  [✏️ Bearbeiten]│
└─────────────────────────────────────────────────┘
```

**Lösung - Editor erweitern:**
- [ ] **Metadaten-Section** im Editor (einklappbar)
  - Autor (Textfeld)
  - Quelle (URL oder Buchname)
  - Zeiten (Vorbereitung, Backen/Kochen, Gesamt)
  - Subtitle/Beschreibung (Textarea)
  - Tags/Kategorien
- [ ] **Schritt-Notizen** im Step-Editor
  - "Notiz hinzufügen" Button pro Schritt
  - Notizen werden in `step.notes[]` gespeichert
  - Anzeige in Rezeptansicht (ausgegraut/kleiner)
- [ ] **HACCP optional** (für Profis im Experten-Modus)

**Betroffene Dateien:**
- `src/views/Recipe.vue` (Metadaten-Anzeige)
- `src/views/Edit.vue` (Metadaten-Felder hinzufügen)
- `src/components/RecipeMetadata.vue` (neu)
- `src/components/StepEdit.vue` (Notizen-Support)
- `src/types/recipe.ts` (TypeScript-Interfaces erweitern)

---

### Phase 1: Koch-Ansicht optimieren (Höchste Priorität)
> **Status:** 🔵 In Planung
> **Ziel:** Kochen ohne ständiges Scrollen/Wechseln

#### 1.1 Split-View für Rezeptansicht
**Priorität:** 🔴 Kritisch | **Aufwand:** L
- [ ] Desktop: Zutaten links, Schritte rechts (2-Spalten-Layout)
- [ ] Tablet: Umschaltbar zwischen Split-View & Tabs
- [ ] Mobile: Sticky Zutaten-Header oder Slide-In-Panel
- [ ] Abschnitts-Navigation: Springe zu Abschnitt → zeige nur relevante Zutaten

**Betroffene Dateien:**
- `src/views/Recipe.vue` (Hauptansicht)
- Neue Komponente: `RecipeViewerSplit.vue`?

#### 1.2 Inline-Editing im Koch-Modus
**Priorität:** 🔴 Kritisch | **Aufwand:** M
- [ ] Quick-Edit für Mengen: Klick auf Zutat → Inline-Input
- [ ] Quick-Edit für Text: Doppelklick auf Schritt → Bearbeiten
- [ ] "Notiz hinzufügen" Button bei Schritten
- [ ] Änderungen sofort speichern (Auto-Save)
- [ ] Keine Navigation zum Editor notwendig

**Betroffene Dateien:**
- `src/views/Recipe.vue`
- `src/components/IngredientInlineEdit.vue` (neu)
- `src/components/StepInlineEdit.vue` (neu)

---

### Phase 2: Rezept-Editor vereinfachen
> **Status:** 🔵 In Planung
> **Ziel:** Intuitive Bearbeitung auch auf Desktop & Touch-Geräten

#### 2.1 Editor-UX-Überarbeitung
**Priorität:** 🔴 Kritisch | **Aufwand:** XL

**Identifizierte Probleme:**
- ❌ Zu technisch / YAML-orientiert → Nutzer muss Struktur verstehen
- ❌ Drag & Drop funktioniert nicht → Reihenfolge ändern unmöglich
- ❌ Zutaten und Schritte eines Abschnitts zu weit auseinander → schlechte Übersicht
- ❌ Nicht responsive → auf Touch-Geräten unbrauchbar
- ❌ Input-Felder zu klein → besonders Zutaten schwer zu bearbeiten
- ❌ Neues Rezept anlegen ohne Hilfe → kein Wizard/Assistent
- ❌ Metadaten-Felder fehlen komplett im Editor

**Lösungskonzept - Komplett neuer Editor:**

**A) Rezept-Erstellungs-Assistent (Wizard):**
- [ ] **Schritt 1: Grunddaten**
  - Titel (Pflicht)
  - Bild hochladen (Optional)
  - Beschreibung/Subtitle
  - Portionen
  - Zeiten (Vorbereitung, Kochen, Gesamt)
  
- [ ] **Schritt 2: Metadaten**
  - Autor
  - Quelle (URL oder Buch)
  - Tags/Kategorien
  - [Überspringen]-Button
  
- [ ] **Schritt 3: Erster Abschnitt**
  - Abschnittsname (z.B. "Teig", "Füllung")
  - Mindestens 1 Zutat hinzufügen
  - Mindestens 1 Schritt hinzufügen
  
- [ ] **Schritt 4: Weitere Abschnitte?**
  - [+ Abschnitt hinzufügen] oder [Fertig]
  
- [ ] **Fertigstellung**
  - Vorschau anzeigen
  - [Speichern] → Weiterleitung zu Rezeptansicht
  - [Weiter bearbeiten] → Zum erweiterten Editor

**B) Layout-Neugestaltung:**
- [ ] **Abschnitts-basierte Struktur:** Ein Abschnitt = Karte mit Zutaten + Schritte zusammen
- [ ] **Card-Layout:** Jeder Abschnitt als separate Card (visuell getrennt)
- [ ] **Responsive Grid:** 1 Spalte (Mobile), 2 Spalten (Desktop: Zutaten | Schritte)
- [ ] **Touch-optimiert:** Große Buttons (min. 44x44px), großzügige Abstände

**B) Eingabe-Verbesserungen:**
- [ ] **Größere Input-Felder:** Besonders bei Zutaten (Menge, Name, Einheit)
- [ ] **Inline-Buttons:** + / - Buttons direkt bei Zutat/Schritt (nicht versteckt)
- [ ] **Keyboard-Shortcuts:** Enter = neue Zeile, Tab = nächstes Feld, Shift+↑↓ = verschieben
- [ ] **Auto-Focus:** Nach "Neue Zutat" direkt im ersten Feld

**C) Drag & Drop reparieren:**
- [ ] **Visuelles Feedback:** Zeige wo Element landet (Placeholder)
- [ ] **Touch-Support:** Touch & Hold zum Verschieben
- [ ] **Alternative:** Hoch/Runter-Buttons wenn Drag & Drop nicht funktioniert

**D) Visuelle Verbesserungen:**
- [ ] **Live-Preview:** Optional zweite Spalte mit Vorschau des Rezepts
- [ ] **Collapse/Expand:** Abschnitte einklappbar (Fokus auf einen Abschnitt)
- [ ] **Icons statt Text:** Symbolleiste statt Textbuttons
- [ ] **Validierung:** Zeige Fehler inline (z.B. "Zutat ohne Namen")

**Mock-up Neue Editor-Struktur:**
```
┌─────────────────────────────────────────────┐
│ [← Zurück] Rezept bearbeiten    [💾 Speichern] │
├─────────────────────────────────────────────┤
│ 📸 [Bild hochladen]  Titel: [Apfelkuchen__] │
│ Portionen: [4_] | Zeit: [60_] Min           │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─ 📦 ABSCHNITT: Teig ──────────── [▲][▼][✕]│
│ │                                           │
│ │ ZUTATEN              SCHRITTE             │
│ │ ┌──────────────┐    ┌──────────────────┐ │
│ │ │ [200] g      │    │ 1. Mehl und Butter│ │
│ │ │ [Mehl_____] │    │    [vermengen___]│ │
│ │ │ [+ Zutat]    │    │                  │ │
│ │ │              │    │ 2. [Zu einem Teig│ │
│ │ │ [300] g      │    │    kneten______]│ │
│ │ │ [Butter___] │    │                  │ │
│ │ │              │    │ [+ Schritt]      │ │
│ │ └──────────────┘    └──────────────────┘ │
│ └───────────────────────────────────────────│
│                                             │
│ ┌─ 📦 ABSCHNITT: Füllung ─────────[▲][▼][✕]│
│ │ ...                                       │
│ └───────────────────────────────────────────│
│                                             │
│ [+ Neuer Abschnitt]                         │
└─────────────────────────────────────────────┘
```

**Betroffene Dateien:**
- `src/views/Edit.vue` (Haupt-Umbau)
- `src/components/SectionEdit.vue` (neu: Abschnitt als Card)
- `src/components/IngredientEdit.vue` (vereinfachen)
- `src/components/StepEdit.vue` (vereinfachen)
- `src/components/ArrayReorderBtnGroup.vue` (für ▲▼ Buttons)

**Technische Details:**
- Vuedraggable aktualisieren/reparieren oder Alternative (z.B. SortableJS direkt)
- Touch-Events für Mobile (touchstart, touchmove, touchend)
- Undo/Redo mit Command Pattern?

---

### Phase 3: Koch-Workflow-Features
> **Status:** 🔵 In Planung  
> **Ziel:** Praktische Features für den Koch-Alltag

#### 3.1 Tabbed Recipe Interface (Multi-Rezept)
**Priorität:** 🟡 Wichtig | **Aufwand:** M
**Problem:** Während des Kochens in anderem Rezept nachsehen → Navigation verliert Position

**Lösungskonzept:**
```
┌────────────────────────────────────────────────┐
│ [🏠 Galerie] [📖 Apfelkuchen *] [📖 Vanillesauce] [+] │ ← Tabs
├────────────────────────────────────────────────┤
│ Rezeptansicht (Split-View wie Sprint 1)       │
│                                                │
│ [Zutaten...]  |  [Schritte...]                │
└────────────────────────────────────────────────┘
```

**Features:**
- [ ] **Tab-System:** Mehrere Rezepte gleichzeitig offen
- [ ] **Position merken:** Scroll-Position pro Tab gespeichert
- [ ] **Stern-Markierung:** Aktives Rezept (beim Kochen) mit *
- [ ] **Galerie-Tab:** Immer erster Tab, zum schnellen Suchen
- [ ] **Tab-Limit:** Max. 5 offene Rezepte (Memory-Schonung)
- [ ] **Close-Button:** Rezept schließen (außer Galerie)
- [ ] **Swipe-Geste:** Zwischen Tabs wischen (Mobile)
- [ ] **LocalStorage:** Offene Tabs überleben Browser-Reload

**Technische Umsetzung:**
- Vue Router mit Query-Params: `?tabs=recipe-1,recipe-2,recipe-3`
- Store: Array mit offenen Rezept-IDs + Scroll-Positionen
- Component: `<RecipeTabBar>` in `App.vue` oder Layout

**Betroffene Dateien:**
- `src/App.vue` (Tab-Bar hinzufügen)
- `src/components/RecipeTabBar.vue` (neu)
- `src/router/index.ts` (Multi-Tab Routing)
- Store: `modules/recipeTabs.ts` (neu)

---

#### 3.2 Koch-Notizen mit Spracheingabe
**Priorität:** 🟢 Nice-to-have | **Aufwand:** M
**Problem:** Beim Kochen Ideen für Verbesserungen festhalten, ohne Hände zu benutzen

**Lösungskonzept:**
```
┌─────────────────────────────┐
│ Apfelkuchen        [🎤][📝] │ ← Buttons in Header
│                             │
│ [Zutaten] | [Schritte]      │
│                             │
│ ═══ NOTIZEN ═══             │ ← Neuer Bereich
│ 🎤 "Nächstes Mal mehr Salz" │
│    (vor 2 Min - Sprachmemo) │
│                             │
│ ✏️ "20 Min statt 15"        │
│    (vor 5 Min)              │
│                             │
│ [+ Notiz hinzufügen]        │
└─────────────────────────────┘
```

**Features:**
- [ ] **Notizen-Panel:** Einklappbarer Bereich unterhalb des Rezepts
- [ ] **Text-Notizen:** Schnelle Texteingabe mit großem Textarea
- [ ] **Spracheingabe:** Browser Web Speech API (Chrome, Safari, Edge)
  - Button-Press: Mikrofon aktivieren
  - Live-Transkription anzeigen
  - Auto-Save wenn Spracherkennung endet
- [ ] **Timestamp:** Jede Notiz mit Zeitstempel
- [ ] **Notiz-Typen:** 
  - 💡 Verbesserungsidee
  - ⚠️ Problem/Warnung
  - ✅ Hat gut funktioniert
  - 📝 Allgemeine Notiz
- [ ] **Export to Editor:** "In Rezept übernehmen" Button
  - Notizen → werden zu Schritt-Kommentaren oder separatem Notiz-Feld
- [ ] **Temporärer Speicher:** Notizen im LocalStorage (nicht direkt im Rezept)
- [ ] **Löschen:** Notizen einzeln oder alle löschen

**Technische Umsetzung:**
- Web Speech API: `webkitSpeechRecognition` / `SpeechRecognition`
- Browser-Support: Chrome ✅, Safari ✅, Firefox ❌ (Fallback: nur Text)
- Permissions: Mikrofon-Zugriff (HTTPS erforderlich!)
- Store: `cookingNotes` pro Rezept-ID

**Betroffene Dateien:**
- `src/views/Recipe.vue` (Notizen-Panel)
- `src/components/CookingNotes.vue` (neu)
- `src/components/VoiceInput.vue` (neu)
- `src/composables/useSpeechRecognition.ts` (neu)
- Store: `modules/cookingNotes.ts` (neu)

---

### Phase 4: Visual Design & Modernisierung
> **Status:** 🔵 In Planung
> **Ziel:** Funktional + ansprechend

#### 4.1 Design-System
- [ ] Farbschema: Professionell & klar (gedeckte Farben, gute Kontraste)
- [ ] Typografie: Gut lesbar in der Küche (größere Schrift, klare Hierarchie)
- [ ] Touch-Targets: Mindestens 44x44px für Tablets/Smartphones
- [ ] Spacing: Großzügig für Touch-Bedienung

#### 4.2 Komponenten-Modernisierung
- [ ] Rezept-Karten (`RecipeCard.vue`): Klarere Struktur, bessere Bilder
- [ ] Suchfunktion: Prominent in Navbar
- [ ] Filter & Sortierung in Galerie

---

## 📋 ✅ PLANUNG ABGESCHLOSSEN

### ✅ Frage 1: Split-View auf Tablet - ENTSCHIEDEN
**Gewählte Lösung: Split-View (Option A) mit erweiterten Features**

**Spezifikation:**
- ✅ Nebeneinander: Zutaten links, Schritte rechts
- ✅ **Zutaten STICKY** (bleiben immer sichtbar beim Scrollen der Schritte)
- ✅ **Filter-Modus:** Toggle "Alle Zutaten" vs. "Nur aktueller Abschnitt"
- ✅ **Resizable (optional):** Anfasser zum Anpassen der Spaltenbreite (Nice-to-have, kein Muss)

**Technische Umsetzung:**
- CSS: `position: sticky` für Zutaten-Container
- Abschnitts-Erkennung: Scroll-Position → highlighte aktiven Abschnitt
- LocalStorage: Speichere Filter-Präferenz & Spaltenbreite

---

### ✅ Frage 4: Mobile Koch-Ansicht - ENTSCHIEDEN  
**Gewählte Lösung: Floating Action Button mit intelligentem Layout**

**Spezifikation:**

**Portrait-Modus (Hochformat):**
```
Normalansicht:
┌─────────────────────────────┐
│ Apfelkuchen                 │
│                             │
│ SCHRITTE ↕ scrollbar        │
│ 1. Mehl und Butter...       │
│ 2. Zu einem Teig...         │
│                             │
│               ┌──────┐      │
│               │ 📋   │      │ ← FAB rechts unten
│               └──────┘      │
└─────────────────────────────┘

Klick auf FAB → Slide-In von unten (70% Höhe):
┌─────────────────────────────┐
│ SCHRITTE ↕ scrollbar        │ ← Weiter sichtbar & scrollbar
│ 1. Mehl...                  │
├─────────────────────────────┤
│ [✕] ZUTATEN - Teig     [▼]  │ ← Slide-In Panel
│                             │
│ • 300g Mehl          ↕      │ ← Auch scrollbar
│ • 200g Butter   scrollbar   │
│ • 100g Zucker               │
│                             │
└─────────────────────────────┘
```
**Wichtig:** Beide Bereiche bleiben scrollbar (Split-Scrolling)

**Landscape-Modus (Querformat):**
```
┌───────────────────────────────────────────────────┐
│ Apfelkuchen                        [✕ Zutaten]   │
├──────────────────────┬────────────────────────────┤
│ ZUTATEN ↕            │ SCHRITTE ↕                 │
│                      │                            │
│ • 300g Mehl          │ 1. Mehl und Butter...      │
│ • 200g Butter        │ 2. Zu einem Teig...        │
│ • 100g Zucker        │ 3. 30 Min kalt stellen     │
│                      │                            │
│  scrollbar           │  scrollbar                 │
└──────────────────────┴────────────────────────────┘
```
**Automatische Umschaltung:** 40% Zutaten / 60% Schritte nebeneinander

**Technische Umsetzung:**
- CSS: `@media (orientation: landscape)` für Querformat-Layout
- Vue Transition: Slide-Up Animation für Panel
- Touch-Events: Swipe-Down zum Schließen des Panels
- Z-Index Layering: Panel schwebt über Schritte, aber beide scrollbar

---

## 🚀 Umsetzungsplan

### Sprint 1: Koch-Ansicht - Split-View Desktop/Tablet (3-5 Tage)
**Ziel:** Parallele Ansicht von Zutaten & Schritten, keine Wechsel mehr
**Status:** 🔵 Bereit zum Start

**Tasks:**
1. [ ] Responsive Layout erstellen
   - Desktop: 35% Zutaten (sticky) | 65% Schritte
   - Tablet: 40% Zutaten (sticky) | 60% Schritte
   - Mobile: Weiter unten (Sprint 2)
   
2. [ ] Sticky Zutaten-Spalte
   - CSS: `position: sticky; top: 0`
   - Volle Höhe, unabhängig scrollbar
   
3. [ ] Filter-Toggle: "Alle Zutaten" / "Nur aktueller Abschnitt"
   - Button oben in Zutaten-Spalte
   - Scroll-Position der Schritte → automatisches Highlight des Abschnitts
   - Im "Nur aktuell"-Modus: Zeige nur Zutaten des sichtbaren Abschnitts
   
4. [ ] Resizable Splitter (Optional - Nice-to-have)
   - Drag-Handle zwischen den Spalten
   - Verhältnis speichern in LocalStorage
   - Mindestbreite: 25% / 75%

**Betroffene Dateien:**
- `src/views/Recipe.vue` (Layout-Änderung)
- Neue CSS: Split-View Styles
- Store: Präferenz speichern (Filter-Modus, Spaltenbreite)

---

### Sprint 2: Koch-Ansicht - Mobile FAB + Slide-In (2-3 Tage)
**Ziel:** Intelligente mobile Koch-Ansicht mit orientierungsabhängigem Layout
**Status:** 🔵 Bereit zum Start

**Tasks:**
1. [ ] Floating Action Button (FAB)
   - Position: rechts unten, fixed
   - Icon: 📋 (Zutatenliste)
   - Zeige nur auf Mobile (< 768px)
   
2. [ ] Slide-In Panel (Portrait)
   - Animation: Slide-Up von unten (70% Bildschirmhöhe)
   - Backdrop: Semi-transparent, klickbar zum Schließen
   - Beide Bereiche scrollbar (Split-Scrolling)
   - Swipe-Down zum Schließen
   
3. [ ] Landscape-Modus (Querformat)
   - Automatische Umschaltung: Split-View nebeneinander
   - 40% Zutaten | 60% Schritte
   - Beide scrollbar, kein Overlay
   - Close-Button oben rechts
   
4. [ ] Abschnitts-Synchronisation
   - Scroll zu Schritt → highlighte passende Zutaten
   - Im Panel: Zeige primär Zutaten des aktuellen Abschnitts

**Betroffene Dateien:**
- `src/views/Recipe.vue` (Mobile-Layout)
- `src/components/IngredientsPanelMobile.vue` (neu)
- CSS: FAB, Slide-In Animation, Landscape Media Queries

---

### Sprint 3: Inline-Editing im Koch-Modus (3-4 Tage)
**Ziel:** Kleine Anpassungen ohne Editor-Wechsel
**Status:** 🔵 Bereit zum Start

**Tasks:**
1. [ ] Inline-Edit für Mengen
   - Klick auf Zutat → Menge wird zu Input-Field
   - Größere Touch-Targets (min. 44x44px)
   - Enter/Blur = Speichern, Escape = Abbrechen
   - Auto-Save nach 1 Sekunde Inaktivität
   
2. [ ] Inline-Edit für Schritt-Text
   - Doppelklick auf Schritt → contenteditable oder Textarea
   - Gleiche Save-Logik wie bei Mengen
   
3. [ ] Visuelle Feedback
   - Edit-Modus: Hintergrund leicht hervorheben
   - Speicher-Indikator: Kurzes "✓ Gespeichert" Toast
   - Fehler-Handling: "✗ Speichern fehlgeschlagen"
   
4. [ ] Undo-Funktion (Optional)
   - Command Pattern für Änderungen
   - "Rückgängig" Button (zeitbasiert: 10 Sek)

**Betroffene Dateien:**
- `src/views/Recipe.vue` (Edit-Modi aktivieren)
- `src/components/IngredientInlineEdit.vue` (neu)
- `src/components/StepInlineEdit.vue` (neu)
- Store: Auto-Save Mutations

---

### Sprint 4: Editor-Überarbeitung (2-3 Wochen)
**Ziel:** Intuitive Rezeptbearbeitung
**Status:** 🔵 Nach Phase A

1. 🔵 Analyse der aktuellen Probleme (zusammen durchgehen)
2. 🔵 Prototyp neue Editor-UI
3. 🔵 Implementierung nach Feedback
4. 🔵 Testing auf allen Geräten

---

### Sprint 5: Tabbed Recipe Interface (3-4 Tage)
**Ziel:** Multi-Rezept Navigation ohne Positionsverlust
**Status:** 🔵 Optional - nach Sprint 1-3

**Tasks:**
1. [ ] Tab-Bar Komponente
   - Horizontal scrollbar bei vielen Tabs
   - Active Tab hervorheben
   - Close-Buttons (außer Galerie)
   
2. [ ] Tab-State Management
   - Store: Array mit offenen Rezept-IDs
   - Scroll-Position pro Tab speichern
   - LocalStorage Persistence
   
3. [ ] Router Integration
   - Query-Params für Tab-State
   - Browser Back/Forward funktioniert
   
4. [ ] Mobile Touch-Gestures
   - Swipe left/right zwischen Tabs
   - Long-press für Tab-Menu (Close, Close Others, etc.)

**Betroffene Dateien:**
- `src/App.vue` oder Layout-Component
- `src/components/RecipeTabBar.vue` (neu)
- `src/store/modules/recipeTabs.ts` (neu)
- `src/router/index.ts`

---

### Sprint 6: Koch-Notizen mit Spracheingabe (4-5 Tage)
**Ziel:** Hands-free Notizen während des Kochens
**Status:** 🔵 Optional - nach Sprint 5

**Tasks:**
1. [ ] Notizen-Panel UI
   - Einklappbarer Bereich in Recipe.vue
   - Notizliste mit Timestamps
   - Icon-Kategorisierung
   
2. [ ] Web Speech API Integration
   - Feature Detection (Browser-Support prüfen)
   - Mikrofon-Permission Request
   - Live-Transkription anzeigen
   - Fehler-Handling (kein HTTPS, kein Support)
   
3. [ ] Notizen-Management
   - CRUD Operations (Create, Read, Delete)
   - LocalStorage pro Rezept
   - "In Rezept übernehmen" Funktion
   
4. [ ] Voice UX
   - Visuelles Feedback (Mikrofon pulsiert)
   - Countdown bei Auto-Stop (nach 5 Sek Stille)
   - Sprache auswählbar (DE, EN, etc.)

**Betroffene Dateien:**
- `src/views/Recipe.vue`
- `src/components/CookingNotes.vue` (neu)
- `src/components/VoiceInput.vue` (neu)
- `src/composables/useSpeechRecognition.ts` (neu)
- `src/store/modules/cookingNotes.ts` (neu)

---

## 📝 Design-Mockups & Ideen

### Skizze: Split-View Rezeptansicht (Desktop/Tablet)
```
┌─────────────────────────────────────────────────────────┐
│ [← Zurück] Apfelkuchen                    [⭐][✏️][⋮]   │
├─────────────────────┬───────────────────────────────────┤
│ ZUTATEN             │ SCHRITTE                          │
│                     │                                   │
│ □ Teig              │ 1️⃣ Teig                           │
│   • 300g Mehl       │                                   │
│   • 200g Butter     │   1. Mehl und Butter vermengen    │
│   • 100g Zucker     │   2. Zu einem Teig kneten         │
│                     │   3. 30 Min kalt stellen          │
│ □ Füllung           │                                   │
│   • 4 Äpfel         │ 2️⃣ Füllung                        │
│   • 2 EL Zimt       │                                   │
│                     │   1. Äpfel schälen und schneiden  │
│ [Abschnitt ▼]       │   2. Mit Zimt vermischen          │
└─────────────────────┴───────────────────────────────────┘
```

### Skizze: Inline-Editing
```
Zutat vor Klick:   • 200g Mehl
Zutat nach Klick:  • [200]g Mehl  [✓][✗]
                      └─ inline input mit Buttons
```

---

## ✅ Nächste Schritte

### 🎯 Implementierungsreihenfolge (nach Impact & Abhängigkeiten):

### 🎯 Implementierungsreihenfolge (nach Impact & Abhängigkeiten):

**Phase 0: Navigation & Informationsarchitektur (FOUNDATION - Zuerst!)**
0. 🔵 Sprint 0: Navbar-Neugestaltung + Metadaten (3-4 Tage) → **Start hier!**
   - Navbar: Koch-fokussiert, Admin im Dropdown
   - Galerie = Verwaltung fusioniert
   - Metadaten in Rezeptansicht + Editor
   - Experten-Modus für YAML Import/Export

**Phase A: Koch-Ansicht optimieren (Höchste Priorität - KRITISCH)**
1. ✅ Sprint 1: Split-View Desktop/Tablet (3-5 Tage)
2. ✅ Sprint 2: Mobile FAB + Slide-In (2-3 Tage)
3. ✅ Sprint 3: Inline-Editing (3-4 Tage)

**Phase B: Editor-Neugestaltung (Nach Phase A - KRITISCH)**
4. 🔵 Sprint 4: Rezept-Wizard (1 Woche) - *Guided Recipe Creation*
5. 🔵 Sprint 5: Editor-Überarbeitung (2-3 Wochen) - *Complete Redesign*

**Phase C: Koch-Workflow-Features (Optional - NICE-TO-HAVE)**
6. 🟢 Sprint 6: Tabbed Recipe Interface (3-4 Tage) - *Multi-Rezept Navigation*
7. 🟢 Sprint 7: Koch-Notizen + Spracheingabe (4-5 Tage) - *Hands-free Notizen*

**Phase D: Design-Modernisierung (Parallel zu Phase B)**
8. 🔵 Sprint 8: Design-System & Visual Polish

---

### 🚀 BEREIT ZUM START!

**Alle Planungsfragen beantwortet ✓**  
**Technische Spezifikation komplett ✓**  
**Mockups erstellt ✓**  
**Neue Features dokumentiert ✓**
**Navigation-Konzept definiert ✓**

**WICHTIGE ÄNDERUNG - Start mit Phase 0!**

Die Navbar-Probleme sind fundamental und betreffen alle weiteren Features. Daher:

**Neue Empfehlung:**
1. 🔴 **Zuerst:** Sprint 0 (Navbar + Metadaten) - schafft Foundation
2. 🔴 **Dann:** Sprint 1-3 (Koch-Ansicht optimieren) - löst größten Pain Point
3. 🔴 **Dann:** Sprint 4-5 (Wizard + Editor) - löst zweitgrößten Pain Point
4. 🟢 **Optional:** Sprint 6-7 (Tabs, Notizen) - Quality of Life

**Vorteil von Sprint 0 zuerst:**
- Edit-Button verschwindet aus Navbar → kein Konflikt mit FAB in Sprint 1
- Metadaten-Support → Wizard in Sprint 4 kann darauf aufbauen
- Galerie/Verwaltung fusioniert → klare Struktur für alle Features
- Experten-Modus → YAML-Features versteckt, App wirkt einfacher

**Nächster Schritt:** Sprint 0 - Navbar-Neugestaltung + Metadaten

Soll ich mit Sprint 0 beginnen oder lieber doch mit Sprint 1? 🚀

---

*Letzte Aktualisierung: 7. Dezember 2025*
