# Planungsnotizen - UI-Redesign

> **Hinweis:** Dies sind die Arbeitsnotizen aus dem Planungsprozess.  
> **Das finale Ergebnis steht in:** `UI-ROADMAP.md`

---

## Planungsgespräche (Dezember 2025)

### Initiale Anforderungen

**Nutzungskontext:**
- Familie (mehrere Nutzer)
- Primäre Geräte: Smartphone & Tablet in der Küche, Desktop für Administration
- Haupt-Use-Case: Rezept finden → beim Kochen nachschlagen
- Design-Präferenz: Funktional, professionell, klar - aber ansprechend

**Top Pain Points (identifiziert):**
1. 🔴 Rezeptbearbeitung umständlich (auch auf Desktop)
2. 🔴 Ständiges Hin- und Herwechseln zwischen Zutaten & Schritten
3. 🔴 Navbar zu technisch/administrativ
4. 🟡 YAML-Felder werden nicht angezeigt/bearbeitet
5. 🟡 Kleine Anpassungen beim Kochen nicht möglich
6. 🟡 Navigation verliert Position bei Multi-Rezept
7. 🟡 Neues Rezept anlegen nicht intuitiv

---

## Entscheidungen aus Planungsgesprächen

### Frage 1: Split-View auf Tablet
**Entscheidung:** Split-View mit erweiterten Features
- Nebeneinander: Zutaten links, Schritte rechts
- Zutaten STICKY (bleiben immer sichtbar)
- Filter-Toggle: "Alle Zutaten" vs. "Nur aktueller Abschnitt"
- Optional: Resizable Splitter (Nice-to-have)

### Frage 2: Editor-Probleme
**Identifizierte Probleme:**
- Zu technisch / YAML-orientiert
- Drag & Drop funktioniert nicht
- Zutaten und Schritte zu weit auseinander
- Nicht responsive / Touch-unfreundlich
- Input-Felder zu klein
- Kein Wizard für neue Rezepte

**Lösung:** Komplette Neugestaltung + Wizard

### Frage 3: Mobile Koch-Ansicht
**Entscheidung:** Floating Action Button mit intelligentem Layout
- **Portrait:** Slide-In Panel von unten (70% Höhe), beide Bereiche scrollbar
- **Landscape:** Automatisch Split-View nebeneinander (40/60)

### Frage 4: Navbar-Probleme
**Entscheidung:** Koch-fokussierte Navigation
- Edit-Button raus aus Navbar → FAB im Rezept
- Galerie als Hauptfokus
- Admin-Features im Dropdown
- Experten-Modus für YAML Import/Export
- Galerie & Verwaltung fusionieren

### Frage 5: Neue Feature-Ideen
**Tabbed Interface:**
- Mehrere Rezepte gleichzeitig offen
- Position pro Tab merken
- Galerie immer als erster Tab

**Koch-Notizen:**
- Spracheingabe (Web Speech API)
- Temporär in LocalStorage
- "In Rezept übernehmen" Funktion

### Frage 6: Portionen skalieren
**Entscheidung:** Bestehende Funktionalität erhalten
- Neu platzieren: Recipe Header neben Portionen-Anzeige
- `[− 4 +]` Buttons oder Slider

### Frage 7: Einkaufsliste
**Entscheidung:** Simple Clipboard-Lösung
- Kein Abhaken (bewusst nicht)
- Button → Modal → Clipboard/Share
- Formatiert als Plain Text für iOS Notizen, WhatsApp, etc.

### Frage 8: Suche & Filter
**Entscheidung:** Phase 1 = Titel + Tags
- Suche nach Titel (Live-Suche)
- Filter nach Tags (Multi-Select)
- Später erweitern: Zutaten, Volltext, Zeit

---

## Offene Fragen (geklärt)

### ✅ Accessibility?
→ Später (Sprint 9+), nicht kritisch für MVP

### ✅ Onboarding?
→ Später, nicht in aktueller Roadmap

### ✅ Performance/Lazy Loading?
→ Später, bei Bedarf optimieren

### ✅ Offline-Konflikte?
→ Bestehende WebDAV-Logik, nicht ändern

### ✅ PDF-Export?
→ Nicht geplant, QR-Code + YAML reicht

### ✅ Mehrere Bilder pro Rezept?
→ Nicht geplant, ein Hauptbild reicht

---

## Verworfene Ideen

- ❌ Zutaten abhaken (zu komplex, nicht nötig)
- ❌ Volltext-Suche in Phase 1 (später)
- ❌ Einkaufsliste mit Mengen-Kombination mehrerer Rezepte (zu komplex)
- ❌ Markdown-Support für Schritte (YAML bleibt)
- ❌ Dark Mode in Phase 1 (später, Design-System)

---

## Design-Entscheidungen

### Navigation
- Koch-Workflow vor Admin-Features
- Experten-Modus versteckt technische Features
- Galerie = Verwaltung (eine Ansicht)

### Koch-Ansicht
- Split-View statt Tabs (Desktop/Tablet)
- FAB statt Sticky Header (Mobile Portrait)
- Orientierungsabhängiges Layout (Landscape = Split)

### Editor
- Wizard für neue Rezepte (guided)
- Card-basiertes Layout (Abschnitte zusammen)
- Touch-optimiert (44x44px Minimum)

---

*Diese Notizen dienen als Archiv des Planungsprozesses. Die finale, bereinigte Roadmap ist in `UI-ROADMAP.md`.*
