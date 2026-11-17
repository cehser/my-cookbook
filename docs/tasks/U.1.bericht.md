# Bericht U.1: UX-Audit von Rezeptansicht, Bearbeitung, Profil und Verwaltung

> Branch `worktree-U.1-ux-audit` · Basis `c9c7858` · Stand siehe letzter Commit · 2026-11-17 · Dauer: 00:26 – 01:05 (39 min, davon Warten an Checkpoints 3 min) · Status: fertig

## Ergebnis
- [docs/plans/ux-audit.md](../plans/ux-audit.md) enthält 61 Befunde, sortiert nach Ansicht und Schweregrad. Jeder Befund hat Beleg, Vorschlag und Aufwand.
- Außerdem: Personas, Cognitive Walkthrough für 9 Kernaufgaben, WCAG-Prüfung mit Werkzeug und Version, Abweichungen vom UI-Plan, Hinweise an offene Punkte, Bündelungsvorschlag U.2–U.11 und eine Liste der Stärken.
- Die Screenshots liegen unter [docs/plans/ux-audit/](../plans/ux-audit/): 86 Bilder, 6,2 MB.
- Wichtigste Befunde:
  - Stufe 4: Das × in der Rezeptliste der Verwaltung löscht ohne Rückfrage (V-01).
  - Stufe 3, Kochen: „Nur aktuell“ zeigt alle Abschnitte (R-01); der Bildschirm bleibt nicht an (R-02); Notizen und HACCP werden nie angezeigt (R-03).
  - Stufe 3, Rechte: Nutzer mit Rolle `readonly` können keine Favoriten setzen (H-01); Editoren können scheinbar löschen, ohne Fehlermeldung (H-02).
  - Stufe 3, Bearbeiten: ✕ verlässt den Editor ohne Rückfrage (E-01); „Neues Rezept“ legt sofort auf dem Server an (H-03, Hinweis an 7.1).

## Commits
- `6139f53` docs(frontend): Screenshots für das UX-Audit ablegen
- `bb15a79` docs(frontend): UX-Audit von Rezept, Bearbeitung, Profil und Verwaltung
- dieser Bericht

## Verifikation
- Kein Produktivcode geändert. `git diff --name-only c9c7858..HEAD` zeigt nur `docs/plans/ux-audit*` und diesen Bericht. Die Verifikation aus der Projekt-CLAUDE.md (Lint, Typecheck, Tests) habe ich deshalb nicht ausgeführt. Einen Check-Skill nennt das Projekt nicht.
- `npm ci && npm run build` im Worktree → grün; das ist der Build, der im Browser geprüft wurde.
- Sichtprüfung im Browser:
  - Aufbau: Production-Build hinter eigenem Node-Server mit Mock-IdP und Mock-API, Edge 156 headless über playwright-core 1.65.1.
  - Ergebnis: 83 Zustände, 0 Fehlschläge.
  - axe-core 4.14.1 auf 9 Zuständen, jeweils iPhone hell, iPhone dunkel und Tablet hell.
  - Gemessen: alle Touch-Ziele und Schriftgrößen der Eingaben.
  - Dazu 14 Verhaltensproben, P1–P14; zwei davon (Komma in der Menge, Kopieren beim Teilen) ließen sich headless nicht prüfen und stehen als „am Gerät prüfen“ im Audit.
- Prüfzeit:
  - Screenshot-Lauf mit axe und Messung: 5 min 33 s (`time`).
  - Proben und Komprimierung: nicht gemessen.
  - Größter Posten: der Screenshot-Lauf.
- Prüfskripte: nur im Scratchpad unter `C:\Users\ce\AppData\Local\Temp\claude\beb48852c7fd70f3\3d06a29f-6b90-4fb8-abf2-be02074600a4\scratchpad\ux\`:
  - `server.mjs`, `fixtures.mjs`, `lib.mjs`, `shoot.mjs`, `probe.mjs`, `quant.py`, `flat.py`
  - Ergebnisse: `axe.json`, `targets.json`, `probe.json`
  - `playwright-core` aus dem Scratchpad von W.23/W.25 (`ac617081-…`), `axe-core` im eigenen Scratchpad
  - Keine Projektabhängigkeit.

## Struktur und Doku
- Neu: `docs/plans/ux-audit.md` (rund 900 Zeilen), `docs/plans/ux-audit/*.png`. Kein Code.
- CLAUDE.md und Rules: stimmen noch. `.claude/rules/frontend.md` nennt die Sperre des Pinch-Zooms als bewusst; das Audit stellt sie als Befund X-05 zur Entscheidung, die Regel bleibt bis dahin gültig.

## Mitgenommen
- nichts. A-01 (`hide-footer` → `no-footer`, XS) wäre tauglich gewesen, ist aber Produktivcode und nach dem Auftrag ausgeschlossen.

## Abweichungen vom Auftrag
- **Worktree:** `EnterWorktree` mit Namen lehnte ab, offenbar wegen `c:\` gegenüber `C:\` im Pfad, hat den Worktree aber angelegt. Ich bin über den Pfad hineingewechselt.
- **Größe der Screenshots:** Die Frage „wieso nur 10 MB?“ habe ich am Checkpoint beantwortet; die Grenze stammt aus dem Auftrag. Eine neue Grenze kam nicht. In voller Auflösung (DPR 3 bzw. 2) und mit 256 Farben ergeben sich 6,2 MB, die Frage hat sich damit erledigt.
- **Tablet mit DPR 2:** Der Auftrag nennt DPR 3 nur für das iPhone.
- **Lighthouse nicht eingesetzt:** Sein Accessibility-Teil beruht ebenfalls auf axe-core; so am Checkpoint vorgelegt und freigegeben.
- **ui-roadmap-2025-26.md nicht korrigiert:** Sie weicht an acht Stellen von der Wirklichkeit ab (Abschnitt 7 des Audits). Die Datei liegt außerhalb der erlaubten Ablage (`docs/plans/ux-audit*`). Vorschlag an den Master steht im Audit.

## Nachgetragen in Specs/Plänen
- nichts außerhalb des Audits; die Abweichungen sind in Abschnitt 7 des Audits gelistet.

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- Bündel U.2–U.11 laut Abschnitt 9 des Audits. Empfohlene Reihenfolge: U.2 (Löschen und Rechte, S) → U.3 (Koch-Modus, M) → U.5 (Editor, M) → U.4 (Rezeptinhalt, S–M) → U.10 (Tokens, nach W.15) → U.11 → U.6 → U.9 → U.8 → U.7.
- Vor dem Zuschnitt zu entscheiden:
  - Zoom-Sperre (X-05)
  - Schrittnummerierung (R-13)
  - Zeiten als Zahl, ein Schemathema (R-08)
  - Glossar (X-06)
- Hinweise an 7.1, 6.1, 10.1, W.34, W.15 und 11.2: Abschnitt 8 des Audits.
- `views/Settings.vue` ist toter Code (P-06), Folgepunkt Aufräumen · XS.
- Gerätetest nach Abschnitt 11 des Audits, 11 Punkte, vor allem Wake Lock, Zoom und Zwischenablage.

## Status je Roadmap-Punkt
- `U.1` fertig

## Vorschlag Roadmap-Zeilen
`- [x] U.1 UX-Audit Rezept, Bearbeitung, Profil, Verwaltung → docs/plans/ux-audit.md · 2026-11-17 · <SHA des Bericht-Commits>`
