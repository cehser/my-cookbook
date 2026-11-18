# Konzept: Profil und Verwaltung

> U.12 · Stand 2026-11-18 · Basis `main@66a2125` · Entscheidungsvorlage, kein Code
> Grundlage: [UX-Audit](ux-audit.md) 5.5 (P-01–P-06), 5.6 (V-01–V-07), K8/K9; [UI-Roadmap](ui-roadmap-2025-26.md) Phase X

## Kurzfassung

- **Profil wird rein persönlich:** wer angemeldet ist, Darstellung, Abmelden. Für Admins eine Zeile „Verwaltung“ mit Zähler wartender Nutzer.
- **„Nur lesen“ streichen.** Die Rolle steuert, ob jemand bearbeiten darf. Der Schalter ist heute doppelt belegt und fehlerhaft: Ein gespeicherter Wert schlägt die Rolle (Abschnitt 2.1). Sein Schutzzweck ist durch Menüs, Rückfragen und W.35 bereits abgedeckt.
- **Experten-Modus streichen.** Er schaltet nur YAML-Dateien und zwei Debug-Ansichten frei. Die YAML-Funktionen wandern an feste Orte (Admin), die Debug-Ansichten entfallen bzw. bleiben nur für Admins.
- **Verwaltung als Übersicht mit Unterseiten** im Stil der iOS-Einstellungen: Nutzer, Freigaben, KI-Import, Rezepte (Export/Import aus 11.1/11.2), Wartung. Die Rezeptliste der Verwaltung entfällt.
- **Speichermodell:** sofort speichern mit kurzer Bestätigung. Einzige Ausnahme: die KI-Modelle, weil das Backend sie bei OpenAI prüft.

Fakten stammen aus dem Code am Basis-Stand (Fundstellen genannt). Annahmen und Einschätzungen sind als solche gekennzeichnet.

---

## 1. Bestandsaufnahme

Häufigkeit ist eine Einschätzung für eine Familieninstallation mit wenigen Nutzern.

### 1.1 Profil (`/settings` → `views/ProfileView.vue`, alle angemeldeten Rollen)

| Element | Wer sieht es | Was es bewirkt (Code) | Häufigkeit | Art |
|---|---|---|---|---|
| Avatar-Symbol, Rollen-Badge | alle | Anzeige aus `recipeStore.settings.role`; `pending` erscheint als „Nur Lesen“, Admin rot (P-03). Kein Name, keine E-Mail (P-02) | jedes Öffnen | persönlich |
| Schalter „Nur lesen“ | alle; gesperrt für `readonly`, `pending` | setzt `settings.read_only`, gespeichert per `PUT /me/settings` (`store/recipeStore.ts` `saveSettings`); Wirkung siehe 2.1 | selten bis nie | persönlich, vermischt mit Rolle |
| Schalter „Experten-Modus“ | alle, auch `readonly` (dort wirkungslos) | setzt `settings.expert_mode`; Wirkung siehe 2.2 | einmalig | persönlich |
| Info „YAML-Import/Export, erweiterte Verwaltungsoptionen“ | bei Experten-Modus | nur Text; „erweiterte Verwaltungsoptionen“ trifft nicht zu, Wartung hängt an `read_only` | – | – |
| Erscheinungsbild Hell/Dunkel/System | alle | `useColorMode`, localStorage `my-cookbook-color-mode`, wirkt sofort; **je Gerät**, nicht je Nutzer | selten | persönlich (Gerät) |
| „Speichern“ | alle | speichert nur die beiden Schalter; ohne Klick gehen sie beim Tabwechsel still verloren (P-01) | – | – |
| Link „Benutzerverwaltung & Share-Links“ | `admin` | `router.push('/administration')` (P-05) | selten | Verwaltung |
| Abmelden | alle | Rückfrage, `auth/oidc.ts` `logout()` | selten | persönlich |
| Version | alle | `__COMMIT_HASH__` | Support | – |

### 1.2 Verwaltung (`/administration` → `views/Administration.vue`, Route `requireRole("admin")`)

Eine Seite, Abschnitte durch `<hr>` getrennt, ohne Kopfzeile und Zurück (V-05, V-06).

| Element | Wer | Was es bewirkt (Code) | Häufigkeit | Art |
|---|---|---|---|---|
| Hinweis „n Nutzer warten auf Freigabe“ | admin | `AdminUsers.vue`, nur hier sichtbar (P-04) | bei neuem Mitglied | Verwaltung |
| Nutzertabelle, Rolle per Select | admin | `PUT /admin/users/{id}/role` sofort beim Wählen, ohne Rückfrage, auch für den eigenen Account; Rollen englisch (V-02), dunkel unlesbar (V-03) | wenige Male im Jahr | Verwaltung |
| Max. Share-Laufzeit (Tage) | admin | `PUT /admin/settings` beim Verlassen des Felds (`AdminSettings.vue`) | einmalig | Verwaltung, gehört zu Freigaben |
| OpenAI-Key konfiguriert ja/nein | admin | Anzeige aus `GET /admin/settings` | bei Störung | Verwaltung |
| Modell Text/URL, Modell Foto, „Modelle speichern“ | admin | `PUT /admin/settings`; Backend prüft Verfügbarkeit bei OpenAI (422/503) | bei Modellwechsel | Verwaltung |
| „Verbindung testen“ | admin | `POST /admin/ai/test` | bei Störung | Verwaltung |
| Share-Links: Liste, Kopieren, Widerrufen | admin | `GET /admin/shares`, `DELETE /admin/shares/{id}` mit Rückfrage; Token statt Link, Kopieren 24 px (V-07) | selten | Verwaltung |
| „Bild-URLs migrieren“ | admin, nur ohne `read_only` | `POST /admin/migrate-images`, ohne Rückfrage; Altlast (V-04) | einmalig, vermutlich erledigt | Wartung |
| „Verwaiste Bilder bereinigen“ | admin, nur ohne `read_only` | `POST /admin/cleanup-images` + `/admin/strip-image-ids`, ohne Rückfrage | selten | Wartung |
| „Neues Rezept“, „Beispielrezept“ | admin, ohne `read_only` | `appendRecipe`; doppelt zum FAB (V-05) | nie nötig | Rezepte (Dublette) |
| „YAML Import“ | admin, ohne `read_only`, mit Experten-Modus | Datei → neues Rezept mit frischer UUID (`AdminRecipes.vue`) | selten | Rezepte |
| Rezeptliste: × Löschen, ⧉ Duplizieren | admin, ohne `read_only` | × löscht sofort und endgültig (V-01; Rückfrage kommt mit W.35); ⧉ legt Kopie an | – | Rezepte (Dublette zur Rezeptansicht) |
| Rezeptliste: ⬇ YAML-Export | admin, mit Experten-Modus | Download je Rezept | selten | Rezepte |
| „Speichern“ (IndexedDB), Strg+S | admin | `store.saveRecipes()` lokal; ohne erkennbaren Nutzen, entfällt mit 11.2 (V-04) | nie | Altlast |
| „Gesamtexport (ZIP)“ | admin | kommt mit 11.1 (in Arbeit) in `AdminRecipes.vue` | vor Umzügen, gelegentlich | Rezepte |

**Befund aus der Bestandsaufnahme:** Persönliches im Profil ist wenig (Darstellung, Abmelden, zwei fragliche Schalter). Die Verwaltung ist fachlich fünf Bereiche, die heute ohne Ordnung auf einer Seite stehen; rund ein Viertel ihrer Elemente sind Dubletten oder Altlasten.

---

## 2. „Nur lesen“ und Experten-Modus

> **Umgesetzt mit U.15** (E1 C, E2 B, E3 nein). Abweichung: „Teilen“ bleibt im ⋮-Menü an `canEdit`, weil Links anlegen und widerrufen im Backend `require_editor` verlangt.

### 2.1 „Nur lesen“ (`settings.read_only`)

**Was es ausblendet** (bei `read_only = true`):

| Stelle | Ausgeblendet |
|---|---|
| `views/HomeView.vue:299` | FAB komplett: Neues Rezept, AI-Import, Beispiel, YAML-Import |
| `views/HomeView.vue:197` | Inhalt des AI-Import-Dialogs |
| `RecipeCard.vue:174, 195, 308` über `RecipeGrid` (Home, Favoriten, Suche) | Favoriten-Stern, Kartenmenü (Tags, Bearbeiten, Löschen), Tag-Editor. Die kompakten „Zuletzt“-Karten zeigen beides ohnehin nicht. |
| `views/Recipe.vue:158` | Kopfaktionen: Stern und ⋮-Menü (Bearbeiten, Duplizieren, Teilen, YAML-Export, Löschen) |
| `views/Administration.vue:35, 39` | Neues Rezept, Beispiel, YAML-Import, × und ⧉ der Rezeptliste, beide Wartungsaktionen |

Nicht betroffen: die Route `/edit` (Guard nach Rolle, `router/index.ts`), alle Backend-Rechte.

**Zwei Bedeutungen in einem Feld:**
1. **Rollen-Sperre:** Für `readonly` und `pending` soll die Bearbeitung fehlen. Das Backend leitet den Wert nur als **Vorgabe** aus der Rolle ab: `read_only = raw.get("read_only", not can_edit)` (`backend/app/routes/me.py:17`).
2. **Persönlicher Schutzschalter** für Editoren und Admins.

**Fehler im heutigen Modell (abgeleitet aus dem Code, nicht live geprüft):** Sobald ein Nutzer einmal speichert, steht `read_only` fest in `app_user.settings` und schlägt die Rolle.
- Ein Editor, der zu `readonly` herabgestuft wird, behält `read_only = false`: Er sieht FAB, Kartenmenü und ⋮-Menü. `/edit` sperrt der Guard, das Backend lehnt Schreibzugriffe mit 403 ab. Ergebnis: tote Knöpfe.
- Ein `readonly`-Nutzer, der den Experten-Modus einmal gespeichert hat, sendet dabei `read_only = true` mit. Wird er zum Editor befördert, bleibt er im Nur-Lesen-Modus, bis er den Schalter findet.

**Zweck heute:** Für `readonly` ist er die Umsetzung der Rolle in der Oberfläche. Für andere soll er versehentliches Bearbeiten beim Kochen verhindern. Dieser Schutz ist inzwischen anders abgedeckt:
- In der Rezeptansicht gibt es keine Inline-Bearbeitung (UI-Roadmap: „Kein separates Inline-Edit. Nur Full-Editor.“). Bearbeiten, Duplizieren und Löschen liegen im ⋮-Menü, also zwei gezielte Tipps entfernt.
- Löschen fragt nach; nach W.35 dürfen Editoren nur eigene Rezepte löschen.
- Favoriten trennt W.35 ohnehin von `read_only` (H-01).

**Optionen:**

| | Option | Folgen Nutzer | Folgen Code | Aufwand |
|---|---|---|---|---|
| A | **Behalten und erklären:** „Bearbeiten ausblenden“ mit Untertitel, bei Sperre „Deine Rolle erlaubt nur Lesen“, sofort speichern | Schalter bleibt, wird verständlich; Editoren mit Küchen-Tablet können Bearbeiten ausblenden | Backend muss für `readonly`/`pending` den Wert erzwingen (Rolle schlägt Einstellung), sonst bleibt der Fehler oben. 9 Aufrufstellen bleiben an `read_only` | XS–S |
| B | **Umbauen zur Koch-Modus-Sperre** (Schloss in der Rezeptansicht) | Sperre gegen versehentliche Berührung beim Kochen | Neue Funktion. Schützt aber nichts Bearbeitbares, weil die Rezeptansicht nichts inline bearbeitet; sinnvoll wäre höchstens eine Berührungssperre für Portionen und Schritt-Markierung (U.3). Die Rollen-Sperre braucht trotzdem einen Ersatz wie in C | M |
| C | **Streichen, Rolle steuert:** Ein Helfer `canEdit` (Rolle `editor`/`admin`) ersetzt `settings.read_only` an allen Stellen | Kein Schalter mehr. Wer in der Familie nicht bearbeiten soll, bekommt die Rolle `readonly`; ein geteiltes Küchengerät meldet sich mit einem `readonly`-Konto an | Frontend: 9 Aufrufstellen auf `canEdit` (neben dem Löschrecht-Helfer aus W.35 in `auth/role.ts`). Backend: `read_only` in der Antwort von `/me/settings` immer aus der Rolle ableiten, gesendeten Wert ignorieren (für alte PWA-Clients im Schema belassen). Keine Migration (JSON-Spalte) | S |

**Empfehlung: C.** Begründung: Der Schalter vermischt Recht und Vorliebe, ist fehlerhaft und schützt nichts, was nicht schon geschützt ist. B ist eine andere Funktion unter altem Namen; falls eine Berührungssperre beim Kochen gewünscht ist, gehört sie als eigene Idee zu U.3, nicht als Ersatz für „Nur lesen“.

### 2.2 Experten-Modus (`settings.expert_mode`)

**Was er einblendet:**

| Stelle | Eingeblendet | Zusätzliche Bedingung |
|---|---|---|
| `views/HomeView.vue:330` | FAB „YAML Import“ | ohne `read_only` |
| `views/Recipe.vue:193` | ⋮ „YAML Export“ | ohne `read_only` |
| `views/Edit.vue:638` | „YAML anzeigen“ (nur lesbares Textfeld, Debug) | Editor-Route |
| `features/AIRecipeImport.vue:340` | „Rohantwort (JSON) anzeigen“ (Debug) | ohne `read_only` |
| `admin/AdminRecipes.vue:122, 146` | YAML-Import und YAML-Export je Rezept in der Verwaltung | `admin` |

**Ohne ihn unerreichbar:** jeder YAML-Import und -Export und die beiden Debug-Ansichten. Sonst nichts; die Wartung hängt nicht daran. Für `readonly` ist er wirkungslos.

**Zweck:** Funktionen verstecken, die Gelegenheitsnutzer verwirren würden. Die YAML-Dateien sind ein Austauschformat aus der Zeit vor der Datenbank; mit 11.1/11.2 wird das ZIP das Sicherungs- und Umzugsformat, der Einzel-Import bleibt (export-import.md).

**Optionen:**

| | Option | Folgen Nutzer | Folgen Code | Aufwand |
|---|---|---|---|---|
| A | **Behalten und erklären:** Untertitel mit der Liste oben, sofort speichern | unverändert, nur verständlicher | nur Text | XS |
| B | **Streichen, Funktionen an feste Orte nach Rolle:** YAML-Export im ⋮-Menü als „Als Datei exportieren“ für alle mit Bearbeitungsrecht; YAML-Import nur noch in Verwaltung › Rezepte über den Import aus 11.2 (nimmt `.zip` und `.yaml`); „YAML anzeigen“ im Editor entfällt; Rohantwort im KI-Import nur für `admin` | Editoren verlieren den YAML-Import im FAB; Admins finden Import/Export an einer Stelle | 5 Stellen ändern, Feld aus `Settings` und Profil entfernen; Backend-Schema toleriert das Feld weiter (`extra="ignore"`) | S |
| C | **Ersatzlos streichen:** alles hinter dem Schalter entfällt, YAML nur noch über 11.1/11.2 | einfachste Oberfläche; Einzelrezept per Datei weitergeben geht nicht mehr | wie B, weniger | XS–S |

**Empfehlung: B.** Ein Schalter für Funktionen, die man ein paarmal im Jahr braucht, wird vergessen; feste Orte nach Rolle sind auffindbar. Die Debug-Ansichten sind für Familiennutzer wertlos; die Rohantwort hilft dem Admin bei Fehlern im KI-Import und bleibt deshalb für ihn.

**Annahme zu prüfen:** Editoren nutzen den YAML-Import im FAB nicht oder kaum. Trifft das nicht zu, bleibt er im FAB für Editoren (dann ohne Schalter).

---

## 3. Informationsarchitektur

### 3.1 Profil (persönlich, alle Rollen)

```
┌─────────────────────────────────┐
│ Profil                          │
├─────────────────────────────────┤
│  ╭──╮  Lena Neumann             │
│  │LN│  lena@example.org         │
│  ╰──╯  Bearbeiter               │  ← Rolle deutsch, neutrale Farbe
│                                 │
│ DARSTELLUNG                     │
│ ┌─────────────────────────────┐ │
│ │ [ Hell ][ Dunkel ][System]  │ │  ← wirkt sofort, gilt für dieses Gerät
│ └─────────────────────────────┘ │
│   Gilt nur auf diesem Gerät.    │
│                                 │
│ ┌─────────────────────────────┐ │  ← nur admin
│ │ 🛡 Verwaltung        (1)  › │ │
│ │   Nutzer, KI, Freigaben …   │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Abmelden                    │ │  ← rot als Text, mit Rückfrage
│ └─────────────────────────────┘ │
│          Version a1b2c3d        │
├─────────────────────────────────┤
│  🏠     🔍     ⭐     👤(1)     │  ← Zähler nur für admin
└─────────────────────────────────┘
```

- Kopf: Name aus `/me` (`display_name`, liefert die API schon; `auth/role.ts` ruft `/me` bereits ab). E-Mail: `/me` liefert sie heute nicht, `app_user.email` existiert. Entweder `/me` additiv um `email` erweitern (kleine API-Änderung) oder den `email`-Claim des ID-Tokens nehmen (ob der IdP ihn liefert: unbestätigt). Empfehlung: `/me` erweitern, eine Quelle.
- `pending` zeigt „Wartet auf Freigabe“ statt einer Rolle (P-03).
- Für `pending`/`readonly` keine weiteren Elemente; nach Entscheidung 2 haben alle Rollen dieselbe Seite, Admins zusätzlich die Verwaltungszeile.
- Falls A bei einer der Entscheidungen 2.1/2.2 gewählt wird, kommt ein Abschnitt „Bedienung“ mit Listeneinträgen (ganzer Eintrag als Tippziel, Untertitel, sofort speichern) zwischen Darstellung und Verwaltung.

### 3.2 Verwaltung (nur `admin`)

**Übersicht** `/administration`:

```
┌─────────────────────────────────┐
│ ←  Verwaltung                   │  ← Zurück zum Profil (V-06)
├─────────────────────────────────┤
│ MITGLIEDER                      │
│ ┌─────────────────────────────┐ │
│ │ 👥 Nutzer     1 wartet   › │ │
│ └─────────────────────────────┘ │
│ REZEPTE                         │
│ ┌─────────────────────────────┐ │
│ │ 🔗 Freigaben  3 aktiv    › │ │
│ │ ───────────────────────────│ │
│ │ 📦 Export und Import      › │ │
│ └─────────────────────────────┘ │
│ SYSTEM                          │
│ ┌─────────────────────────────┐ │
│ │ 🤖 KI-Import   ✓ bereit  › │ │
│ │ ───────────────────────────│ │
│ │ 🧰 Wartung                › │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Unterseiten:**

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│ ←  Nutzer                       │   │ ←  Freigaben                    │
├─────────────────────────────────┤   ├─────────────────────────────────┤
│ WARTET AUF FREIGABE             │   │ ┌─────────────────────────────┐ │
│ ┌─────────────────────────────┐ │   │ │ Max. Laufzeit     30 Tage › │ │
│ │ Lena Neumann                │ │   │ └─────────────────────────────┘ │
│ │ lena@example.org · seit 2 T │ │   │ AKTIV                           │
│ │ [ Freischalten als … ▾ ]    │ │   │ ┌─────────────────────────────┐ │
│ └─────────────────────────────┘ │   │ │ Apfelkuchen                 │ │
│ MITGLIEDER                      │   │ │ von Chris · bis 12.12.      │ │
│ ┌─────────────────────────────┐ │   │ │ [Link kopieren] [Widerrufen]│ │
│ │ Chris E.      Admin       › │ │   │ └─────────────────────────────┘ │
│ │ Max E.        Bearbeiter  › │ │   │ ABGELAUFEN / WIDERRUFEN (2)  ▸  │
│ │ Oma           Leser       › │ │   └─────────────────────────────────┘
│ └─────────────────────────────┘ │
└─────────────────────────────────┘   ┌─────────────────────────────────┐
  › öffnet Detail: Rolle als Liste    │ ←  KI-Import                    │
  mit Häkchen, letzter Login;         ├─────────────────────────────────┤
  Rückfrage bei Herabstufung und      │ OpenAI-Schlüssel   ✓ gesetzt    │
  beim eigenen Konto (V-02)           │ MODELLE                         │
                                      │ Text/URL   [gpt-…           ]   │
┌─────────────────────────────────┐   │ Foto       [gpt-…           ]   │
│ ←  Export und Import            │   │ [ Speichern und prüfen ]        │
├─────────────────────────────────┤   │ ✓ Text: verfügbar               │
│ ┌─────────────────────────────┐ │   │ ✓ Foto: verfügbar               │
│ │ ⬇ Alle Rezepte exportieren  │ │   └─────────────────────────────────┘
│ │   ZIP mit Bildern (11.1)    │ │
│ │ ───────────────────────────│ │   ┌─────────────────────────────────┐
│ │ ⬆ Importieren …             │ │   │ ←  Wartung                      │
│ │   ZIP oder YAML (11.2)      │ │   ├─────────────────────────────────┤
│ └─────────────────────────────┘ │   │ ┌─────────────────────────────┐ │
└─────────────────────────────────┘   │ │ Verwaiste Bilder bereinigen │ │
                                      │ │ Entfernt Bilder ohne Rezept │ │
                                      │ └─────────────────────────────┘ │
                                      │  Rückfrage, danach Ergebnis     │
                                      └─────────────────────────────────┘
```

- **Unterseiten statt aufklappbarer Gruppen:** eigene Kindrouten (`/administration/nutzer` usw.). Vorteile: Zurück per Kopfzeile, jede Seite unter einer Bildschirmhöhe, verlinkbar (z. B. aus dem Zähler direkt in „Nutzer“). Nachteil: Router-Einträge und eine Kopfzeilen-Komponente; die Kopfzeile der Rezeptansicht (`view-header` in `Recipe.vue`) ist das vorhandene Muster. Tablet/Desktop: dieselbe Struktur; eine Zweispalten-Ansicht ist später möglich, aber kein Bedarf.
- **Max. Share-Laufzeit** wandert zu den Freigaben, wo sie wirkt. Die Seite „Einstellungen“ als Sammelbecken entfällt.
- **Entfällt:** Rezeptliste (× ⧉ ⬇), „Neues Rezept“, „Beispielrezept“, „Speichern“ (IndexedDB, Strg+S). Löschen und Duplizieren bleiben in der Rezeptansicht, Anlegen im FAB, der YAML-Export je Rezept im ⋮-Menü (Entscheidung 2.2). Damit erledigt sich V-01 strukturell.
- **„Bild-URLs migrieren“** entfällt, falls die Migration im Produktivbestand gelaufen ist. Betriebsfrage, Prüfung ohne Schreibzugriff: Gibt es noch Rezepte mit externen Bild-URLs?

### 3.3 Einstieg in die Verwaltung

In der Profilseite als Listeneintrag, nur für `admin`. Kein fünfter Tab: Die Verwaltung wird selten genutzt (Persona P3, „ohne Routine“), die Bottom Nav bleibt bei vier Tabs (UI-Roadmap Phase X). Bezeichnung „Verwaltung“ mit Untertitel „Nutzer, KI, Freigaben, Wartung“ (P-05).

### 3.4 Wartende Nutzer (P-04)

- Zähler am Profil-Tab, an der Zeile „Verwaltung“ und an „Nutzer“, nur für `admin`.
- Daten aus `GET /admin/users` (Anzahl `pending`), keine API-Änderung. Abruf einmal je Seitenaufruf mit gültiger Sitzung, dazu bei Rückkehr in den Vordergrund (Muster `refreshRoleOnce` in `auth/role.ts`); offline kein Zähler.
- Ein Tipp auf den Zähler bzw. die Zeile führt direkt zu „Nutzer“, Wartende oben.
- Benachrichtigung per Mail (n8n) oder Push: nicht in diesem Konzept; eigene Idee, falls Admins tagelang nicht in die App schauen.

---

## 4. Speichermodell

**Regel:** Einstellungen speichern sofort und bestätigen kurz (Toast „Gespeichert“ oder Häkchen am Eintrag); bei Fehler zurücksetzen und Meldung. Aktionen (Löschen, Bereinigen, Widerrufen, Herabstufen) fragen vorher nach. Ein „Speichern“-Knopf nur, wo eine Eingabe extern geprüft wird.

| Bereich | Modell | Begründung |
|---|---|---|
| Profil: Darstellung | sofort (wie heute) | lokal, umkehrbar |
| Profil: persönliche Schalter (nur falls Option A) | sofort, Toast | P-01: heute stiller Verlust; iOS-Muster |
| Nutzer: Rolle | sofort nach Auswahl; Rückfrage bei Herabstufung und beim eigenen Konto | Rechteänderung ist eine Aktion, Hochstufen harmlos |
| Freigaben: Max. Laufzeit | sofort beim Bestätigen (Auswahl oder Feld mit Grenzen 1–365) | ein Wert, serverseitig nur Bereichsprüfung |
| Freigaben: Widerrufen | Aktion mit Rückfrage (wie heute) | endgültig |
| KI-Import: Modelle | **„Speichern und prüfen“-Knopf**, danach Ergebnis je Modell | Backend prüft bei OpenAI (Netz, 422/503); zwei Felder bilden eine Einheit; Tippfehler sollen nicht bei jedem Zeichen geprüft werden. Speichern und Verbindungstest zusammenlegen |
| Wartung | Aktion mit Rückfrage und Ergebnis | löscht Daten (V-04) |
| Export/Import | Aktion; Import mit Konfliktwahl (11.2) | Datei-Vorgang |

Offen bleibt eine Kleinigkeit im Store: `saveSettings` schreibt offline nur in die IndexedDB, der nächste Abruf überschreibt den Wert vom Server. Mit Entscheidung 2.1 C und 2.2 B gibt es keine Server-Einstellungen im Profil mehr; das Problem entfällt.

---

## 5. Entscheidungen

| # | Frage | Empfehlung |
|---|---|---|
| E1 | „Nur lesen“: behalten (A), Koch-Modus-Sperre (B), streichen, Rolle steuert (C)? | **C** |
| E2 | Experten-Modus: behalten (A), streichen mit festen Orten nach Rolle (B), ersatzlos (C)? | **B** |
| E3 | Bei E2 B: YAML-Import auch für Editoren im FAB behalten? | nein, nur Admin über 11.2-Import; ja, falls Editoren ihn nachweislich nutzen |
| E4 | Verwaltung als Unterseiten (empfohlen) oder aufklappbare Gruppen auf einer Seite? | **Unterseiten** |
| E5 | Rezeptliste, „Neues Rezept“, „Beispielrezept“ aus der Verwaltung entfernen? | **ja** |
| E6 | „Bild-URLs migrieren“ entfernen? | ja, nach Prüfung des Bestands (Betriebsfrage) |
| E7 | E-Mail im Profil: `/me` erweitern oder ID-Token-Claim? | **`/me` erweitern** |
| E8 | Zähler wartender Nutzer am Profil-Tab (nur Admin)? Mail-Benachrichtigung? | Zähler ja; Mail als eigene Idee |
| E9 | Speichermodell: sofort speichern, Ausnahme KI-Modelle? | **ja** |

---

## 6. Folgen für die Roadmap

### 6.1 Neuer Punkt vor U.8: „Rolle statt Schalter“ (Vorschlag, ID vergibt der Master)

Umsetzung von E1 C und E2 B, quer über viele Ansichten; deshalb nicht in U.8.
- Frontend: `canEdit` aus der Rolle an den 9 Aufrufstellen von `settings.read_only`; `expert_mode` an 5 Stellen ersetzen bzw. entfernen; `types/settings.ts`, `recipeStore` (`default_settings`, `saveSettings`).
- Backend: `me.py` leitet `read_only` immer aus der Rolle ab; `expert_mode` in der Antwort konstant `false` für alte PWA-Clients, im Schema tolerieren. Test für herabgestufte und beförderte Nutzer.
- Behebt den Fehler aus 2.1 (gespeicherter Wert schlägt Rolle).
- Aufwand **S**. Nach W.35 (gleiche Dateien `Recipe.vue`, `RecipeCard.vue`, Helfer in `auth/role.ts`); mit U.3 abstimmen (`Recipe.vue`).

### 6.2 U.8 Profil

- Umfang: Kopf mit Name, E-Mail, Rolle (P-02, P-03), Darstellung mit Hinweis „dieses Gerät“, Verwaltungszeile mit Untertitel und Zähler (P-05, P-04), Zähler am Profil-Tab (`BottomNav.vue`), Abmelden. `views/Settings.vue` löschen (P-06).
- Entfällt bei E1 C und E2 B: P-01 (nichts mehr zu speichern), P-03 bis auf Badge und `pending`-Text.
- Neu: `/me` um `email` erweitern (E7), additiv.
- Aufwand bleibt **S**, eher kleiner; nach dem Punkt aus 6.1.

### 6.3 U.9 Verwaltung

- Umfang: Übersicht und fünf Unterseiten als Kindrouten mit Kopfzeile und Zurück (V-05, V-06); Nutzer als Kartenliste mit „Freischalten als …“, Rollen-Detail, Rückfragen (V-02), Farben über Tokens (V-03); Freigaben als Karten mit Link statt Token und Max. Laufzeit (V-07); KI-Import mit „Speichern und prüfen“; Wartung mit Rückfragen (V-04); Rezeptliste und Dubletten entfernen (E5).
- Entfällt: V-01 strukturell (W.35 bringt vorher die Rückfrage); V-04 teils (IndexedDB-„Speichern“ entfällt mit der Liste statt erst mit 11.2); V-05 „doppelte Rezeptaktionen“.
- Neu: Kopfzeilen-Komponente für Unterseiten. Falls U.11 bis dahin eine gemeinsame Kopfzeile oder Dialoge liefert, diese nutzen.
- Aufwand **M** bleibt. `Administration.vue` wird Übersicht, `components/admin/*` werden Seiteninhalte; `AdminRecipes.vue` schrumpft auf Export/Import.

### 6.4 11.1 und 11.2

- **Ort:** Verwaltung › „Export und Import“. Export (11.1) und Import (11.2, ZIP und einzelne YAML-Datei) als zwei Aktionen auf dieser Seite.
- **11.1** (in Arbeit) setzt den Knopf in `AdminRecipes.vue`; U.9 übernimmt ihn unverändert auf die Unterseite. Kein Nachzug an 11.1 nötig.
- **11.2:** Das Entfernen des IndexedDB-„Speichern“ erledigt U.9 mit der Rezeptliste; 11.2 baut nur noch den Import auf der neuen Seite. Der Einzel-Import aus der Verwaltung ersetzt den YAML-Import hinter dem Experten-Modus (E2 B).
- **Reihenfolge:** 11.1 → U.9 → 11.2. Alle drei ändern `AdminRecipes.vue`; so baut 11.2 seine Oberfläche gleich am endgültigen Ort.
