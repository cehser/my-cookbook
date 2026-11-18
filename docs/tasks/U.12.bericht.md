# Bericht U.12: Konzept Profil und Verwaltung

> Branch `worktree-U.12-konzept-profil-verwaltung` · Basis `b98024f` (HEAD bei Start `66a2125`, nur `docs(roadmap)`) · Stand `cd3dfb7` · 2026-11-18 · Dauer: 08:59 – 09:05 (6 min laut `date`, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Die Entscheidungsvorlage [konzept-profil-verwaltung.md](../plans/konzept-profil-verwaltung.md) liegt vor: Bestandsaufnahme aller Elemente in Profil und Verwaltung, je drei Optionen zu „Nur lesen“ und Experten-Modus mit Empfehlung, iPhone-Skizzen für Profil, Verwaltungsübersicht und fünf Unterseiten, Speichermodell, neun Entscheidungen (E1–E9) und die Folgen für U.8, U.9, 11.1 und 11.2.

Kernempfehlungen: „Nur lesen“ streichen, stattdessen steuert die Rolle (E1 C). Den Experten-Modus streichen und die YAML-Funktionen an feste Orte nach Rolle legen (E2 B). Die Verwaltung wird eine Übersicht mit Unterseiten, die Rezeptliste entfällt (E4, E5). Speichern erfolgt sofort, außer bei den KI-Modellen (E9).

## Commits
- `cd3dfb7` docs(roadmap): Konzept Profil und Verwaltung

## Verifikation
- Keine Code-Änderung, die Verifikation der Projekt-CLAUDE.md ist nicht anwendbar.
- `git diff --name-only b98024f..HEAD` → nur `docs/plans/konzept-profil-verwaltung.md` (außer Master-Commits)
- Fundstellen im Konzept per `git grep` und Lesen der Dateien am Basis-Stand geprüft. Live- bzw. Gerätetests: keine.
- Sichtprüfung: keine
- Prüfzeit: ~1 min; größter Posten: Gegenprüfung der Fundstellen
- Prüfskripte: keine

## Struktur und Doku
- Neue Datei `docs/plans/konzept-profil-verwaltung.md` (~320 Zeilen)
- Aussagen in CLAUDE.md und Rules: stimmen noch

## Mitgenommen
- nichts

## Abweichungen vom Auftrag
- keine. Zur Option „Koch-Modus-Sperre“ widerspricht das Konzept: Die Rezeptansicht bearbeitet nichts inline, eine Sperre dort würde also nichts schützen.

## Nachgetragen in Specs/Plänen
- `docs/plans/konzept-profil-verwaltung.md`: neu

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Fehler im heutigen Code** (aus dem Code abgeleitet, nicht live geprüft): `me.py:17` nimmt die Rolle nur als Vorgabe für `read_only`, ein gespeicherter Wert hat Vorrang. Folgen:
  - Ein herabgestufter Editor sieht weiter die Bearbeiten-Knöpfe, die dann ins Leere laufen.
  - Ein beförderter `readonly`-Nutzer bleibt im Nur-Lesen-Modus, wenn er je Einstellungen gespeichert hat.
  - Behoben wird das mit dem neuen Punkt unten bzw. mit Option A.
- **Neuer Punkt „Rolle statt Schalter“** (E1 C + E2 B): `canEdit` an 9 Aufrufstellen, `expert_mode` an 5 Stellen, `me.py` leitet ab, Test. Aufwand S, Opus, nach W.35 und vor U.8, mit U.3 abstimmen.
- **Reihenfolge 11.1 → U.9 → 11.2** (alle drei ändern `AdminRecipes.vue`)
- **Betriebsfrage zu E6:** Ist „Bild-URLs migrieren“ im Bestand erledigt? Lesend prüfen, ob es noch Rezepte mit externen Bild-URLs gibt.
- **Unbestätigt:** Liefert der IdP den Claim `email` im ID-Token? Bei E7 mit `/me`-Erweiterung irrelevant.
- **Idee, optional:** Mail an Admins bei wartenden Nutzern über n8n (E8)

## Status je Roadmap-Punkt
- `U.12` fertig

## Vorschlag Roadmap-Zeilen
`- [x] U.12 Konzept Profil und Verwaltung · 2026-11-18 · cd3dfb7`
