# Auftrag U.12: Konzept Profil und Verwaltung

> Erstellt 2026-11-18 vom Master · Roadmap: `ROADMAP.md` Punkt U.12 · Basis: `main@b98024f` · Aufwand: S · Modell: Opus

## Ziel
Eine Entscheidungsvorlage, wie Profil und Verwaltung künftig aufgebaut sind: was persönlich ist und was Verwaltung, wie sich beides gliedert, und ob „Nur lesen“ und der Experten-Modus bleiben, umgebaut oder gestrichen werden. Grundlage für U.8 (Profil) und U.9 (Verwaltung). Kein Code.

## Erst lesen
1. `docs/plans/ux-audit.md` – Abschnitt 5.5 (P-01 bis P-05), 5.6 (V-01 bis V-07), K8/K9 im Walkthrough, Screenshots `iphone-*-profil*`, `*-verwaltung*`
2. `docs/plans/ui-roadmap-2025-26.md` – „Phase X: UX-Gesamtkonzept“ (Bottom Nav, Tab Profil)
3. `frontend/src/views/ProfileView.vue`, `views/Administration.vue`, `components/admin/*`, `router/index.ts` (Rollen), `auth/role.ts`
4. Wo `read_only` und `expert_mode` im Code wirken: `git grep -n "read_only\|expert_mode" frontend/src backend/app`
5. Backend: `app/routes/me.py` (Settings, `read_only` für `readonly`), `app/routes/admin.py` (Site-Settings)

## Auftrag
1. **Bestandsaufnahme:** Jede Einstellung und Aktion in Profil und Verwaltung. Tabelle mit diesen Spalten:
   - wer sie sieht (Rolle)
   - was sie bewirkt (Code-Stelle)
   - wie oft man sie braucht (Einschätzung)
   - persönlich oder Verwaltung
2. **„Nur lesen“ und Experten-Modus:**
   - Was blendet jede der beiden Einstellungen konkret ein oder aus? Liste der Stellen.
   - Welchen Zweck erfüllt sie? Hinweis: „Nur lesen“ ist für die Rolle `readonly` erzwungen, für andere ein Schutz vor versehentlichem Bearbeiten beim Kochen.
   - Je Einstellung 2–3 Optionen mit Folgen für Code und Nutzer:
     - behalten und erklären
     - umbauen, z. B. „Nur lesen“ als Koch-Modus-Sperre in der Rezeptansicht statt als Profil-Schalter
     - streichen, mit Ersatz
   - Mit Empfehlung.
3. **Informationsarchitektur:**
   - **Profil** als persönliche Seite: Darstellung, angemeldeter Nutzer, persönliche Schalter, Abmelden.
   - **Verwaltung** nur für Admins, gegliedert in Gruppen bzw. Unterseiten: Nutzer, KI, Freigaben, Wartung, Rezepte (Export/Import aus 11.1/11.2).
   - Je eine Skizze für iPhone als ASCII bzw. Markdown, Stil der iOS-Einstellungen.
   - Wo steht der Einstieg in die Verwaltung?
   - Wie erfährt ein Admin von wartenden Nutzern (P-04)?
4. **Speichermodell:** einheitlich sofort speichern mit kurzer Bestätigung oder „Speichern“-Knopf, je Bereich begründet (P-01, V-04).
5. **Ergebnis** `docs/plans/konzept-profil-verwaltung.md`:
   - Bestandsaufnahme, Optionen mit Empfehlung, Skizzen
   - Liste der Entscheidungen für mich, je mit Empfehlung
   - Folgen für U.8 und U.9: Umfang, Aufwand, neue oder entfallende Befunde
   - Folgen für 11.1/11.2: wo Export und Import künftig sitzen

## Ablage
- Neu: `docs/plans/konzept-profil-verwaltung.md`. Kein Code, keine Screenshots nötig; vorhandene aus `docs/plans/ux-audit/` verlinken

## Nicht in diesem Auftrag
- Umsetzung (U.8, U.9)
- Rollenmodell ändern (pending < readonly < editor < admin bleibt)
- Rechte für Löschen und Favoriten (W.35)

## Entscheidungen, die ich treffe
- Nach dem Bericht: die Optionen aus Schritt 2 bis 4.

## Fallstricke
- **`read_only` doppelt belegt:** Das Backend setzt `read_only` für die Rolle `readonly` (`me.py`). Gleichzeitig ist es ein Nutzer-Schalter. W.35 trennt Favoriten davon ab. Das Konzept muss beide Bedeutungen auseinanderhalten.
- **Experten-Modus** blendet laut Audit u. a. YAML-Funktionen ein. Prüfen, was ohne ihn unerreichbar würde; 11.2 ersetzt den YAML-Einzelimport später.
- **Abgleich mit dem PO:** Dessen Eindruck ist, dass die Admin-Elemente „lieblos zusammengeklatscht“ wirken und mit persönlichen Einstellungen vermischt sind, und dass „Nur lesen“ und Experten-Modus fraglich sind. Das ist der Anlass für dieses Konzept und kein Maßstab, der andere Befunde verdrängen soll.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `docs/plans/konzept-profil-verwaltung.md` mit Bestandsaufnahme, Optionen und Empfehlungen zu „Nur lesen“ und Experten-Modus, Skizzen für Profil und Verwaltung, Speichermodell, Entscheidungsliste, Folgen für U.8/U.9/11.x
- Keine Änderungen außerhalb von `docs/plans/konzept-profil-verwaltung.md` und dem Bericht
