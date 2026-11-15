# Bericht W.27: `Administration.vue` aufteilen, Undo/Redo als Composable

> Branch `worktree-W.27-admin-undo` · Basis `d54f150` (HEAD beim Start `d8ee3c0`, nur `docs(roadmap)` dazwischen) · Stand `178a074` · 2026-11-15 · Dauer: 21:57 – 22:17 (20 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
`Administration.vue` ist von 669 auf 44 Zeilen geschrumpft und bindet fünf Abschnittskomponenten unter `src/components/admin/` ein; die Sichtbarkeitsregeln stehen nur noch in der Seite. Undo/Redo samt Tastenkürzeln liegt in `useEditHistory`, `Edit.vue` (711 → 678 Zeilen) übergibt nur noch Entwurf und Dirty-Snapshot über den Hook `onLoaded`. Die Lade-Reihenfolge (Laden und Entwurf nicht rückgängig zu machen) ist per Test abgesichert, `useDraft.spec.ts` räumt ab.

## Commits
- `1da343b` refactor(frontend): Undo/Redo der Bearbeitung als useEditHistory
- `29defb1` test(frontend): useDraft-Spec baut gemountete Instanzen ab
- `b39d1d5` refactor(frontend): Verwaltung in Abschnittskomponenten aufteilen
- `178a074` docs(frontend): Plan Export/Import auf AdminRecipes verweisen

## Verifikation
- `npm run lint:check && npm run typecheck && npm test && npm run build` → grün; 13 Testdateien, 87 Tests (vorher 8 Dateien), Build 3,08 s
- Gegenproben: Reset beim Laden entfernt → 6 von 11 `useEditHistory`-Tests rot; `reset()` nach dem Entwurf entfernt → Entwurfstest rot; beforeunload-Listener in `useDraft` entfernt → beforeunload-Test rot
- Sichtprüfung: keine. Die Verwaltung ist nur als `admin` erreichbar (`requireRole("admin")`), die Bearbeitung nur ab `editor`; im Worktree gibt es weder `frontend/.env.local` (OIDC) noch ein laufendes Backend. Ersatz: Komponententests für Sichtbarkeit (`Administration.spec.ts`), Einstellungen, Benutzer.
- Szenarien für deine Sichtprüfung:
  1. Verwaltung als Admin: Benutzerliste mit Hinweis auf wartende Nutzer, Rolle wechseln (Toast), Fehlerfall (z. B. Backend aus) setzt die Auswahl zurück.
  2. Einstellungen: Share-Laufzeit ändern und Feld verlassen (Toast „Einstellungen gespeichert“), Modelle speichern, ungültiges Modell (Fehlertoast, Feld springt zurück), „Verbindung testen“ mit und ohne Key.
  3. Share-Links: Liste, Link kopieren, widerrufen.
  4. Knopfleiste: „Bild-URLs migrieren“ und „Verwaiste Bilder bereinigen“ stehen weiter in **einer** Reihe vor „Neues Rezept“/„Beispielrezept“/„YAML Import“ (letzterer nur mit Expertenmodus); Rezeptliste mit Löschen/Kopieren/Export; „Speichern“ und Strg+S.
  5. Mit `read_only`: keine Wartungs- und Anlegeknöpfe, kein Löschen/Kopieren. Als Editor ist die Route gesperrt (unverändert); die Sichtbarkeitsregeln selbst sind per Test geprüft.
  6. Bearbeitung: Feld ändern, ~0,5 s warten, Strg+Z/Strg+Y, Strg+Umschalt+Z (bzw. Cmd auf macOS), Knöpfe Rückgängig/Wiederherstellen; direkt nach dem Öffnen ist Rückgängig deaktiviert.
  7. Entwurf: Rezept ändern, Seite neu laden → „Entwurf wiederhergestellt.“, Rückgängig bleibt deaktiviert, „Änderungen verwerfen“ ist aktiv; „Änderungen verwerfen“ lädt das Original, Verlauf leer.
- Prüfzeit: ~1 min (Gesamtlauf 1:08 min); größter Posten: `npm test` 15 s plus `vue-tsc`
- Prüfskripte: wiederholbar als Specs im Repo (`useEditHistory.spec.ts`, `components/admin/*.spec.ts`, `views/Administration.spec.ts`)

## Struktur und Doku
- Neue Module: `src/composables/useEditHistory.ts`, `src/components/admin/{AdminUsers,AdminSettings,AdminShares,AdminMaintenance,AdminRecipes}.vue`, `src/components/admin/format.ts` (`formatDate`, von Benutzern und Share-Links geteilt statt kopiert). Größte neue Datei: `AdminSettings.vue` (~190 Zeilen, davon gut die Hälfte Template).
- `Edit.vue` bleibt mit 678 Zeilen groß; weitere Aufteilung war nicht beauftragt (W.28 folgt).
- Bewusste Duplikate: keine. `formatDate` existiert ähnlich in `ShareManager.vue` und `SharedRecipe.vue` (vorher schon); nicht angefasst, außerhalb des Scopes.
- `AdminMaintenance` hat zwei Wurzelknoten (Fragment) und wird über den Slot `actions` in die Knopfleiste von `AdminRecipes` gesetzt, damit die Knöpfe wie bisher in einem Flex-Container stehen.
- CLAUDE.md, Rules: stimmen noch. Plan `export-import.md` nachgetragen.

## Mitgenommen
- nichts

## Abweichungen vom Auftrag
- **Test „Speichern schickt alle Felder“ nicht wie formuliert umgesetzt.** Der W.12-Fallstrick ist im Backend bereits gelöst: `PUT /admin/settings` nutzt `model_dump(exclude_unset=True, exclude_none=True)` und merged in die gespeicherten Daten (`backend/app/routes/admin.py:91-100`). Alle Felder zu senden würde schaden: Bei jedem Speichern der Share-Laufzeit prüfte das Backend die Modelle bei OpenAI (ohne Key 503, Speichern schlägt fehl). Der Test sichert stattdessen den Ist-Vertrag: Share-Laufzeit allein, beide Modelle zusammen, Rücksetzen nach Ablehnung. Kommentar dazu in `AdminSettings.vue`.
- Ladezeitpunkt: Einstellungen und Share-Links wurden bisher bei jedem Mount geladen, auch ohne Admin-Rolle (Fehler stumm ignoriert). Jetzt laden die Komponenten nur, wenn sie per `v-if` sichtbar sind. Sichtbar ändert sich nichts; die Route ist ohnehin admin-only.
- Zusätzlicher Test `views/Administration.spec.ts` für die Sichtbarkeitsregeln (Fallstrick „Rollen und Sichtbarkeit“).
- `useEditHistory` ruft nach dem Laden `onLoaded` auf; den Entwurf stellt `Edit.vue` dort wieder her und ruft `reset()`. Das Setzen des Dirty-Snapshots liegt dadurch nach statt vor `commit(); clear()` – reiner String, ohne Wirkung auf den Verlauf.

## Nachgetragen in Specs/Plänen
- `docs/plans/export-import.md`: Rezeptverwaltung liegt in `components/admin/AdminRecipes.vue`

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- Sichtprüfung der Szenarien oben durch dich (Login nötig).
- `formatDate`-Varianten (`ShareManager.vue`, `SharedRecipe.vue`, `components/admin/format.ts`) nach `src/js/` zusammenführen. Aufwand XS.
- Worktree-Anlage: `EnterWorktree` mit Namen scheiterte an `c:` vs. `C:` im Pfad (legte den Worktree an, verweigerte dann den Eintritt); Eintritt per Pfad ging. Betrifft die Werkzeugkette, nicht das Projekt.

## Status je Roadmap-Punkt
- `W.27` fertig (Sichtprüfung ausstehend)
- `W.29` fertig (Sichtprüfung ausstehend)

## Vorschlag Roadmap-Zeilen
`- [x] W.27 Administration.vue in Abschnittskomponenten aufteilen · 2026-11-15 · b39d1d5`
`- [x] W.29 Undo/Redo als Composable useEditHistory · 2026-11-15 · 1da343b`
