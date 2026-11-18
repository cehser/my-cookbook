# Bericht U.13: Konzept Editor für Gelegenheitsnutzer

> Branch `worktree-U.13-konzept-editor` · Basis `92355ed` (Auftrag: `dffd720`, dazwischen nur `docs(roadmap)`) · Stand siehe Commits · 2026-11-18 · Dauer: 20:58 – 21:07 (9 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
[docs/plans/konzept-editor.md](../plans/konzept-editor.md) liegt als Entscheidungsvorlage vor. Inhalt: neue Persona P4 und Aufgaben, Bestandsaufnahme je Bedienelement mit Zielgröße und Befund, Datenmodell der Abschnitte, je drei Optionen mit Empfehlung zu den vier Reizpunkten und sieben iPhone-Skizzen. Dazu die Abgrenzung zu 7.1, U.7, U.14 und 12.1, 14 Entscheidungen (D1–D14) und ein Neuzuschnitt von U.5/U.6 nach Bereichen. Das Datenmodell bleibt, eine Migration ist nicht nötig.

## Commits
- `9531d02` docs(frontend): Konzept Editor für Gelegenheitsnutzer
- (dieser Bericht) docs(frontend): Bericht U.13

## Verifikation
- Reines Doku-Ergebnis, kein Code geändert. Die Frontend- und Backend-Verifikation der Projekt-CLAUDE.md ist deshalb nicht gelaufen.
- Fakten aus dem Code am Basis-Stand gelesen, mit Fundstellen im Dokument. Die neuen Befunde E-12, E-13, E-14 und E-17 sind aus dem Code abgeleitet, **nicht live geprüft**.
- Pre-commit-Hook beim Commit durchgelaufen. Markdown-Lint in der IDE meldet nur Stilwarnungen (MD022, MD032, MD060) wie bei den vorhandenen Plänen.
- Sichtprüfung: zwei Audit-Screenshots als Referenz angesehen, keine neuen Screenshots.
- Prüfzeit: ~0 min
- Prüfskripte: keine

## Struktur und Doku
- Neu: `docs/plans/konzept-editor.md` (~560 Zeilen). Keine Code-Dateien.
- Berührte Aussagen in CLAUDE.md und Rules: stimmen noch.

## Mitgenommen
- nichts

## Abweichungen vom Auftrag
- `EnterWorktree` mit Namen lehnte den Worktree wegen eines vermeintlichen `core.worktree`-Redirects ab (Groß-/Kleinschreibung des Laufwerks `c:` gegenüber `C:`, vermutet). Er war trotzdem korrekt angelegt, und die Sitzung lief darin (`git-dir` ≠ `git-common-dir` geprüft). Auf die Arbeit hatte das keine Auswirkung.

## Nachgetragen in Specs/Plänen
- `docs/plans/konzept-editor.md`: neu

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- Die Entscheidungen D1–D14 (Konzept Abschnitt 7) trifft der PO.
- Vorschläge an die Roadmap (Konzept Abschnitt 8):
  - U.5 neu: „Editor: Rahmen und Kopf“ · M · nach U.11
  - U.6 neu: „Editor: Rezeptinhalt“ inkl. E-12/E-13/E-14/E-17 · M–L, optional geteilt in U.6a Zeilen und U.6b Abschnitte · nach U.5, R-13 vorher entscheiden
  - U.11 vor U.5 ziehen
  - 7.1 neu schneiden als „Anlegen erst beim Speichern, ein Anlegeweg“ (H-03, A-02, Duplizieren), Wizard entfällt · M · nach U.6
  - U.14 übernimmt `TagPicker` aus U.5
  - U.10: Editor-Begriffe ins Glossar
- Optional vorab, falls U.6 lange wartet: E-12/E-13 als Datenfehler-Vorbeugung (Normalisieren beim Laden, eindeutige Abschnittsnamen) · XS–S
- Ideen für `docs/IDEAS.md`:
  - „Zutatenliste einfügen“ mit Zerlegung
  - Tag-Schreibweisen im Bestand vereinheitlichen (Backend legt „Kuchen“ und „kuchen“ getrennt an)
  - Brüche in der Rezeptansicht
- Hinweis: `composables/useUnsavedGuard.ts` ist ungenutzt; U.5 ersetzt es.
- Kosmetisch: `EnterWorktree` und das Laufwerk `c:` (siehe Abweichungen). Bei Wiederholung als Befund für die Claude-Code-Konfiguration prüfen.

## Status je Roadmap-Punkt
- `U.13` fertig

## Vorschlag Roadmap-Zeilen
`- [x] U.13 Konzept Editor für Gelegenheitsnutzer ([Konzept](docs/plans/konzept-editor.md)): Abschnitte nur bei Bedarf, Zutatzeile einzeilig, Tag-Sheet, Kopfleiste mit Verlassen-Sheet; D1–D14 offen; neue Befunde E-12/E-13/E-14/E-17 · 2026-11-18 · 9531d02`
