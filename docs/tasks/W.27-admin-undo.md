# Auftrag W.27: `Administration.vue` aufteilen, Undo/Redo als Composable

> Erstellt 2026-11-15 vom Master · Roadmap: `ROADMAP.md` Punkte W.27, W.29 · Basis: `main@d54f150` · Aufwand: M · Modell: Opus

## Ziel
`Administration.vue` (669 Zeilen) wird zur schlanken Seite, die ihre Abschnitte als eigene Komponenten einbindet, damit 11.1/11.2 (Export/Import) dort ohne weiteres Wachstum ansetzen können. Undo/Redo der Rezeptbearbeitung liegt in einem testbaren Composable statt in `Edit.vue`. Das sichtbare Verhalten beider Seiten bleibt unverändert.

## Erst lesen
1. `docs/tasks/W.10.bericht.md` – „Offen und Folgepunkte“ (Undo, Listener-Leck in `useDraft.spec.ts`)
2. `docs/DEVELOPMENT-GUIDELINES.md` (Abschnitt 11 Tests), `.claude/rules/frontend.md`
3. `frontend/src/views/Administration.vue`, `frontend/src/api/admin.ts`
4. `frontend/src/views/Edit.vue` (Abschnitte „Draft & Unsaved Guard“, „Undo / Redo“, „Keyboard Shortcuts“), `frontend/src/composables/useDraft.ts` und `useDraft.spec.ts`
5. `docs/plans/export-import.md` (was 11.1/11.2 später in der Verwaltung ändert)

## Auftrag

### W.27 `Administration.vue` aufteilen
1. Abschnitte als Komponenten unter `src/components/admin/`, je mit eigenem Zustand und eigenen API-Aufrufen:
   - Benutzer (Liste, Rollenwechsel)
   - Einstellungen (Share-Laufzeit, AI-Modelle, Key-Status, „Verbindung testen“)
   - Share-Links (Liste, kopieren, widerrufen)
   - Wartung (Bild-URLs migrieren, verwaiste Bilder bereinigen)
   - Rezeptverwaltung (Neu, Beispielrezept, YAML-Import, Liste mit Löschen/Kopieren/Export, „Speichern“) **unverändert verschoben**; 11.2 baut sie später um.
2. `Administration.vue` behält nur Seitenrahmen, Überschrift und Sichtbarkeitsregeln (Rolle, `read_only`, `expert_mode`) bzw. reicht sie weiter. Gleiche Bedingungen wie heute.
3. Tests (Vitest, `adminApi` gemockt), knapp:
   - Einstellungen: Speichern schickt **alle** Felder (sonst überschreibt das Backend gespeicherte Werte mit Defaults, Fallstrick aus W.12); Key-Status wird angezeigt, der Key nie; Fehler beim Verbindungstest erscheint.
   - Benutzer: Rollenwechsel ruft die API mit der richtigen Rolle und zeigt Fehler an.

### W.29 Undo/Redo als Composable
1. Neues Composable (z. B. `useEditHistory`) mit der Logik aus `Edit.vue`: `useDebouncedRefHistory` (500 ms, Kapazität 50), Pausieren bis zum Laden, Verlauf beim Laden und nach dem Wiederherstellen eines Entwurfs leeren (Geladenes und Entwurf sind nicht rückgängig zu machen), Tastenkürzel Strg/Cmd+Z, Strg/Cmd+Y, Strg/Cmd+Umschalt+Z. Schnittstelle so, dass Entwurf und Dirty-Snapshot in `Edit.vue` bzw. `useDraft` bleiben.
2. `Edit.vue` nutzt das Composable; Verhalten unverändert.
3. Tests: Änderung → Undo → Redo; schnelle Änderungen innerhalb der Debounce-Zeit sind ein Schritt; Laden und Entwurf-Wiederherstellen nicht rückgängig zu machen; Kapazität; Kürzel (inkl. Umschalt-Variante, kein Undo ohne Verlauf).
4. `useDraft.spec.ts`: gemountete Komponenten in `afterEach` abbauen; prüfen, dass der beforeunload-Test ohne den Listener der aktuellen Instanz rot würde.

## Ablage
- Neu: `src/components/admin/*.vue` (+ Specs), `src/composables/useEditHistory.ts` (+ Spec)
- Geändert: `src/views/Administration.vue` (schrumpft deutlich), `src/views/Edit.vue` (schrumpft), `src/composables/useDraft.spec.ts`

## Nicht in diesem Auftrag
- Fachliche oder optische Änderungen an der Verwaltung; Rezeptverwaltung umbauen, „Speichern“ (IndexedDB) entfernen, YAML-Import auf UUID-Logik (11.2)
- Export/Import als ZIP (11.1)
- Weitere Umbauten an `Edit.vue` (Vorlage-Abschnitt kommt mit W.28)
- Backend

## Entscheidungen, die ich treffe
- keine

## Fallstricke
- **Testverlauf vs. Debounce:** `useDebouncedRefHistory` arbeitet mit Timern; Fake-Timer verwenden und nach jedem Test zurückstellen. `deep: true` auf einem großen Rezeptobjekt; das Verhalten (ein Schritt je 500 ms Ruhe) nicht ändern.
- **Reihenfolge beim Laden:** Heute: `pause()` vor dem Laden, beim Laden Snapshot, `commit(); clear(); resume()`, danach ggf. Entwurf wiederherstellen und erneut `commit(); clear()`. Diese Reihenfolge entscheidet, ob der Ladezustand rückgängig zu machen ist; im Test absichern, bevor `Edit.vue` umgestellt wird.
- **Tastenkürzel:** `onKeyStroke` registriert global. Zwei Handler für `z` (mit und ohne Umschalt) existieren absichtlich; nicht zu einem Handler verschmelzen, ohne die Umschalt-Abfrage zu erhalten.
- **Rollen und Sichtbarkeit:** Die Verwaltung zeigt Abschnitte je nach `role`, `read_only` und `expert_mode`. Beim Verschieben jede Bedingung 1:1 mitnehmen; Admin-Abschnitte dürfen für Editoren nicht sichtbar werden.
- **Parallel läuft W.25** (Router, `swUpdate.ts`, `vite.config.js`, Backend-Konfiguration). Diese Dateien nicht anfassen.
- **W.28 folgt** und ergänzt `Edit.vue` um einen Abschnitt „Vorlage“; `Edit.vue` daher nur so weit ändern, wie das Composable es erfordert.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `Administration.vue` < 150 Zeilen, `Edit.vue` ohne History-Logik und Tastenkürzel für Undo/Redo
- Tests für Einstellungen, Benutzer und `useEditHistory` grün; `useDraft.spec.ts` räumt ab
- Sichtprüfung im Dev-Server oder Container, soweit ohne Login möglich, sonst begründet; die Szenarien für meine Sichtprüfung (Verwaltung als Admin und als Editor, Undo/Redo in der Bearbeitung inkl. Entwurf) im Bericht auflisten
- Verifikation gemäß Projekt-CLAUDE.md (Frontend, inkl. `npm test`)

## Korrektur (2026-11-15, nach Prüfung)
- Abnahme „Einstellungen: Speichern schickt **alle** Felder“ war falsch: `PUT /admin/settings` übernimmt per `exclude_unset` nur gesendete Felder (`backend/app/routes/admin.py`), der W.12-Fallstrick ist dort gelöst. Alle Felder zu senden würde bei jeder Änderung der Share-Laufzeit die Modelle bei OpenAI prüfen (ohne Key 503). Umgesetzt und getestet ist der Ist-Vertrag (nur geänderte Felder).
