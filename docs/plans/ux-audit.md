# UX-Audit: Rezeptansicht, Bearbeitung, Profil, Verwaltung

> Auftrag U.1 · Stand 2026-11-17 · Basis `main@c9c7858` (inhaltlich `main@48eb468`, dazwischen nur der Roadmap-Commit, der U.1 anlegt) · Die parallel laufenden W.33 und 11.1 sind nicht enthalten.

## Inhalt
1. [Methode und Grenzen](#1-methode-und-grenzen)
2. [Personas und Kernaufgaben](#2-personas-und-kernaufgaben)
3. [Zusammenfassung](#3-zusammenfassung)
4. [Cognitive Walkthrough](#4-cognitive-walkthrough)
5. [Befunde je Ansicht](#5-befunde-je-ansicht)
6. [Barrierefreiheit (WCAG 2.2 AA)](#6-barrierefreiheit-wcag-22-aa)
7. [Abweichungen von Plan und UX-Konzept](#7-abweichungen-von-plan-und-ux-konzept)
8. [Hinweise an bestehende Roadmap-Punkte](#8-hinweise-an-bestehende-roadmap-punkte)
9. [Vorschlag zur Bündelung](#9-vorschlag-zur-bündelung)
10. [Was gut funktioniert](#10-was-gut-funktioniert)
11. [Am Gerät prüfen](#11-am-gerät-prüfen)

---

## 1. Methode und Grenzen

**Maßstab:** UX-Konzept „Immersive + Bottom Nav“ und Sprint 9 in [ui-roadmap-2025-26.md](ui-roadmap-2025-26.md). Dazu kommen die 10 Heuristiken nach Nielsen, die Apple Human Interface Guidelines (Touch-Ziele ≥ 44 pt, Daumenzone, Sheets, Tastaturtypen), Formular-UX, die Küchentauglichkeit und WCAG 2.2 AA.

**Vorgehen:**
- Gelesen: die Ansichten in `frontend/src/views/` sowie die Komponenten in `components/recipe/`, `components/edit/`, `components/admin/`, `components/layout/` und `components/features/`.
- Danach den Production-Build (`npm run build`) im Browser bedient:
  - ein eigener Node-Server, nur im Scratchpad: liefert `dist/`, `/config.js` und die Discovery eines Mock-IdP;
  - eine Mock-API mit Fixture-Daten für alle genutzten `/api/v1/…`-Endpunkte;
  - eine gültige oidc-client-ts-Sitzung, vorab in localStorage gesetzt. Es lief kein Login, echte Zugangsdaten wurden nicht verwendet.
- Die Rechte der Mock-API entsprechen dem Backend: `read_only` folgt aus der Rolle, `DELETE /recipes` liefert 403 außer für Admins.
- Fixtures:
  - ein langes Rezept mit drei Abschnitten, Notizen und HACCP-Hinweis (Lasagne)
  - eines mit Vorlage aus dem Foto-Import (Linzer Torte)
  - eines ohne Bild (Linsensuppe)
  - acht weitere für Home
  - vier Nutzer, einer davon `pending`
  - drei Freigaben
- Verhaltensproben P1–P14 (Skript `probe.mjs`) belegen die Befunde zum Verhalten. Sie sind in den Befunden als „Probe Pn“ zitiert.

**Werkzeuge und Versionen:**
| Werkzeug | Version | Zweck |
|---|---|---|
| Microsoft Edge (Chromium), headless | 156.0.4314.50 | Rendering, Screenshots |
| playwright-core | 1.65.1 | Steuerung, iPhone- und Tablet-Emulation |
| axe-core | 4.14.1 | WCAG-Prüfung, Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice` |
| eigene Messung | – | Größe aller Touch-Ziele und Schriftgröße der Eingabefelder je Zustand |

Lighthouse wurde nicht eingesetzt: Sein Accessibility-Teil beruht ebenfalls auf axe-core.

**Formate:** iPhone mit 390 × 844 pt, DPR 3, Touch und iOS-UA; Tablet quer mit 1180 × 820 pt, DPR 2. Beide jeweils hell und dunkel, also `prefers-color-scheme` mit der Einstellung „System“.

**Screenshots:** 86 Bilder unter [ux-audit/](ux-audit/), benannt `<gerät>-<hell|dunkel>-<zustand>.png`. Sie sind auf 256 Farben reduziert, in voller Auflösung, zusammen 6,2 MB. Hinzu kommen drei Bilder `probe-*.png` als Beleg der Proben.

**Grenzen:**
- Chromium ist kein iOS-Safari. Safe Areas, Bildschirmtastatur, Standalone-Modus, Wake Lock, Zoom und Zwischenablage sind deshalb nur angenähert. Solche Befunde tragen den Vermerk **„am Gerät prüfen“** und sind in [Abschnitt 11](#11-am-gerät-prüfen) gesammelt.
- Die Schrift auf den Screenshots ist Segoe UI, auf iOS wäre es SF Pro. Zeilenumbrüche können deshalb abweichen.
- Die Fixture-Bilder sind Platzhalter (SVG). Wie lesbar der Titel auf echten Fotos ist, ist nicht geprüft.
- Galerie, Suche und Favoriten sind nur so weit geprüft, wie K3, K4 und K6 sie berühren. Login und geteilte Rezepte (`SharedRecipe.vue`) sind ausgenommen.

**Schweregrad nach Nielsen:**
| Stufe | Bedeutung |
|---|---|
| 0 | kein Usability-Problem |
| 1 | kosmetisch bzw. Geschmack |
| 2 | gering |
| 3 | groß, hohe Priorität |
| 4 | Katastrophe, vor allem anderen beheben |

**Aufwand:**
| Stufe | Umfang |
|---|---|
| XS | < 1 h |
| S | ≤ ½ Tag |
| M | 1–2 Tage |
| L | > 2 Tage |

---

## 2. Personas und Kernaufgaben

| | Persona | Gerät | Rolle | Merkmale |
|---|---|---|---|---|
| **P1** | gelegentliche Köchin | iPhone, installierte PWA | `readonly` | kocht mit nassen oder fettigen Händen und bedient mit einer Hand; wenig Geduld mit Technik; kennt nur Home und Rezept |
| **P2** | Editor mit vielen Importen | iPad quer und iPhone | `editor` | fotografiert Kochbücher, korrigiert KI-Fehler, will schnell sein, legt auch von Hand an |
| **P3** | Admin | Tablet oder Desktop, gelegentlich iPhone | `admin` | schaltet Familienmitglieder frei, pflegt KI-Einstellungen und Freigaben; selten in der Verwaltung, deshalb ohne Routine |

| # | Kernaufgabe | Persona | Ansichten |
|---|---|---|---|
| K1 | Rezept am iPhone nachkochen: öffnen, Portionen anpassen, Zutaten zum aktuellen Schritt sehen, Vorlage ansehen | P1 | Rezept |
| K2 | Rezept am Tablet quer nachkochen (Split-View) | P2 | Rezept |
| K3 | bekanntes Rezept wiederfinden (Zuletzt, Galerie, Suche) und als Favorit markieren | P1 | Home, Rezept |
| K4 | Foto-Rezept importieren und korrigieren, bis es gespeichert ist | P2 | Home (FAB), Bearbeitung |
| K5 | Rezept bearbeiten: Zutat ergänzen, Abschnitt umsortieren, Bild ändern, speichern; Entwurf verwerfen und wiederaufnehmen | P2 | Bearbeitung, Home |
| K6 | Rezept neu von Hand anlegen (berührt 7.1) | P2 | Home, Bearbeitung |
| K7 | Rezept teilen und einen Link widerrufen | P2 | Rezept, Verwaltung |
| K8 | Darstellung ändern, abmelden | P1 | Profil |
| K9 | neues Familienmitglied freischalten und den KI-Zugang testen | P3 | Profil, Verwaltung |

---

## 3. Zusammenfassung

- **Das Gerüst trägt.** Die drei Modi, die schlanke Bottom Nav, der Split-View am Tablet, die gut lesbaren Schritte, Entwürfe mit Undo und die Vorlage des Foto-Imports funktionieren. Details in [Abschnitt 10](#10-was-gut-funktioniert).
- **Ein Befund der Stufe 4:** Das × in der Rezeptliste der Verwaltung löscht ein Rezept endgültig auf dem Server, ohne Rückfrage und ohne Rückgängig (V-01).
- **Befunde der Stufe 3, gruppiert:**
  - **Rechte und Löschen:**
    - Wer nur lesen darf, kann keine Favoriten setzen, obwohl das Backend es erlaubt (H-01).
    - Editoren sehen „Löschen“. Die Karte verschwindet, der Server lehnt ab (403), es erscheint keine Meldung, und nach dem Neuladen ist das Rezept wieder da (H-02).
  - **Kochen:**
    - Der Filter „Nur aktuell“ zeigt alle Abschnitte, der aktuelle steht zuletzt. Auf dem iPhone ist das die Voreinstellung (R-01).
    - Der Bildschirm bleibt nicht an (R-02).
    - Notizen zu Schritten und Zutaten, Verarbeitungshinweise und HACCP-Hinweise werden nie angezeigt (R-03).
  - **Bearbeiten:**
    - ✕ („Abbrechen“) verlässt den Editor ohne Rückfrage. Die Änderungen liegen dann unbemerkt als Entwurf, die Rezeptansicht zeigt den alten Stand (E-01).
    - „Neues Rezept“ legt sofort ein Rezept auf dem Server an; nach dem Abbrechen bleibt eine Karteileiche (H-03, Hinweis an 7.1).
- **Systematisch:**
  - Viele Touch-Ziele sind 30–32 px groß, gefordert sind 44 px. Im Editor gilt das für 44 von 50 Zielen.
  - Mehrere Tokens bleiben unter 4,5:1 Kontrast: `--color-text-muted`, Primärgrün als Text, die inaktiven Tabs der Bottom Nav, Weiß auf Primärgrün im Dunkelmodus.
  - Viele Schaltflächen und Dialoge zeigen noch Bootstrap-Blau, -Grün und -Grau statt der Tokens.
  - Overlays haben keine Dialog-Semantik: kein Fokus-Management, Escape schließt nicht.
  - Begriffe sind gemischt Englisch und Deutsch („AI“, „Share-Links“, „Pending“, „Units“, „Cancel/OK“).
- **Barrierefreiheit:** axe-core meldet 15 Regeln, vier davon kritisch: Schaltflächen und Selects ohne Namen, Eingaben ohne Label, ein Bild ohne Alt-Text. Details in [Abschnitt 6](#6-barrierefreiheit-wcag-22-aa).

| Ansicht | Stufe 4 | Stufe 3 | Stufe 2 | Stufe 1 | Stufe 0 |
|---|---|---|---|---|---|
| Übergreifend (X) | – | – | 6 | 4 | – |
| Home, soweit berührt (H) | – | 3 | 3 | 1 | – |
| Rezeptansicht (R) | – | 3 | 9 | 4 | – |
| Bearbeitung inkl. KI-Import (E, A) | – | 1 | 10 | 4 | – |
| Profil (P) | – | – | 4 | 1 | 1 |
| Verwaltung (V) | 1 | – | 4 | 2 | – |

---

## 4. Cognitive Walkthrough

Je Schritt vier Fragen:
- **A:** Erkennt die Person die richtige Aktion?
- **B:** Passt die Bezeichnung?
- **C:** Ist die Rückmeldung verständlich?
- **D:** Kommt die Person weiter?

Bewertung: ✓ ja, ~ eingeschränkt, ✗ nein. Die Spalte „Befund“ verweist auf [Abschnitt 5](#5-befunde-je-ansicht).

### K1 Rezept am iPhone nachkochen (P1)
| Schritt | A | B | C | D | Befund |
|---|---|---|---|---|---|
| Rezept unter „Zuletzt geöffnet“ antippen | ✓ | ✓ | ✓ | ✓ | – |
| Portionen von 6 auf 4 senken (± in der Leiste) | ✓ | ✓ | ~ | ✓ | R-07: Ziele 30 px direkt neben „Zutaten öffnen“. Die geänderten Mengen sieht man erst im Sheet. |
| Zutaten öffnen, „Nur aktuell“ | ✓ | ✓ | ✗ | ~ | R-01: alle Abschnitte, der aktuelle zuletzt |
| Gesamtzeit und Hinweise vorab lesen | ~ | ✓ | ✗ | ✓ | R-04: nur hinter ⓘ; R-08: „45 Minuten Min“ |
| Aktuellen Schritt markieren bzw. merken | ✗ | – | ✗ | ✗ | R-05: Antippen markiert nichts |
| Hände voller Teig, Bildschirm geht aus | – | – | ✗ | ✗ | R-02: kein Wake Lock |
| Schritt-Notiz „Wird es zu dick …“ lesen | ✗ | – | – | ✗ | R-03: Notizen werden nicht angezeigt |
| Vorlage (Originalseite) ansehen | ✓ | ✓ | ~ | ✓ | R-16: öffnet einen neuen Tab, am Gerät prüfen |

### K2 Rezept am Tablet quer nachkochen (P2)
| Schritt | A | B | C | D | Befund |
|---|---|---|---|---|---|
| Rezept öffnen, Split-View erscheint | ✓ | ✓ | ✓ | ✓ | Stärke |
| Zu „Schichten und Backen“ scrollen | ✓ | ✓ | ✗ | ~ | R-06: Der aktive Zutatenblock ist markiert, liegt aber außerhalb des sichtbaren Bereichs (y = 1042 bei 820 pt Höhe) |
| „Nur aktuell“ wählen | ✓ | ✓ | ✗ | ~ | R-01 |
| Notizen, HACCP | ✗ | – | – | ✗ | R-03 |

### K3 Rezept wiederfinden und als Favorit markieren (P1, `readonly`)
| Schritt | A | B | C | D | Befund |
|---|---|---|---|---|---|
| „Zuletzt geöffnet“ oder Galerie | ✓ | ✓ | ✓ | ✓ | – |
| Suche-Tab, Begriff eingeben | ✓ | ✓ | ✓ | ✓ | Rand: Feld `type="text"`, die iOS-Tastatur zeigt deshalb keine „Suchen“-Taste |
| Stern antippen | ✗ | – | – | ✗ | H-01: kein Stern auf Karte und Kopfzeile ([Beleg](ux-audit/iphone-hell-home-readonly.png)) |
| Favoriten-Tab | ✓ | ✓ | ✗ | ✗ | H-01: Der Leerzustand sagt „Tippe auf den Stern …“ ([Beleg](ux-audit/iphone-hell-favorites-readonly-leer.png)) |

### K4 Foto-Rezept importieren und korrigieren (P2)
| Schritt | A | B | C | D | Befund |
|---|---|---|---|---|---|
| FAB ＋ → „AI-Import“ | ✓ | ~ | ✓ | ✓ | X-06: „AI“ statt „KI“ |
| Dialog: „Foto aufnehmen oder wählen“ | ✓ | ✓ | ~ | ✓ | A-01: zusätzlich Footer „Cancel / OK“; A-02: doppelter Titel |
| „Rezept erkennen“ | ✓ | ✓ | ~ | ✓ | A-03: bis 120 s nur ein Spinner im Knopf |
| Ergebnis „Rezept erfolgreich erkannt!“ → „Rezept importieren“ | ✓ | ~ | ~ | ✓ | A-02: Der Zwischenschritt zeigt nur den Titel; drei Verben für einen Vorgang |
| Im Editor gegen die Vorlage korrigieren | ✓ | ✓ | ✓ | ✓ | Stärke: Vorlage im Editor |
| Menge „Salz“ leeren | ✓ | ✓ | ✗ | ~ | E-04: wird 0 |
| Tag ergänzen | ✗ | – | – | ✗ | E-08: im Editor nicht möglich |
| Speichern | ~ | ~ | ✓ | ✓ | E-02: nur ✓-Symbol, Titel „Bearbei…“ |
| Editor verlassen | ✓ | ✗ | ✗ | ✓ | E-01 |

### K5 Rezept bearbeiten (P2)
| Schritt | A | B | C | D | Befund |
|---|---|---|---|---|---|
| ⋮ → „Bearbeiten“ | ✓ | ✓ | ✓ | ✓ | zwei Taps, laut Konzept so gewollt |
| „+ Zutat“, Name eintippen | ✓ | ✓ | ~ | ✓ | E-05: Name ist Tippen-zum-Bearbeiten, Menge und Einheit sind feste Felder |
| Abschnitt umsortieren (▲▼ oder Ziehen) | ✓ | ✓ | ✓ | ✓ | – |
| Bild ändern („Durchsuchen“) | ✓ | ~ | ✓ | ✓ | E-11: „oder hierher ziehen“ auf dem iPhone |
| Abschnitt löschen | ✓ | ✓ | ✗ | ✓ | E-06: löscht alle Zutaten und Schritte ohne Rückfrage |
| Speichern | ~ | ~ | ✓ | ✓ | E-02; Rückmeldung „Gespeichert.“ ist gut |
| Entwurf verwerfen | ~ | ✗ | ✓ | ✓ | E-02: ⊗ „Änderungen verwerfen“ neben 🗑 „Entwurf löschen“ neben ✕ „Abbrechen“ |
| Entwurf auf Home wiederaufnehmen | ✓ | ✓ | ✓ | ✓ | Stärke: Chip „1 Entwurf“, Toast „Entwurf wiederhergestellt.“ |

### K6 Rezept neu von Hand anlegen (P2)
| Schritt | A | B | C | D | Befund |
|---|---|---|---|---|---|
| FAB ＋ → „Neues Rezept“ | ✓ | ✓ | ~ | ✓ | H-03: Das Rezept existiert sofort auf dem Server |
| Es sich anders überlegen, ✕ | ✓ | ✗ | ✗ | ✓ | H-03: Karte „Neues Rezept“ bleibt ([Beleg](ux-audit/probe-neues-rezept-verworfen.png)) |
| versehentlich „Beispiel“ im FAB | – | ~ | ✓ | – | H-04: Demo-Rezept für die ganze Familie |

### K7 Teilen und widerrufen (P2)
| Schritt | A | B | C | D | Befund |
|---|---|---|---|---|---|
| ⋮ → „Teilen“ | ✓ | ✓ | ✓ | ✓ | – |
| Sidebar „Share-Links“: Laufzeit, „Erstellen“ | ✓ | ~ | ~ | ✓ | R-12: kopiert nur, kein Teilen-Sheet; die Zwischenablage nach `await` ist am Gerät zu prüfen |
| Link per Messenger schicken | ✗ | – | – | ~ | R-12: Wechsel in die andere App, dort einfügen |
| Link widerrufen | ✓ | ✓ | ✗ | ✓ | R-12: sofort, ohne Rückfrage, 32 px neben „Kopieren“ |

### K8 Darstellung ändern, abmelden (P1)
| Schritt | A | B | C | D | Befund |
|---|---|---|---|---|---|
| Profil-Tab → Hell, Dunkel oder System | ✓ | ✓ | ✓ | ✓ | wirkt sofort |
| Schalter „Experten-Modus“ umlegen, Tab wechseln | ✓ | ~ | ✗ | ✗ | P-01: ohne „Speichern“ still verworfen (Probe P6) |
| „Abmelden“ | ✓ | ✓ | ✓ | ✓ | mit Rückfrage |

### K9 Mitglied freischalten, KI testen (P3)
| Schritt | A | B | C | D | Befund |
|---|---|---|---|---|---|
| Erfahren, dass jemand wartet | ✗ | – | – | ✗ | P-05: Hinweis nur innerhalb der Verwaltung |
| Profil → „Benutzerverwaltung & Share-Links“ | ✓ | ~ | ✓ | ✓ | P-04 |
| Zeile „Lena Neumann“ finden, Rolle wählen | ~ | ~ | ~ | ✓ | V-02: Tabelle abgeschnitten, Rollen „Pending / Readonly / Editor“ |
| Rückmeldung | – | – | ~ | ✓ | V-02: „Rolle von Lena Neumann → editor“ |
| dasselbe im Dunkelmodus | ~ | – | ✗ | ~ | V-03: wartende Zeile praktisch unlesbar |
| „Verbindung testen“ | ✓ | ✓ | ~ | ✓ | X-06: „text: gpt-5-mini verfügbar“ |

---

## 5. Befunde je Ansicht

Sortiert nach Ansicht, dann nach Schweregrad. Code-Stellen beziehen sich auf die Basis `c9c7858`. Screenshots liegen unter [ux-audit/](ux-audit/).

### 5.1 Übergreifend (X)

**X-01 · Stufe 2 · S: Kontraste der Tokens unter 4,5:1**
- **Heuristik:** WCAG 1.4.3 und 1.4.11
- **Beschreibung:** Nachgerechnet und von axe bestätigt:

  | Element | Kontrast |
  |---|---|
  | `--color-text-muted` #7a716a auf `--color-surface` #f5f1eb: Zutatenmengen, Abschnittslabels, Theme-Knöpfe, Placeholder | 4,24 |
  | Primärgrün #6b7f3b als Text auf der Fläche: Abschnittstitel der Zutaten | 3,95 |
  | inaktive Tabs der Bottom Nav (`--color-chrome-muted`, 12 px), hell | 3,97 |
  | dasselbe, dunkel | 3,78 |
  | dunkel: Weiß auf #8fa85c (FAB ＋, aktiver Theme-Knopf, Portionen-Knöpfe) | 2,65 |
  | Schwierigkeits-Badge `bg-warning` mit weißer Schrift | 1,63 |

  Ausgerechnet die **Mengen** in der Zutatenliste, die wichtigste Information beim Kochen, stehen in der schwächsten Farbe.
- **Beleg:** `App.vue:162`, `App.vue:143`, `App.vue:156`, `App.vue:241`; `IngredientsSection.vue:128-131`; [iphone-hell-recipe-lasagne-zutaten.png](ux-audit/iphone-hell-recipe-lasagne-zutaten.png); [Abschnitt 6](#6-barrierefreiheit-wcag-22-aa)
- **Vorschlag:**
  - `--color-text-muted` hell auf #6e655e setzen (5,06:1).
  - Für Text in Grün ein eigenes Token `--color-primary-text` #5a6c32 (5,15:1).
  - `--color-chrome-muted` mit Alpha 0,7 statt 0,5 bzw. 0,45 (6,1 hell, 7,5 dunkel).
  - Im Dunkelmodus dunkle Schrift #1e1b18 auf Grün (6,47:1).
  - Mengen in `--color-text` mit Gewicht 600.
  - Das Badge mit dunkler Schrift.

**X-02 · Stufe 2 · S: Bootstrap-Farben statt Design-Tokens**
- **Heuristik:** H4 Konsistenz
- **Beschreibung:** Sprint 9 gilt als abgeschlossen („Bootstrap-Overrides via Tokens“). Trotzdem zeigen viele Stellen Bootstrap-Blau #0d6efd:
  - `variant="primary"` / `btn-primary`: Portionen-Knöpfe im Zutaten-Sheet und am Tablet, die Filter „Nur aktuell / Alle“, „Erstellen“ im Teilen-Dialog, alle Knöpfe im KI-Dialog, „Speichern“ im Profil (deaktiviert hellblau), „+ Zutat / + Schritt“ im Editor
  - die Tabs im KI-Dialog

  Dazu kommen Grün für „Rezept erkennen“ und Grau `btn-secondary` in der Verwaltung. Ursache: Bootstraps `.btn-primary` liest `--bs-btn-bg`, das bereits beim Kompilieren feststeht, nicht `--bs-primary`. Die Overrides in `App.vue:298-312` greifen deshalb nur für Links und Utilities. Auf einem Bildschirm stehen so oliv-grüne Knöpfe in der eingeklappten Leiste neben blauen im aufgeklappten Sheet.
- **Beleg:** [iphone-hell-recipe-lasagne-zutaten.png](ux-audit/iphone-hell-recipe-lasagne-zutaten.png), [tablet-hell-recipe-lasagne-bechamel.png](ux-audit/tablet-hell-recipe-lasagne-bechamel.png), [iphone-hell-ai-import-ergebnis.png](ux-audit/iphone-hell-ai-import-ergebnis.png), [iphone-hell-profil.png](ux-audit/iphone-hell-profil.png)
- **Vorschlag:** `.btn-primary`, `.btn-outline-primary` und `.nav-link` einmal zentral auf die Tokens mappen (`--bs-btn-bg`, `--bs-btn-border-color`, `--bs-btn-hover-bg` …), Erfolg-Grün und Grau nur semantisch einsetzen. Hinweis an W.15: bootstrap-vue-next 1.x kann die Klassen ändern, deshalb nach W.15 umsetzen oder dort mitprüfen.

**X-03 · Stufe 2 · M: Bedienelemente systematisch unter 44 pt**
- **Heuristik:** HIG „Hit Targets“ (≥ 44 × 44 pt), WCAG 2.5.8 (≥ 24 px)
- **Beschreibung:** Gemessen in der iPhone-Ansicht, sichtbare Ziele unter 44 px:

  | Zustand | Anteil unter 44 px |
  |---|---|
  | Editor | 44 von 50 (Knöpfe 32 × 31, Felder 31 hoch) |
  | Rezeptansicht | 3 von 8 (Portionen ± 30 × 30, Eingabe 40 × 28) |
  | Zutaten-Sheet „Alle“ | 8 von 13, darunter 3 Abschnitts-Chips mit nur 10 px Höhe |
  | Verwaltung, Rezepte | 23 von 31 |
  | Teilen-Dialog | 8 von 13 (Kopieren und Widerrufen 32 × 31, Schließen 24 × 24) |
  | Karten | Stern 24 × 36 |

  Unter 24 px liegen im Profil die Schalter (32 × 16) und im Editor die Vorlage-Links (2 × 120 px, siehe E-11). Laut Plan sind „Min. 44 × 44 px Buttons“ umgesetzt (Sprint 3, Sprint 9); die Wirklichkeit weicht ab, siehe [Abschnitt 7](#7-abweichungen-von-plan-und-ux-konzept).
- **Beleg:** Messdaten `targets.json` im Scratchpad; die konkreten Stellen stehen in R-07, R-11, R-12, E-03, V-02, P-01.
- **Vorschlag:** Mindestmaß als Token durchsetzen (`--action-btn-size` gibt es schon), `size="sm"` auf Touch-Ansichten verbieten oder per CSS auf 44 px Höhe heben. Umsetzung je Ansicht in den Bündeln aus [Abschnitt 9](#9-vorschlag-zur-bündelung).

**X-04 · Stufe 2 · M: Overlays ohne Dialog-Semantik**
- **Heuristik:** H3 Nutzerkontrolle, WCAG 2.4.3 und 4.1.2
- **Beschreibung:** Betroffen sind das Info-Overlay, das Zutaten-Sheet, die Teilen-Sidebar und das Kopfmenü:
  - Sie haben weder `role="dialog"` bzw. `role="menu"` noch `aria-expanded`.
  - Beim Öffnen bleibt der Fokus auf `body` (Probe P7).
  - Escape schließt Info-Overlay und Zutaten-Sheet nicht (P7, P14).
  - Das Zutaten-Sheet hat keinen Hintergrund zum Wegtippen und lässt sich nicht nach unten wischen (P14), obwohl der Plan einen Backdrop nennt.

  Auf iOS erwarten Nutzer bei Sheets Wischen nach unten bzw. Tippen auf die abgedunkelte Fläche.
- **Beleg:** `MobileIngredientsBar.vue:1-90`, `MetadataOverlay.vue`, `Recipe.vue:173-207`, `ShareManager.vue`
- **Vorschlag:** Eine gemeinsame Sheet- bzw. Dialog-Komponente mit Fokusfalle, Escape, Backdrop und Wischen nach unten. Alternativ `BModal` / `BOffcanvas` aus bootstrap-vue-next, die das mitbringen. Das Kopfmenü als `BDropdown`.

**X-05 · Stufe 2 · S: Pinch-Zoom gesperrt (am Gerät prüfen)**
- **Heuristik:** WCAG 1.4.4, axe `meta-viewport`
- **Beschreibung:** `index.html:9` setzt `maximum-scale=1, user-scalable=no`, laut `.claude/rules/frontend.md` bewusst für den Koch-Modus. Damit fehlt Menschen mit schwacher Sicht jede Vergrößerung. Unbestätigt: Laut Webquellen ignoriert iOS-Safari `user-scalable=no` seit iOS 10 teilweise; wie es sich im Standalone-Modus verhält, ist offen. Zugleich verhindert `maximum-scale=1` vermutlich den Auto-Zoom bei Eingabefeldern unter 16 px, siehe X-07.
- **Beleg:** `index.html:9`; axe auf allen Ansichten
- **Vorschlag:** Den Grund der Sperre klären: Doppeltipp-Zoom beim Antippen von Schritten? Dafür reicht `touch-action: manipulation`. Dann den Zoom erlauben oder als Ersatz eine Textgrößen-Einstellung im Profil anbieten, z. B. Schritte 18, 21 oder 24 px. Das hilft in der Küche auf Armlänge ohnehin. Entscheidung nötig, siehe [Abschnitt 9](#9-vorschlag-zur-bündelung).

**X-06 · Stufe 2 · S: Begriffe gemischt Englisch und Deutsch, uneinheitlich**
- **Heuristik:** H2 Übereinstimmung mit der realen Welt, H4 Konsistenz
- **Beschreibung:**
  - „AI-Import“ / „AI-Rezept-Import“, obwohl im Deutschen „KI“ üblich ist
  - „Share-Links“ neben dem Menüeintrag „Teilen“
  - Rollen in der Verwaltung „Pending / Readonly / Editor / Admin“ (mit Emoji), im Profil „Bearbeiter / Nur Lesen / Administrator“; `pending` erscheint dort auch als „Nur Lesen“
  - „Units“ als Ersatz für eine fehlende Portionseinheit
  - Footer „Cancel / OK“ (A-01)
  - Testergebnis „text: … / image: …“
  - „Experten-Modus“ mit „YAML“
  - „Metadaten“ als Überschrift im Editor
- **Beleg:** `HomeView.vue:186`, `ShareManager.vue`, `AdminUsers.vue:75-78`, `ProfileView.vue:62-67`, `RecipeDisplay.vue:37`, `AdminSettings.vue`
- **Vorschlag:** Ein kleines Glossar festlegen: KI-Import, Teilen bzw. Link, Rollen „Wartet auf Freigabe / Lesen / Bearbeiten / Verwalten“, Portionen, Informationen. Danach alle Texte angleichen.

**X-07 · Stufe 1 · S: Eingaben mit 14 px Schrift (am Gerät prüfen)**
- **Heuristik:** HIG Typografie; iOS-Fokus-Zoom
- **Beschreibung:** Im Editor haben 13–17 Felder je Zustand weniger als 16 px (`form-control-sm`, 14 px). Safari zoomt bei solchen Feldern beim Fokus hinein. `maximum-scale=1` unterdrückt das vermutlich, unbestätigt. Fällt X-05 weg, kommt der Zoom zurück.
- **Beleg:** Messdaten der Touch-Ziele; [iphone-hell-edit-lasagne-abschnitt.png](ux-audit/iphone-hell-edit-lasagne-abschnitt.png)
- **Vorschlag:** Eingaben auf Touch-Geräten mit 16 px (`--font-size-md`), zusammen mit X-03.

**X-08 · Stufe 1 · S: Native `confirm()`-Dialoge**
- **Heuristik:** H4, HIG Alerts
- **Beschreibung:** Löschen, Abmelden, „Alle Änderungen verwerfen?“ und das Widerrufen in der Verwaltung nutzen `window.confirm`. In der iOS-PWA zeigt der Dialog die Domain im Titel, die Knöpfe sind fest („Abbrechen / OK“), eine Gefahr-Hervorhebung fehlt.
- **Beleg:** `Recipe.vue:105`, `RecipeCard.vue:120`, `Edit.vue` (`revertRecipe`), `ProfileView.vue` (`handleLogout`)
- **Vorschlag:** Eine eigene Bestätigungskomponente mit klaren Verben („Löschen“ in Rot, „Behalten“), für Löschen besser ein Rückgängig-Toast. Zusammen mit X-04.

**X-09 · Stufe 1 · S: Seitenstruktur für Screenreader**
- **Heuristik:** WCAG 1.3.1 und 2.4.6
- **Beschreibung:**
  - kein `<main>` (axe `landmark-one-main`, `region`)
  - kein `<h1>`
  - Überschriftenebenen springen (`h6` direkt unter `h2`, Zutaten `h5` unter `h3`)
  - in der Verwaltung ein leerer Tabellenkopf
- **Beleg:** axe auf allen Ansichten
- **Vorschlag:** `App.vue` umschließt die Router-Ansicht mit `<main>`; je Ansicht genau ein `h1`, in der Rezeptansicht ist das der Rezeptname; Abschnittsüberschriften danach ausrichten.

**X-10 · Stufe 1 · XS: `theme_color` passt nicht zum Design (am Gerät prüfen)**
- **Heuristik:** H4
- **Beschreibung:** Das Manifest setzt `theme_color: "#4DBA87"`, das Vue-Grün. Das Design nutzt Oliv #6b7f3b bzw. Chrome #3b3531. Je nach iOS-Version färbt das Splash bzw. Statusleiste.
- **Beleg:** `frontend/vite.config.*`, Zeile 86
- **Vorschlag:** `theme_color` und `background_color` auf die Chrome-Farbe setzen; `apple-mobile-web-app-status-bar-style` prüfen.

### 5.2 Home, soweit eine Kernaufgabe sie berührt (H)

**H-01 · Stufe 3 · XS: Wer nur lesen darf, kann keine Favoriten setzen**
- **Aufgabe:** K3
- **Beschreibung:**
  - Der Stern auf der Karte und der Stern in der Kopfzeile sind an `read_only` gekoppelt. Für die Rolle `readonly` ist `read_only` standardmäßig `true` (`backend/app/routes/me.py:14-17`).
  - Das Backend erlaubt Favoriten ausdrücklich ab `readonly` (`favorites.py`: `require_readonly`).
  - Der Favoriten-Tab rät im Leerzustand „Tippe auf den Stern …“. P1 sitzt damit in einer Sackgasse, obwohl Usability-Ziel 5 lautet: „Favoriten schnell und intuitiv erreichen“.
- **Beleg:** `RecipeCard.vue` (Stern: `v-if="!read_only && !compact"`), `Recipe.vue:158`; [iphone-hell-home-readonly.png](ux-audit/iphone-hell-home-readonly.png), [iphone-hell-recipe-lasagne-readonly.png](ux-audit/iphone-hell-recipe-lasagne-readonly.png), [iphone-hell-favorites-readonly-leer.png](ux-audit/iphone-hell-favorites-readonly-leer.png)
- **Vorschlag:** Den Stern an die Rolle (≥ `readonly`) koppeln, nicht an `read_only`. Das ⋮-Menü bleibt für `read_only` verborgen.

**H-02 · Stufe 3 · S: Löschen ohne Recht: Erfolg vorgetäuscht, Rezept kommt zurück**
- **Aufgabe/Heuristik:** K5; H1 Status, H5 Fehlervermeidung, H9 Fehlermeldungen
- **Beschreibung:**
  - Editoren sehen „Löschen“ im Kartenmenü und im Kopfmenü der Rezeptansicht, obwohl das Backend nur Admins löschen lässt.
  - Nach der Rückfrage entfernt der Store die Karte sofort. Der Server antwortet mit 403, der Store schreibt das nur in die Konsole.
  - Es erscheint keine Meldung. Nach dem Neuladen ist das Rezept wieder da (Probe P4).
  - Dasselbe gilt offline und bei 5xx: Die Karte verschwindet still, das Rezept kehrt später zurück.
- **Beleg:** `recipeStore.ts:247-266`, `Recipe.vue:192-205`, `RecipeCard.vue:225-235`; Probe P4: `DELETE /api/v1/recipes/r-curry` → 403, Meldungen `[]`, nach dem Neuladen 2 Karten
- **Vorschlag:** „Löschen“ nur für `admin` anzeigen; erst nach erfolgreicher Antwort aus der Liste entfernen; Fehler als Toast; offline Löschen sperren mit Hinweis. Hinweis an W.34 (Kennzeichnung lokaler Rezepte): Löschen eines nur lokalen Rezepts gesondert behandeln.

**H-03 · Stufe 3 · S: „Neues Rezept“ legt sofort an, Abbrechen hinterlässt eine Karteileiche (Hinweis an 7.1)**
- **Aufgabe/Heuristik:** K6; H3 Nutzerkontrolle, H5
- **Beschreibung:** Das FAB legt das Rezept „Neues Rezept“ sofort per `POST /recipes` auf dem Server an und öffnet erst danach den Editor. ✕ verlässt den Editor, die leere Karte bleibt für die ganze Familie sichtbar (Probe P11). Löschen dürfen nur Admins; ein Editor kann das selbst nicht mehr aufräumen (H-02).
- **Beleg:** `HomeView.vue` (`newRecipe`); [probe-neues-rezept-verworfen.png](ux-audit/probe-neues-rezept-verworfen.png)
- **Vorschlag:** Kein eigener Roadmap-Punkt; gehört zum Wizard 7.1, siehe [Abschnitt 8](#8-hinweise-an-bestehende-roadmap-punkte). Kurzfristig: Das Rezept erst beim ersten Speichern anlegen, bis dahin als lokaler Entwurf führen.

**H-04 · Stufe 2 · XS: „Beispiel“ im FAB legt ein Demo-Rezept für alle an**
- **Heuristik:** H8 minimalistisches Design, H5
- **Beschreibung:** Das FAB-Menü bietet neben „Neues Rezept“ und „AI-Import“ den Eintrag „Beispiel“. Ein Tipp legt das Pfannkuchen-Beispielrezept dauerhaft im Familienkochbuch an, ohne Rückgängig. Dasselbe gilt für „Beispielrezept“ in der Verwaltung.
- **Beleg:** [iphone-hell-home-fab.png](ux-audit/iphone-hell-home-fab.png); `HomeView.vue` (`loadSample`), `AdminRecipes.vue`
- **Vorschlag:** Nur im Experten-Modus oder ganz entfernen.

**H-05 · Stufe 2 · S: Kartenmenü überlappt die Nachbarkarte, FAB verdeckt Kartenaktionen**
- **Heuristik:** H8; HIG Layout
- **Beschreibung:** Das Kartenmenü (Tags, Bearbeiten, Löschen) ragt in die Karte darunter. Deren ⋮-Knopf liegt **über** „Löschen“ (z-index), ein Tipp dort trifft womöglich die falsche Karte. Das FAB ＋ verdeckt rechts unten den ⋮-Knopf der Karte darunter.
- **Beleg:** [iphone-hell-home-card-menu.png](ux-audit/iphone-hell-home-card-menu.png), [iphone-hell-home.png](ux-audit/iphone-hell-home.png)
- **Vorschlag:** Das Kartenmenü als Action-Sheet bzw. Dropdown über allen Karten (z-index, Teleport); unter dem Raster Platz für das FAB lassen.

**H-06 · Stufe 2 · XS: Karten nicht barrierefrei**
- **Heuristik:** WCAG 1.1.1, 2.1.1, 4.1.2
- **Beschreibung:**
  - Das Kartenbild hat `alt="Card image cap"`, einen Platzhalter aus der Bootstrap-Doku.
  - Der Stern ist ein `div role="button"` ohne `tabindex` innerhalb des Links: weder mit der Tastatur erreichbar noch erlaubt verschachtelt.
  - Tag-Chips sind `span` mit `@click`.
- **Beleg:** `RecipeCard.vue:8-30`, Tag-Editor in `RecipeCard.vue`
- **Vorschlag:** `alt=""`, weil der Titel daneben steht; Stern und ⋮ als `button` außerhalb des Links; Chips als `button`.

**H-07 · Stufe 1 · XS: Platzhalter ohne Bild im Dunkelmodus grell**
- **Heuristik:** H8
- **Beschreibung:** Rezepte ohne Bild zeigen einen hellgrauen Platzhalter mit Bildsymbol, im Dunkelmodus sehr hell.
- **Beleg:** [iphone-dunkel-home.png](ux-audit/iphone-dunkel-home.png)
- **Vorschlag:** Platzhalter in `--color-surface-raised` mit gedämpftem Symbol oder dem Anfangsbuchstaben.

### 5.3 Rezeptansicht / Koch-Modus (R)

**R-01 · Stufe 3 · XS: „Nur aktuell“ zeigt alle Abschnitte, der aktuelle steht zuletzt**
- **Aufgabe:** K1, K2 (Kernfunktion aus Sprint 1)
- **Beschreibung:**
  - Mit Filter erhält `IngredientsSection` nur den aktuellen Abschnitt.
  - Alle Zutaten anderer Abschnitte gelten dort als „verwaist“, weil ihr Abschnitt nicht in der übergebenen Liste steht, und werden **vor** dem aktuellen Abschnitt angezeigt.
  - Ergebnis: Bei „Béchamel“ im Blick zeigt das Sheet Ragù, Schichten und Backen, Béchamel (Probe P2).
  - Mobil ist der Filter voreingestellt (`showOnlyCurrentSection = true`). Jede Köchin sieht also zuerst die falschen Zutaten.
- **Beleg:** `IngredientsSection.vue:13-36` mit `RecipeDisplay.vue:72-79`; [iphone-hell-recipe-lasagne-zutaten.png](ux-audit/iphone-hell-recipe-lasagne-zutaten.png). Die Abschnitts-Erkennung selbst ist richtig: Am Tablet ist „Schichten und Backen“ korrekt aktiv (P2b).
- **Vorschlag:** Die Zutaten filtern, nicht die Abschnittsliste, oder die volle Abschnittsliste mitgeben und die Verwaist-Logik nur auf das Original anwenden. Unit-Test für den Fall „Filter aktiv, mehrere Abschnitte“.

**R-02 · Stufe 3 · S: Bildschirm bleibt beim Kochen nicht an (am Gerät prüfen)**
- **Aufgabe/Heuristik:** K1; Küchentauglichkeit, Usability-Ziel 7
- **Beschreibung:** Die App nutzt die Screen Wake Lock API nicht (kein `wakeLock` im Code). iOS sperrt nach der eingestellten Zeit, meist 30 s–2 min; mit Teig an den Händen heißt das entsperren oder Face ID. Laut Quellen unterstützt Safari die API ab 16.4, im Standalone-Modus von Home-Screen-Apps erst ab iOS 18.4 ([web.dev](https://web.dev/blog/screen-wake-lock-supported-in-all-browsers), [MDN-Daten laut Progressier](https://progressier.com/pwa-capabilities/screen-wake-lock), [WebKit-Bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545)). Selbst geprüft auf iOS: nein.
- **Beleg:** `grep wakeLock` leer; Probe P14: API in Chromium vorhanden
- **Vorschlag:** Im Koch-Modus Wake Lock anfordern und nach `visibilitychange` erneut anfordern. Schalter im ⋮-Menü („Bildschirm anlassen“), Voreinstellung an. Ältere iOS-Versionen ohne Ersatz, nur Hinweis.

**R-03 · Stufe 3 · S: Notizen, Verarbeitung und HACCP werden nie angezeigt**
- **Aufgabe:** K1, K2, K4
- **Beschreibung:**
  - Die Rezeptansicht rendert nur `step.step` sowie Menge, Einheit und Name einer Zutat.
  - Nicht angezeigt werden Schritt-Notizen („Wird es zu dick, etwas Wasser angießen.“), HACCP-Hinweise („Kerntemperatur mindestens 75 °C“), Zutat-Notizen („frisch gerieben“) und `processing` („fein gewürfelt“).
  - Schritt- und Zutat-Notizen lassen sich im Editor pflegen, der KI-Import liefert sie. Die Arbeit geht beim Kochen verloren, und HACCP-Hinweise sind sicherheitsrelevant.
- **Beleg:** `StepSection.vue` (Template), `IngredientsSection.vue` (Template); Notiz sichtbar im Editor ([tablet-dunkel-edit-lasagne-abschnitt.png](ux-audit/tablet-dunkel-edit-lasagne-abschnitt.png)), nicht in der Ansicht ([tablet-hell-recipe-lasagne.png](ux-audit/tablet-hell-recipe-lasagne.png))
- **Vorschlag:** Notizen kleiner unter dem Schritt bzw. der Zutat; `processing` hinter dem Namen („Zwiebel, fein gewürfelt“); HACCP als gekennzeichneter Hinweis. `processing` im Editor bearbeitbar machen (heute unsichtbar und nicht änderbar). Hinweis an 6.1 (Koch-Notizen): Das ist eine Voraussetzung, aber nicht dasselbe. 6.1 betrifft Notizen beim Kochen, hier geht es um vorhandene Rezeptdaten.

**R-04 · Stufe 2 · S: Wichtige Informationen versteckt hinter ⓘ, der Knopf ist nicht bedienbar**
- **Aufgabe/Heuristik:** K1; H6 Wiedererkennen statt Erinnern, WCAG 2.1.1 und 4.1.2
- **Beschreibung:** Gesamtzeit, Schwierigkeit und Notizen („Ragù am Vortag kochen“) stehen nur im Info-Overlay. Gerade diese Angaben braucht man **vor** dem Start. Der ⓘ-Knopf ist ein `div` mit `@click`, ohne Rolle und Tab-Stopp (P7). Für die Tastatur und VoiceOver existiert er nicht. Der Plan nennt dagegen „`button` statt `div` für klickbare Elemente“.
- **Beleg:** `RecipeDisplay.vue:257-262`, `RecipeDisplay.vue:327-332`; [iphone-hell-recipe-lasagne-info.png](ux-audit/iphone-hell-recipe-lasagne-info.png)
- **Vorschlag:** Unter dem Titel eine Infozeile mit ⏱ Gesamtzeit, Portionen und Schwierigkeit; Notizen als aufklappbarer Block vor „Zubereitung“; ⓘ als `button` mit `aria-label`.

**R-05 · Stufe 2 · S: Schritt antippen markiert nichts**
- **Aufgabe:** K1 (Orientierung beim Kochen)
- **Beschreibung:** `selectStep` arbeitet mit `ev.target`. Beim Tipp auf den Text ist das der `span`, nicht das `li`; markiert wird nur der Span ohne sichtbare Wirkung. Das Zurücksetzen und die Hervorhebung der Zutaten zielen auf `#steps`, `#ingredients` und `#box-ing-…`, die es nicht gibt (P1: `li` 0, `ingHighlighted` 0). Die Funktion ist toter Code; wer den Faden verliert, findet den Schritt nicht wieder.
- **Beleg:** `RecipeDisplay.vue:82-106`, `StepSection.vue` (`@click`)
- **Vorschlag:** Den aktiven Schritt per Zustand statt DOM-Klassen führen; deutlich markieren (Rahmen, Hintergrund); den passenden Zutatenabschnitt mitziehen. Optional „Weiter“ als große Zone unten.

**R-06 · Stufe 2 · S: Tablet: Zutaten des aktiven Abschnitts außerhalb des sichtbaren Bereichs**
- **Aufgabe:** K2
- **Beschreibung:** Die Zutatenspalte markiert den aktiven Abschnitt korrekt, scrollt ihn aber nicht in den sichtbaren Bereich. Bei „Schichten und Backen“ liegt der Block bei y = 1042 pt, der Bildschirm ist 820 pt hoch (P2b). Man muss in der Spalte selbst scrollen. Zusätzlich ist am Tablet „Alle Zutaten“ voreingestellt.
- **Beleg:** [probe-tablet-sync.png](ux-audit/probe-tablet-sync.png), `recipe-layout.css` (`.sticky-wrapper`)
- **Vorschlag:** Den aktiven Block in der Sticky-Spalte mit `scrollIntoView({block: "nearest"})` nachführen. Nach R-01 „Nur aktuell“ auch am Tablet anbieten.

**R-07 · Stufe 2 · S: Portionen-Steuerung mobil zu klein und im Knopf verschachtelt**
- **Aufgabe/Heuristik:** K1; HIG Hit Targets, WCAG 4.1.2 (axe `nested-interactive`, `label-content-name-mismatch`, `button-name`, `label`)
- **Beschreibung:**
  - ± misst 30 × 30 px, das Eingabefeld 40 × 28.
  - Beides sitzt **innerhalb** des Knopfs „Zutaten öffnen“. Ein Fehltipp um wenige Pixel öffnet das Sheet.
  - Die ±-Knöpfe haben keinen Namen, das Zahlenfeld kein Label.
  - Die Rückmeldung bleibt unsichtbar, solange das Sheet zu ist, weil die Mengen nur dort stehen.
- **Beleg:** `MobileIngredientsBar.vue:4-20`, `PortionControl.vue:63-85`, CSS-Zeilen 208–227; [iphone-hell-recipe-lasagne.png](ux-audit/iphone-hell-recipe-lasagne.png)
- **Vorschlag:** In der Leiste nur „Zutaten · 6 Portionen“ als ein Ziel, die Portionen im Sheet mit 44-px-Knöpfen. Alternativ die Leiste in zwei getrennte Ziele teilen. `aria-label` „Portion weniger / mehr“, Label für das Feld.

**R-08 · Stufe 2 · XS (Anzeige) / M (Datenformat): Zeiten doppelt: „45 Minuten Min“**
- **Heuristik:** H2, H4
- **Beschreibung:** Das Overlay hängt an jede Zeit „ Min“ an, die Zeiten sind aber Freitext. Der Editor schlägt selbst „15 Min.“ bzw. „1h 30 Min.“ vor, der KI-Import liefert „45 Minuten“. Ergebnis: „Vorbereitung: 45 Minuten Min“, „Gesamt: 3 Stunden 30 Minuten Min“.
- **Beleg:** `MetadataOverlay.vue` (Zeiten-Block, zweimal); [iphone-hell-recipe-lasagne-info.png](ux-audit/iphone-hell-recipe-lasagne-info.png)
- **Vorschlag:** Kurzfristig kein Suffix (XS). Mittelfristig Zeiten als Minuten (Zahl) speichern; dann sind Anzeige, Filter („unter 30 min“) und die Gesamtzeit auf Karten möglich. Das ist eine Daten- und Schemafrage, gehört deshalb nicht in die Mitnahme.

**R-09 · Stufe 2 · XS–S: Unbekanntes Rezept: endloser Spinner**
- **Heuristik:** H1, H9
- **Beschreibung:** `/recipe/<unbekannte ID>`, z. B. ein gelöschtes Rezept aus „Zuletzt“, ein alter Link oder eine Sitzungswiederherstellung, zeigt dauerhaft den Spinner. Es gibt keine Meldung und keinen Weg außer ←.
- **Beleg:** `useRecipeHelper.ts:58-82`, `Recipe.vue:220-225`; [iphone-hell-recipe-unbekannt.png](ux-audit/iphone-hell-recipe-unbekannt.png)
- **Vorschlag:** Nach geladener Liste ohne Treffer: „Rezept nicht gefunden“ mit „Zur Übersicht“; den Eintrag aus „Zuletzt“ entfernen.

**R-10 · Stufe 2 · XS: Ohne Portionsangabe: „Units“, ± ohne Wirkung**
- **Heuristik:** H1, H2
- **Beschreibung:** Fehlt `yields`, zeigt die Leiste „Units“. ± ändert nichts, weil `setYieldsValue` abbricht, und meldet auch nichts (P9).
- **Beleg:** `RecipeDisplay.vue:35-50`; [probe-ohne-portionen.png](ux-audit/probe-ohne-portionen.png)
- **Vorschlag:** Ohne `yields` die Steuerung ausblenden oder „1 Portion“ als Basis annehmen und skalieren; deutscher Text.

**R-11 · Stufe 2 · S: Zutaten-Sheet: Chips abgeschnitten, kein Wegtippen**
- **Aufgabe:** K1
- **Beschreibung:**
  - Bei „Alle“ sind die Abschnitts-Chips unten auf 10 px Höhe abgeschnitten und nicht lesbar.
  - Das Sheet schließt nur über ✕ (28 × 38 px). Tippen auf den Bereich darüber, Escape und Wischen nach unten schließen es nicht (P14).
  - „Nur aktuell / Alle“ sind 31 px hohe Knöpfe ohne `aria-pressed`.
- **Beleg:** [iphone-hell-recipe-lasagne-zutaten-alle.png](ux-audit/iphone-hell-recipe-lasagne-zutaten-alle.png), `MobileIngredientsBar.vue` (CSS `.bottom-bar-expanded`, `.section-chips`)
- **Vorschlag:** Chips aus dem Flex-Bereich mit fester Höhe herausnehmen bzw. `flex-shrink: 0`; Sheet-Verhalten nach X-04; Umschalter als Segmented Control mit 44 px.

**R-12 · Stufe 2 · S–M: Teilen: kein Teilen-Sheet, Widerrufen ohne Rückfrage**
- **Aufgabe/Heuristik:** K7; HIG Sharing, H5
- **Beschreibung:**
  - „Erstellen“ kopiert den Link in die Zwischenablage. Es gibt kein natives Teilen (Web Share API → iOS-Teilen-Sheet mit Nachrichten, WhatsApp, Mail).
  - Die Zwischenablage wird nach einem `await` auf die API geschrieben. iOS-Safari verlangt dafür eine unmittelbare Nutzergeste; ob die Kopie gelingt, ist **am Gerät zu prüfen**.
  - „Widerrufen“ wirkt sofort und endgültig, ohne Rückfrage, 32 × 31 px direkt unter „Kopieren“. In der Verwaltung fragt dieselbe Aktion nach.
  - Der Schließen-Knopf hat keinen Namen (axe), die Daten stehen in 11,5 px.
- **Beleg:** `ShareManager.vue` (`createLink`, `copyLink`, `revokeLink`, Template); [iphone-hell-recipe-lasagne-teilen.png](ux-audit/iphone-hell-recipe-lasagne-teilen.png)
- **Vorschlag:** Nach „Erstellen“ `navigator.share({url, title})` anbieten, falls vorhanden, sonst kopieren; Widerrufen mit Rückfrage oder Rückgängig-Toast; Titel „Teilen“; Ziele 44 px.

**R-13 · Stufe 1 · XS: Schrittnummern beginnen je Abschnitt neu**
- **Heuristik:** H4
- **Beschreibung:** `list-group-numbered` zählt je `ul`: Ragù 1–4, Béchamel 1–3, Schichten und Backen 1–6. Der Code berechnet eine durchgehende Nummer (`data-step-number`), nutzt sie aber nicht. Hinweise wie „siehe Schritt 3“ werden mehrdeutig. Je Abschnitt neu zu zählen ist vertretbar, daher Stufe 1.
- **Beleg:** `StepSection.vue` (`getStepNumber`); [iphone-hell-recipe-lasagne-bechamel.png](ux-audit/iphone-hell-recipe-lasagne-bechamel.png)
- **Vorschlag:** Eine Entscheidung treffen (durchgehend oder je Abschnitt) und in Ansicht, Editor und PDF (10.1) gleich umsetzen.

**R-14 · Stufe 1 · XS: Rezept ohne Bild: großer leerer Platzhalter**
- **Heuristik:** H8
- **Beschreibung:** Ohne Bild belegt ein grauer Kasten mit Bildsymbol etwa ein Viertel des Bildschirms vor dem ersten Schritt.
- **Beleg:** [iphone-hell-recipe-linsen-ohne-bild.png](ux-audit/iphone-hell-recipe-linsen-ohne-bild.png)
- **Vorschlag:** Ohne Bild einen kompakten Titelblock ohne Bildfläche zeigen.

**R-15 · Stufe 1 · S: Kopfmenü klein, „Duplizieren“ ohne Rückmeldung vor dem Anlegen**
- **Heuristik:** HIG, H5
- **Beschreibung:** Die Menüeinträge sind 39 px hoch, das Menü ist kein `role="menu"`. „Duplizieren“ legt sofort eine Kopie auf dem Server an und springt hinein. Rückgängig gibt es nicht, und Editoren können die Kopie nicht löschen (H-02).
- **Beleg:** `Recipe.vue:173-207`, `Recipe.vue:75-97`; [iphone-hell-recipe-lasagne-menu.png](ux-audit/iphone-hell-recipe-lasagne-menu.png)
- **Vorschlag:** Menü nach X-04; Duplizieren als Entwurf öffnen, angelegt wird erst beim Speichern (wie H-03).

**R-16 · Stufe 1 · XS: Vorlage öffnet im neuen Tab (am Gerät prüfen)**
- **Aufgabe:** K1
- **Beschreibung:** Die Vorlagenbilder sind Links mit `target="_blank"`, bewusst, damit man zoomen kann. In der Standalone-PWA öffnet iOS dafür eine Safari-Ansicht; die Rückkehr zur App ist am Gerät zu prüfen.
- **Beleg:** `SourceImages.vue`; [iphone-hell-recipe-linzer-vorlage.png](ux-audit/iphone-hell-recipe-linzer-vorlage.png)
- **Vorschlag:** Nach der Geräteprüfung ggf. eine eigene Vollbild-Ansicht mit Zoom per `touch-action`, unabhängig von X-05.

### 5.4 Bearbeitung inkl. KI-Import (E, A)

**E-01 · Stufe 3 · S: ✕ „Abbrechen“ verlässt den Editor ohne Rückfrage, die Änderungen liegen unbemerkt als Entwurf**
- **Aufgabe/Heuristik:** K4, K5; H1, H3, H5
- **Beschreibung:**
  - ✕ heißt „Abbrechen“, verwirft aber nichts.
  - Ohne Rückfrage geht es zurück; die Änderungen stehen nur im localStorage-Entwurf (Probe P5: kein `PUT`, Entwurf vorhanden).
  - Die Rezeptansicht zeigt den alten Stand. Nur der Chip „1 Entwurf“ auf Home verrät, dass etwas offen ist.
  - P2 glaubt entweder, gespeichert zu haben, oder, alles verworfen zu haben. Beides stimmt nicht.
- **Beleg:** `Edit.vue` (`goBack`, Kopfleiste); [iphone-hell-edit-lasagne-dirty.png](ux-audit/iphone-hell-edit-lasagne-dirty.png)
- **Vorschlag:**
  - Bei ungespeicherten Änderungen fragen: „Speichern“, „Verwerfen“, „Weiter bearbeiten“.
  - Ohne Änderungen still schließen.
  - Bezeichnung „Schließen“.
  - Dasselbe für Zurück-Geste und Tab-Wechsel per `onBeforeRouteLeave`.

**E-02 · Stufe 2 · S: Kopfleiste: sechs Symbole, zwei ähnliche X, Speichern ohne Text**
- **Aufgabe/Heuristik:** K4, K5; H4, H6, HIG Toolbars
- **Beschreibung:**
  - Auf dem iPhone stehen ✕, ↶, ↷, ⊗ („Änderungen verwerfen“), 🗑 („Entwurf löschen“, nur mit Entwurf), 👁 und ✓, alles ohne Text.
  - Der Titel schrumpft auf „Bearbei…“.
  - ✕ und ⊗ sehen gleich aus und bedeuten Verschiedenes; ⊗ und 🗑 überschneiden sich fachlich.
  - Ob ungespeicherte Änderungen vorliegen, erkennt man nur daran, dass Symbole hell statt grau sind.
- **Beleg:** [iphone-hell-edit-lasagne.png](ux-audit/iphone-hell-edit-lasagne.png), [iphone-hell-edit-lasagne-dirty.png](ux-audit/iphone-hell-edit-lasagne-dirty.png)
- **Vorschlag:**
  - Links „Schließen“, rechts ein Text-Knopf „Speichern“ als primäre Aktion.
  - Verwerfen, Entwurf löschen und Vorschau in ein ⋮-Menü.
  - Rückgängig und Wiederholen bleiben.
  - Ungespeicherte Änderungen mit einem Punkt am Speichern-Knopf oder „Nicht gespeichert“ unter dem Titel anzeigen.

**E-03 · Stufe 2 · M: Editor auf dem iPhone: Ziele 31–32 px, Zeilen doppelt so hoch, 18 rote Papierkörbe**
- **Aufgabe/Heuristik:** K5; HIG, Formular-UX
- **Beschreibung:**
  - 44 von 50 Zielen liegen unter 44 px (X-03).
  - Jede Zutat belegt zwei Zeilen: Name, darunter Menge, Einheit, Notiz-Knopf und Papierkorb.
  - Ein Abschnitt mit 11 Zutaten füllt rund 1,5 Bildschirme, bevor der erste Schritt kommt.
  - Jede Zeile trägt einen rot umrandeten Papierkorb. Das wirkt unruhig und lädt zu Fehltipps ein, auch wenn Undo da ist.
- **Beleg:** [iphone-hell-edit-lasagne-abschnitt.png](ux-audit/iphone-hell-edit-lasagne-abschnitt.png); am Tablet gut gelöst: [tablet-dunkel-edit-lasagne-abschnitt.png](ux-audit/tablet-dunkel-edit-lasagne-abschnitt.png)
- **Vorschlag:** Mobil eine Zeile je Zutat (Menge | Einheit | Name, siehe E-05); Notiz und Löschen hinter Wischen bzw. einem ⋯ je Zeile; Felder 44 px, 16 px Schrift.

**E-04 · Stufe 2 · S: Menge leeren ergibt 0; Komma und Brüche eingeschränkt**
- **Aufgabe/Heuristik:** K4; H5, Formular-UX
- **Beschreibung:** Wird die Menge geleert, z. B. bei „Salz“, entsteht aus `Number("")` der Wert 0; das Feld zeigt sofort „0“ (P3), die Ansicht dann „0 Salz“. `type="number"` ohne `inputmode="decimal"`: Ob iOS die passende Tastatur mit Komma zeigt und „1,5“ annimmt, ist **am Gerät zu prüfen**. Brüche („½“, „1/2“), wie sie in Kochbüchern üblich sind, gehen nicht.
- **Beleg:** `IngredientRow.vue:30-34`, `IngredientRow.vue:78-88`; dasselbe Muster bei der Portionsmenge in `Edit.vue`
- **Vorschlag:** Leer bleibt `null`; `inputmode="decimal"` mit eigenem Parser (Komma, Punkt, ½, 1/2).

**E-05 · Stufe 2 · M: Zutatzeile: Reihenfolge und Bedienung uneinheitlich**
- **Aufgabe/Heuristik:** K4, K5; H4, Formular-UX
- **Beschreibung:**
  - Die Zeile lautet Name | Menge | Einheit, Ansicht und Kochbuch zeigen „200 g Mehl“.
  - Der Name ist ein Tippen-zum-Bearbeiten-Text (`InlineEditField`, Commit nur mit Enter oder Klick daneben), Menge und Einheit sind immer Felder.
  - Ein Name lässt sich nicht leeren (leer wird verworfen), und das Feld hat kein Label.
  - Wer zeilenweise abtippt, springt hin und her.
- **Beleg:** `IngredientRow.vue` (Template), `InlineEditField.vue`
- **Vorschlag:** Drei gleichartige Felder in Lesereihenfolge Menge, Einheit, Name. Enter bzw. „Weiter“ springt ins nächste Feld und legt am Ende eine neue Zutat an.

**E-06 · Stufe 2 · XS: Abschnitt löschen ohne Rückfrage**
- **Aufgabe:** K5
- **Beschreibung:** Der Papierkorb am Abschnitt löscht den Abschnitt **mit allen Zutaten und Schritten**. Es gibt keine Rückfrage, Rettung nur über das ↶-Symbol in der Kopfleiste, das nicht jeder kennt.
- **Beleg:** `useSectionEditor.ts:21-29`
- **Vorschlag:** Rückfrage mit Anzahl („3 Zutaten und 4 Schritte werden gelöscht“) oder Toast mit „Rückgängig“.

**E-07 · Stufe 2 · XS: Fachjargon bei den Portionen**
- **Aufgabe:** K5
- **Beschreibung:** „Menge“, „Umrechnen“ (Schalter) und „Exponent“ sind für alle sichtbar. Was „Exponent“ bewirkt (nichtlineares Skalieren), erschließt sich nicht. „Menge“ ist doppeldeutig zur Zutatenmenge.
- **Beleg:** [iphone-hell-edit-lasagne-portionen-bild.png](ux-audit/iphone-hell-edit-lasagne-portionen-bild.png)
- **Vorschlag:** „Ergibt: [6] [Portionen]“; „Umrechnen“ als „Mengen beim Ändern mitrechnen“ mit Erklärung; „Exponent“ nur im Experten-Modus.

**E-08 · Stufe 2 · S: Tags lassen sich im Editor nicht bearbeiten**
- **Aufgabe:** K4, K5
- **Beschreibung:** Der Editor hat kein Tag-Feld. Tags ändert man nur über das ⋮-Menü einer Karte auf Home, dort in einem kleinen Inline-Editor. Nach einem KI-Import muss P2 den Editor verlassen, die Karte suchen und das Menü öffnen.
- **Beleg:** `Edit.vue` (Template ohne Tags), `RecipeCard.vue` (Tag-Editor)
- **Vorschlag:** Tag-Feld mit Vorschlägen in der Bearbeitung, unter dem Untertitel. Den Karten-Editor danach entfernen oder behalten.

**A-01 · Stufe 2 · XS: KI-Dialog zeigt den Footer „Cancel / OK“**
- **Aufgabe/Heuristik:** K4; H4, H2
- **Beschreibung:** `hide-footer` gibt es in bootstrap-vue-next 0.44 nicht; die Prop heißt `noFooter` (geprüft in `node_modules/bootstrap-vue-next/dist/BModal-*.mjs`). Deshalb zeigt der Dialog unten „Cancel / OK“. „OK“ schließt nur. Dasselbe gilt für das Vorschau-Modal im Editor.
- **Beleg:** `HomeView.vue:186-192`, `Edit.vue:652-658`; [iphone-hell-ai-import-start.png](ux-audit/iphone-hell-ai-import-start.png)
- **Vorschlag:** `no-footer`. Hinweis an W.15: Mit bootstrap-vue-next 1.x die Namen erneut prüfen.

**A-02 · Stufe 2 · S–M: KI-Import: doppelte Hülle, Zwischenschritt mit wenig Nutzen**
- **Aufgabe/Heuristik:** K4; H8, H4
- **Beschreibung:**
  - Der Dialogtitel „AI-Rezept-Import“ wiederholt sich als Kartenkopf im Dialog.
  - Der Tab „Foto aufnehmen oder wählen“ trägt denselben Text wie der Knopf darunter.
  - Nach „Rezept erkennen“ folgt ein Zwischenstand mit nur dem Titel, dann „Rezept importieren“ (Download-Symbol), erst danach der Editor.
  - Drei Verben für einen Vorgang: erkennen, extrahieren, importieren.
  - Farben Blau, Grün, Grau (X-02).
- **Beleg:** [iphone-hell-ai-import-ergebnis.png](ux-audit/iphone-hell-ai-import-ergebnis.png)
- **Vorschlag:** Nach erfolgreicher Erkennung direkt in den Editor als **Entwurf**, angelegt erst beim Speichern (siehe H-03); die Vorlage steht dort zum Abgleich bereit. Eine Hülle, ein Verb („KI-Import“ → „Erkennen“). Berührt 7.1, siehe [Abschnitt 8](#8-hinweise-an-bestehende-roadmap-punkte).

**A-03 · Stufe 2 · XS–S: Während der Analyse nur ein Spinner im Knopf**
- **Aufgabe/Heuristik:** K4; H1
- **Beschreibung:** Die Analyse kann bis zu 120 s dauern (Backend-Timeout laut `ai.ts`). In dieser Zeit erscheint nur ein kleiner Spinner im Knopf „Rezept erkennen“; Hinweis auf Dauer, Fortschritt oder Abbrechen gibt es nicht (P8). Gut ist: Schließen und erneutes Öffnen behält Seiten und Ergebnis (P8).
- **Beleg:** `AIRecipeImport.vue` (`runAnalysis`, Template)
- **Vorschlag:** Statuszeile „Rezept wird erkannt … das dauert meist unter einer Minute“ (Wert aus Betriebsdaten bestätigen) und „Abbrechen“ (AbortController).

**E-09 · Stufe 1 · XS: „Metadaten“ mit doppeltem Pfeil**
- **Heuristik:** H2, H8
- **Beschreibung:** Die Überschrift „Metadaten“ (Fachbegriff) zeigt zwei Dreiecke: den `summary`-Marker und ein zusätzliches ▸.
- **Beleg:** [iphone-hell-edit-lasagne.png](ux-audit/iphone-hell-edit-lasagne.png)
- **Vorschlag:** „Details (Autor, Quelle, Zeiten)“, nur ein Marker.

**E-10 · Stufe 1 · XS: Bildbereich: Löschen auf dem Platzhalter, „hierher ziehen“, kein Alt-Text**
- **Heuristik:** H2; WCAG 1.1.1 (axe `image-alt`)
- **Beschreibung:**
  - Ohne Bild trägt der Platzhalter einen roten Löschen-Knopf ([iphone-hell-ai-import-editor.png](ux-audit/iphone-hell-ai-import-editor.png)).
  - „Foto auswählen oder hierher ziehen…“ passt nicht zum iPhone.
  - Die Vorschau `#image-preview` hat kein `alt`.
  - In der Vorlage im Editor sind die Bildlinks nur 2 × 120 px groß gemessen; das Layout lässt die Links zusammenfallen.
- **Beleg:** `Edit.vue` (Bild-Block), [iphone-hell-edit-linzer-vorlage.png](ux-audit/iphone-hell-edit-linzer-vorlage.png)
- **Vorschlag:** Löschen nur bei echtem Bild; Text „Foto auswählen“; `alt=""` an der Vorschau; Links als Block.

**E-11 · Stufe 1 · XS: Schrittnummern im Editor je Abschnitt**
- **Heuristik:** H4
- **Beschreibung:** Wie R-13.
- **Beleg:** `SectionCard.vue` (`:number="localIdx + 1"`)
- **Vorschlag:** Zusammen mit R-13 entscheiden.

**A-04 · Stufe 1 · S: Seitenreihenfolge beim Foto-Import nicht änderbar**
- **Aufgabe:** K4
- **Beschreibung:** Seiten lassen sich nur entfernen. Bei falscher Reihenfolge heißt es: alle entfernen und neu wählen. Der Hinweis „in Lesereihenfolge“ steht erst unter dem Knopf.
- **Beleg:** `ImportPageList.vue`
- **Vorschlag:** Ziehen zum Sortieren (SortableJS ist schon im Projekt) oder ◀▶ je Seite.

### 5.5 Profil (P)

**P-01 · Stufe 2 · XS–S: Gemischtes Speichermodell, Schalter gehen still verloren**
- **Aufgabe/Heuristik:** K8; H4, H5
- **Beschreibung:**
  - Hell, Dunkel und System wirken sofort.
  - „Nur lesen“ und „Experten-Modus“ brauchen den kleinen Knopf „Speichern“ (31 px, hellblau, X-02).
  - Wer umschaltet und den Tab wechselt, verliert die Änderung ohne Hinweis (P6).
  - Die Schalter messen 32 × 16 px.
- **Beleg:** `ProfileView.vue` (Template); [iphone-hell-profil.png](ux-audit/iphone-hell-profil.png)
- **Vorschlag:** Wie bei iOS-Einstellungen sofort speichern und kurz bestätigen; den Knopf entfernen; den ganzen Listeneintrag als Tippziel.

**P-02 · Stufe 2 · XS: Kein Hinweis, wer angemeldet ist**
- **Aufgabe:** K8
- **Beschreibung:** Das Profil zeigt ein Avatar-Symbol und ein Rollen-Badge, aber weder Namen noch E-Mail. Auf geteilten Familiengeräten bleibt offen, wessen Favoriten und Rechte gerade gelten.
- **Beleg:** [iphone-hell-profil.png](ux-audit/iphone-hell-profil.png)
- **Vorschlag:** Name und E-Mail aus `/me` bzw. dem ID-Token neben dem Avatar.

**P-03 · Stufe 2 · XS: „Nur lesen“ unklar, gesperrt ohne Erklärung, Badges mehrdeutig**
- **Aufgabe/Heuristik:** K8; H2, H10 Hilfe
- **Beschreibung:**
  - „Nur lesen“ hat keine Erklärung; gemeint ist offenbar, Bearbeiten-Funktionen auszublenden.
  - Für `readonly` und `pending` ist der Schalter gesperrt, ohne Grund.
  - `pending` erscheint als „Nur Lesen“.
  - Das Admin-Badge ist rot (`bg-danger`), also eine Gefahrfarbe.
- **Beleg:** `ProfileView.vue:50-67`; [iphone-hell-profil-readonly.png](ux-audit/iphone-hell-profil-readonly.png)
- **Vorschlag:** Untertitel „Blendet Bearbeiten-Funktionen aus“; bei Sperre „Deine Rolle erlaubt nur Lesen“; eigene Bezeichnung „Wartet auf Freigabe“; neutrale Badge-Farben.

**P-04 · Stufe 2 · S: Wartende Nutzer erfährt der Admin nicht**
- **Aufgabe:** K9
- **Beschreibung:** Der Hinweis „1 Nutzer warten auf Freigabe“ steht nur innerhalb der Verwaltung. Ohne Benachrichtigung oder Badge erfährt der Admin davon nur auf anderem Weg. Ein neues Familienmitglied sieht derweil „Dein Account wartet auf Freigabe“.
- **Beleg:** `AdminUsers.vue` (Hinweis), `BottomNav.vue`
- **Vorschlag:** Badge mit Anzahl am Profil-Tab und am Eintrag „Verwaltung“ für Admins, Daten aus `/admin/users`. Optional später eine Mail über n8n; das ist eine Scope-Frage.

**P-05 · Stufe 1 · XS: Bezeichnung des Verwaltungslinks unvollständig**
- **Aufgabe:** K9
- **Beschreibung:** Der Link heißt „Benutzerverwaltung & Share-Links“. Die Seite enthält außerdem Einstellungen, KI, Rezepte und Wartung.
- **Beleg:** `ProfileView.vue`
- **Vorschlag:** „Verwaltung“ mit Untertitel „Nutzer, KI, Freigaben, Wartung“.

**P-06 · Stufe 0 · XS: `views/Settings.vue` ist toter Code**
- **Beschreibung:** `/settings` lädt `ProfileView.vue`. `Settings.vue` wird nirgends importiert und enthält abweichende Texte, z. B. „Verwaltung: YAML Import/Export für alle Rezepte“.
- **Beleg:** `router/index.ts:62-68`
- **Vorschlag:** Löschen. Folgepunkt Aufräumen, kein UX-Bündel.

### 5.6 Verwaltung (V)

**V-01 · Stufe 4 · XS: × in der Rezeptliste löscht sofort und endgültig**
- **Heuristik:** H5 Fehlervermeidung, H3
- **Beschreibung:**
  - Jede Zeile der Rezeptliste hat zwei unbeschriftete Knöpfe: × und ⧉. × ruft `store.deleteRecipe(index)` ohne Rückfrage auf; der Server löscht das Rezept samt Bildern (Probe P10: `DELETE /api/v1/recipes/r-pfannkuchen` unmittelbar nach dem Tipp).
  - Es gibt kein Rückgängig, und die Knöpfe stehen dicht neben ⧉ „Duplizieren“.
  - Auf dem iPhone ist die Liste mit dem Daumen schnell zu treffen.
  - Die Knöpfe haben keinen zugänglichen Namen (axe `button-name`).
- **Beleg:** `AdminRecipes.vue:41-43` und Template; [iphone-hell-verwaltung-rezepte.png](ux-audit/iphone-hell-verwaltung-rezepte.png)
- **Vorschlag:** Sofort: Rückfrage mit Rezeptname (XS). Besser: die Liste entfernen, denn Löschen und Duplizieren gibt es in der Rezeptansicht, oder Papierkorb mit Text und Rückgängig-Toast. Ich empfehle das als ersten UX-Auftrag, auch einzeln als Mitnahme-tauglich.

**V-02 · Stufe 2 · M: Nutzertabelle auf dem iPhone abgeschnitten, Rollen englisch, keine Rückfrage**
- **Aufgabe:** K9
- **Beschreibung:**
  - Die Tabelle mit fünf Spalten hat kein `table-responsive`. Ab der Spalte „Erstellt“ wird sie abgeschnitten, die Seite scrollt waagerecht.
  - Der Name steht doppelt („Lena Neumann / Lena Neumann“).
  - Die Rolle wechselt sofort beim Auswählen, ohne Rückfrage, auch für den eigenen Account.
  - Die Meldung nennt den Code: „Rolle von Lena Neumann → editor“.
  - Die Selects haben keine Labels (axe `select-name`).
- **Beleg:** [iphone-hell-verwaltung.png](ux-audit/iphone-hell-verwaltung.png); `AdminUsers.vue` (Template, `changeRole`)
- **Vorschlag:** Mobil eine Kartenliste; Wartende oben mit dem Knopf „Freischalten als …“; deutsche Rollennamen (X-06); Rückfrage bei Herabstufung und beim eigenen Account; Label je Select.

**V-03 · Stufe 2 · XS–S: Dunkelmodus: Tabellenkopf hell, wartende Zeile unlesbar**
- **Aufgabe:** K9
- **Beschreibung:** `table-light` und `table-warning` sind nicht an den Dunkelmodus angepasst. Der Kopf ist weiß, die wartende Zeile hellgelb mit fast weißem Text (Kontrast 1,08:1 laut axe).
- **Beleg:** [iphone-dunkel-verwaltung.png](ux-audit/iphone-dunkel-verwaltung.png)
- **Vorschlag:** Token-basierte Tabellenfarben bzw. `table-light` entfernen; Hervorhebung über `--color-warning-bg`.

**V-04 · Stufe 2 · S: Uneinheitliches Speichern, Wartung ohne Rückfrage**
- **Heuristik:** H4, H5
- **Beschreibung:**
  - „Max. Share-Laufzeit“ speichert beim Verlassen des Felds, die Modelle über „Modelle speichern“.
  - „Verwaiste Bilder bereinigen“ löscht ohne Rückfrage.
  - „Bild-URLs migrieren“ (Altlast) steht gleichrangig daneben.
  - Am Ende der Liste speichert ein „Speichern“ in den lokalen Speicher, für Nutzer ohne erkennbaren Sinn (→ 11.2).
- **Beleg:** `AdminSettings.vue`, `AdminMaintenance.vue`, `AdminRecipes.vue:67-70`
- **Vorschlag:** Ein Speichermodell für die Seite; Wartungsaktionen mit Rückfrage in einem eingeklappten Bereich „Wartung“; „Bild-URLs migrieren“ entfernen, falls erledigt (Betriebsfrage).

**V-05 · Stufe 2 · M: Eine lange Seite ohne Gliederung**
- **Aufgabe:** K9
- **Beschreibung:**
  - Benutzer, Einstellungen, KI, Freigaben, Wartung und Rezeptaktionen stehen untereinander, getrennt durch `hr`.
  - Wartung und Rezeptaktionen haben keine Überschrift.
  - „Neues Rezept“ und „Beispielrezept“ doppeln das FAB.
  - Auf dem iPhone sind es rund fünf Bildschirmhöhen.
- **Beleg:** [iphone-hell-verwaltung-einstellungen.png](ux-audit/iphone-hell-verwaltung-einstellungen.png), [iphone-hell-verwaltung-rezepte.png](ux-audit/iphone-hell-verwaltung-rezepte.png)
- **Vorschlag:** Eine Liste von Unterseiten bzw. aufklappbaren Gruppen (Nutzer, KI, Freigaben, Wartung) im Stil der iOS-Einstellungen; doppelte Rezeptaktionen entfernen.

**V-06 · Stufe 1 · XS: Kein Zurück**
- **Heuristik:** H3
- **Beschreibung:** Die Verwaltung hat weder Kopfzeile noch Zurück. Man kommt nur über den Profil-Tab zurück, der dafür als aktiv markiert ist.
- **Beleg:** `Administration.vue`
- **Vorschlag:** Kopfzeile „← Verwaltung“ wie im Konzept für Unterseiten.

**V-07 · Stufe 1 · XS: Freigabeliste: Kopieren 24 × 23 px, Token statt Link**
- **Aufgabe:** K7
- **Beschreibung:** Die Spalte zeigt den Token, nicht den Link. Der Kopieren-Knopf misst 24 × 23 px, die Status-Badges sind klein.
- **Beleg:** [iphone-hell-verwaltung-freigaben.png](ux-audit/iphone-hell-verwaltung-freigaben.png)
- **Vorschlag:** Mobil als Karten, zusammen mit V-02.

---

## 6. Barrierefreiheit (WCAG 2.2 AA)

**Werkzeug:** axe-core 4.14.1 in Edge 156 (headless), Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`.

**Geprüfte Zustände:** Home, Rezept, Rezept mit Zutaten, Rezept mit Info, Teilen, Editor, KI-Import, Profil und Verwaltung. Jeweils iPhone hell, iPhone dunkel und Tablet hell.

| Regel | Wirkung | WCAG | Wo | Befund |
|---|---|---|---|---|
| `button-name` | kritisch | 4.1.2 | Portionen ±, Teilen-Schließen, Rezeptliste der Verwaltung (33 Knoten) | R-07, R-12, V-01 |
| `select-name` | kritisch | 4.1.2 | Sortierung Home, Laufzeit Teilen, Rollen-Selects | X-09, V-02 |
| `label` | kritisch | 4.1.2 | Portionen-Feld, Laufzeit in der Verwaltung | R-07 |
| `image-alt` | kritisch | 1.1.1 | `#image-preview` im Editor | E-10 |
| `color-contrast` | ernst | 1.4.3 | 101 Knoten, Tokens siehe unten | X-01, V-03 |
| `nested-interactive` | ernst | 4.1.2 | Portionen im Knopf „Zutaten öffnen“ | R-07 |
| `label-content-name-mismatch` | ernst | 2.5.3 | dto. | R-07 |
| `scrollable-region-focusable` | ernst | 2.1.1 | Zutatenliste im Sheet | X-04 |
| `meta-viewport` | mittel | 1.4.4 | alle | X-05 |
| `heading-order`, `page-has-heading-one`, `landmark-one-main`, `region`, `landmark-unique` | mittel | Best Practice | alle | X-09 |
| `empty-table-header` | gering | Best Practice | Freigaben | V-07 |

**Kontraste der Tokens** (Formel nach WCAG, nachgerechnet; Ziel 4,5:1 für normalen Text, 3:1 für Grafik):
| Kombination | hell | dunkel |
|---|---|---|
| `--color-text` auf `--color-surface` | 13,40 ✓ | 13,84 ✓ |
| `--color-text-muted` auf `--color-surface` | **4,24 ✗** | 5,93 ✓ |
| `--color-primary` als Text auf `--color-surface` | **3,95 ✗** | 6,47 ✓ |
| Weiß auf `--color-primary` | 4,45 (knapp ✗) | **2,65 ✗** |
| `--color-chrome-muted` auf `--color-chrome` (Bottom Nav inaktiv) | **3,97 ✗** | **3,78 ✗** |
| `--color-chrome-text` auf `--color-chrome` | 10,66 ✓ | – |
| `--color-danger` auf `--color-surface` | 4,83 ✓ | – |
| `--color-warning-text` auf `--color-warning-bg` | 7,28 ✓ | 8,22 ✓ |

Die Gegenvorschläge sind ebenfalls nachgerechnet:
- #6e655e auf der Fläche: 5,06
- #5a6c32 auf der Fläche: 5,15
- Weiß auf #5a6c32: 5,79
- #1e1b18 auf #8fa85c: 6,47
- Chrome-muted mit Alpha 0,7: 6,13 hell, 7,48 dunkel

**Von Hand geprüft:**
- **Fokusreihenfolge Rezept (iPhone):**
  - Reihenfolge: Zurück → Favorit → Menü → „Zutaten öffnen“ → − → Portionen → + → zurück zum Anfang (P7). Schritte sind keine Tab-Stopps, das ist für Lesetext in Ordnung.
  - Der ⓘ-Knopf fehlt (R-04).
  - Nach dem Öffnen von Overlays bleibt der Fokus auf `body` (X-04).
- **Fokus sichtbar:** Bootstrap-Fokusringe sind vorhanden, in der Kopfzeile aber kaum zu erkennen (Chrome-Hintergrund). Nicht vertieft.
- **Beschriftungen:**
  - Icon-Knöpfe in den Kopfzeilen von Rezept und Editor haben `title` bzw. `aria-label` (gut).
  - Ohne Namen sind: Portionen, Kartenstern (div), ⓘ (div), Teilen-Schließen und die Verwaltungsliste.
  - Das Kartenbild trägt „Card image cap“ (H-06).
- **Bewegung:** Die Übergänge sind kurz (0,15–0,3 s). `prefers-reduced-motion` wird nicht beachtet; geringes Gewicht, nicht als Befund geführt.

---

## 7. Abweichungen von Plan und UX-Konzept

Die Wirklichkeit weicht an diesen Stellen von [ui-roadmap-2025-26.md](ui-roadmap-2025-26.md) ab. Das Dokument ist als Archiv gekennzeichnet und liegt außerhalb der Ablage dieses Auftrags. Ich habe es deshalb nicht geändert. Vorschlag an den Master: beim Zuschnitt der UX-Aufträge dort vermerken oder die Haken entfernen.

| Plan sagt | Wirklichkeit | Befund |
|---|---|---|
| Sprint 3: „Touch-optimiert: Min. 44x44px Buttons“ | Editor-Knöpfe 32 × 31, Felder 31 hoch | X-03, E-03 |
| Sprint 9: „Touch-Targets (min. 44x44px)“ | systematisch 30–39 px | X-03 |
| Sprint 9: „Bootstrap-Overrides via Tokens“ | `.btn-primary` u. a. bleiben Bootstrap-Blau | X-02 |
| Sprint 9: „ARIA-Labels auf alle Icon-Only-Buttons, `button` statt `div`“ | ⓘ und Kartenstern sind `div`, Portionen ± ohne Label | R-04, R-07, H-06 |
| Sprint 1: „Mobile: Bottom Bar … mit Backdrop“ | kein Backdrop am Zutaten-Sheet | R-11, X-04 |
| Sprint 1: „Filter-Toggle: Alle / Nur aktueller Abschnitt“ | „Nur aktuell“ zeigt alle Abschnitte | R-01 |
| Sprint 3: Inline-Buttons „+/− direkt bei Zutat/Schritt“ | vorhanden, aber 32 px und auf dem iPhone zweizeilig | E-03 |
| UX-Konzept, Edit-Modus: `✕ Bearbeiten 💾 [↩↪]` | zusätzlich ⊗, 🗑 und 👁; ✕ ohne Rückfrage | E-01, E-02 |

---

## 8. Hinweise an bestehende Roadmap-Punkte

Diese Befunde gehören zu geplanten Punkten. Sie sind kein eigener Vorschlag, sondern Eingabe für deren Zuschnitt.

| Punkt | Hinweis | Befund |
|---|---|---|
| **7.1** Wizard | Neues Rezept erst beim ersten Speichern anlegen; KI-Import direkt in den Editor als Entwurf; ✕ mit Rückfrage. Der Wizard sollte das Anlegemuster für FAB, KI-Import und Duplizieren vereinheitlichen. | H-03, A-02, R-15, E-01 |
| **6.1** Koch-Notizen | Voraussetzung: Vorhandene Notizen und HACCP werden heute nicht angezeigt (R-03). R-03 sollte vorher erledigt sein, damit 6.1 auf einer funktionierenden Anzeige aufsetzt. | R-03 |
| **10.1** PDF-Export | Notizen, Verarbeitung, HACCP und Zeiten ins PDF; die Entscheidung zur Schrittnummerierung (R-13) gilt auch dort; „Min Min“ nicht übernehmen. | R-03, R-08, R-13 |
| **W.34** Kennzeichnung lokaler Rezepte | Löschen meldet Fehler heute nicht und verschwindet offline still. Beim Kennzeichnen lokaler Rezepte festlegen, was Löschen für sie bedeutet. | H-02 |
| **W.15** bootstrap-vue-next 1.x | `hide-footer` → `no-footer` (A-01); Mapping der Bootstrap-Farben auf Tokens (X-02) nach dem Upgrade prüfen; ggf. `BModal` / `BOffcanvas` für X-04. | A-01, X-02, X-04 |
| **11.2** ZIP-Import | entfernt laut Roadmap das IndexedDB-„Speichern“ in der Verwaltung | V-04 |
| **5.1** Einkaufsliste | keine Befunde | – |

---

## 9. Vorschlag zur Bündelung

Je Ansicht ≤ M. IDs für Roadmap-Punkte vergibt der Master; hier heißen sie U.2 ff.

| Vorschlag | Inhalt | Aufwand | Begründung der Reihenfolge |
|---|---|---|---|
| **U.2 Löschen und Rechte absichern** (übergreifend) | V-01, H-02, H-01 | S | einziger Befund der Stufe 4 und zwei der Stufe 3, klein |
| **U.3 Koch-Modus: Kernfunktionen** (Rezept) | R-01, R-02, R-05, R-06, R-07, R-10, R-11 | M | Kernaufgabe K1/K2, drei Befunde der Stufe 3 bzw. 2 im Hauptweg |
| **U.4 Rezeptinhalt vollständig anzeigen** (Rezept) | R-03, R-04, R-08 (nur Anzeige), R-09, R-13, R-14 | S–M | vor 6.1 und 10.1 |
| **U.5 Editor: Verlassen, Kopfleiste, Formulare** (Bearbeitung) | E-01, E-02, E-04, E-06, E-07, E-08, E-09, E-10, E-11 | M | Stufe 3 E-01, Datenqualität E-04 |
| **U.6 Editor mobil: Zutatzeile und Touch** (Bearbeitung) | E-03, E-05, X-07 für den Editor | M | nach U.5, gleiche Dateien |
| **U.7 KI-Import glätten** (Bearbeitung) | A-01, A-03, A-04; A-02 nur mit 7.1 abgestimmt | S | A-01 ist XS und könnte auch Mitnahme sein |
| **U.8 Profil** | P-01, P-02, P-03, P-04, P-05 | S | P-04 hängt von `/admin/users` ab, keine API-Änderung nötig |
| **U.9 Verwaltung mobil** | V-02, V-03, V-04, V-05, V-06, V-07 | M | nach U.2 (V-01) |
| **U.10 Design-Tokens und Begriffe** (übergreifend) | X-01, X-02, X-06, X-10, H-07 | S–M | nach W.15 wegen X-02; Glossar vorher entscheiden |
| **U.11 Dialoge und Semantik** (übergreifend) | X-04, X-08, X-09, H-05, H-06, R-12 | M | gemeinsame Sheet- und Dialog-Komponente, danach erledigt sich R-11 teilweise mit |

**Entscheidungen, die vor dem Zuschnitt nötig sind:**
1. **Zoom (X-05):** Sperre aufheben oder Textgrößen-Einstellung? Ich empfehle: Zoom wieder erlauben, `touch-action: manipulation` gegen den Doppeltipp-Zoom und Eingaben mit 16 px. Eine Textgrößen-Einstellung zusätzlich nur, wenn die Gerätetests das nahelegen.
2. **Schrittnummern (R-13):** durchgehend oder je Abschnitt?
3. **Zeiten als Zahl (R-08, Teil M):** Schema- und Datenmigration. Zuschnitt als eigener Punkt, falls gewünscht.
4. **Glossar (X-06):** „KI“ oder „AI“, die Rollennamen, „Teilen“ oder „Link“.

**Empfohlene Reihenfolge:** U.2 → U.3 → U.5 → U.4 → U.10 (nach W.15) → U.11 → U.6 → U.9 → U.8 → U.7. U.2 und U.3 lassen sich parallel bearbeiten, weil sie andere Dateien betreffen. U.4 und U.3 berühren beide `RecipeDisplay.vue` und gehören nacheinander.

---

## 10. Was gut funktioniert

Diese Punkte sollen bleiben:
- **Drei Modi mit einer Bottom Nav:** Browsing mit vier Tabs, Koch- und Edit-Modus ohne Nav. Klar und umgesetzt wie im Konzept ([iphone-hell-home.png](ux-audit/iphone-hell-home.png)).
- **Lesbarkeit der Schritte:** 18 px mobil, großzügige Zeilenhöhe und Trennlinien; auf Armlänge gut lesbar ([iphone-hell-recipe-lasagne-bechamel.png](ux-audit/iphone-hell-recipe-lasagne-bechamel.png)).
- **Split-View am Tablet:** Zutaten links sticky, Schritte rechts, Portionen im Zutatenkopf ([tablet-hell-recipe-lasagne-bechamel.png](ux-audit/tablet-hell-recipe-lasagne-bechamel.png)). Nach R-01 und R-06 die beste Kochansicht der App.
- **Zutaten-Leiste unten mit Portionen:** Der Grundgedanke liegt in der Daumenzone und passt zur einhändigen Bedienung. Zu verbessern sind nur die Ziele (R-07).
- **Abschnitts-Erkennung beim Scrollen:** arbeitet korrekt (P2b); falsch ist nur die Filterung (R-01).
- **Home adaptiv:** „Zuletzt geöffnet“ und „Entwürfe“ erscheinen nur mit Daten; der Entwurf-Chip führt direkt in den Editor, mit Toast „Entwurf wiederhergestellt.“.
- **Entwürfe mit Auto-Save und Undo/Redo** im Editor: Datenverlust ist selten. E-01 betrifft nur die Rückmeldung, nicht die Sicherung.
- **Vorlage des Foto-Imports** am Rezept und im Editor zum Abgleich, standardmäßig eingeklappt ([iphone-hell-recipe-linzer-vorlage.png](ux-audit/iphone-hell-recipe-linzer-vorlage.png)).
- **KI-Import:**
  - Mehrseitige Fotos mit Vorschau und Nummer.
  - Verständliche deutsche Fehlermeldungen je Fehlerart (`ai.ts`: `aiErrorMessage`).
  - Seiten und Ergebnis überstehen das Schließen des Dialogs (P8).
  - Die Dateiauswahl ohne `capture`, sodass iOS Kamera und Mediathek anbietet.
- **Editor am Tablet:** zweispaltige Abschnittskarten (Zutaten | Schritte), Ziehen und ▲▼, Notizen inline ([tablet-dunkel-edit-lasagne-abschnitt.png](ux-audit/tablet-dunkel-edit-lasagne-abschnitt.png)).
- **Rückmeldung beim Anlegen:** `appendFeedback` unterscheidet angelegt, nur lokal und fehlgeschlagen, mit eigener Meldung je Fall.
- **Dunkelmodus:** vollständig, Umschaltung in drei Stufen, wirkt sofort; Kopf- und Navigationsfarben stimmig. Ausnahmen: V-03, X-01 dunkel.
- **Offline-Banner und Sitzungshinweise** („Keine Verbindung, noch keine Daten“) statt leerem Bildschirm.
- **Rückfragen an kritischen Stellen:** Abmelden, Rezept löschen in der Rezeptansicht und auf Karten, Freigabe widerrufen in der Verwaltung. Es fehlen nur V-01, E-06 und R-12.
- **Kopfzeilen von Rezept und Editor:** Icon-Knöpfe mit 44 px und `aria-label`/`title`; Bottom Nav mit `aria-current`.
- **Pending-Hinweis** für neue Nutzer auf Home und im Rezept: klar formuliert.

---

## 11. Am Gerät prüfen

Auf iPhone (installierte PWA und Safari) und iPad; die Befunde oben sind darauf nur angenähert:

| # | Was | Erwartung | Befund |
|---|---|---|---|
| 1 | Bildschirm bleibt während eines Rezepts an (nach R-02), iOS < 18.4 und ≥ 18.4, Standalone | an, solange die Ansicht sichtbar ist | R-02 |
| 2 | Pinch-Zoom in der installierten PWA und in Safari trotz `user-scalable=no` | dokumentieren, ob gesperrt | X-05 |
| 3 | Fokus in ein Editorfeld (14 px): zoomt Safari hinein? | mit `maximum-scale=1` vermutlich nein | X-07 |
| 4 | Menge mit Komma eingeben (`type="number"`), welche Tastatur erscheint? | Ziffernblock mit Komma; „1,5“ angenommen | E-04 |
| 5 | Teilen: „Erstellen“ kopiert den Link (Zwischenablage nach `await`) | Toast „Link kopiert!“, Link einfügbar | R-12 |
| 6 | Vorlage antippen in der Standalone-PWA: wohin geht es, wie zurück? | Rückkehr ohne Neustart | R-16 |
| 7 | Safe Areas: Zutaten-Leiste, Bottom Nav, FAB, Kopfzeile auf iPhone mit Dynamic Island und Home-Indikator | nichts verdeckt, Leiste über dem Indikator | – |
| 8 | Zutaten-Sheet mit eingeblendeter Tastatur (Portionen-Feld) | Feld bleibt sichtbar | R-07 |
| 9 | Ziehen und Ablegen (SortableJS) im Editor auf dem iPhone, gegen Scrollen | eindeutig, kein versehentliches Verschieben | E-03 |
| 10 | Statusleiste und Splash (`theme_color`, `status-bar-style`) | Farben des Designs | X-10 |
| 11 | Lesbarkeit des Titels über echten Fotos (Overlay mit 60 % Grau) | ≥ 4,5:1 auch bei hellen Fotos | – |
