# Auftrag W.37: Speichern ehrlich, lokale Rezepte kennzeichnen, Frontend-Kleinkram

> Erstellt 2026-11-18 vom Master · Roadmap: `ROADMAP.md` Punkte W.37, W.34, W.36 · Basis: `main@39914c0` · Aufwand: M · Modell: Opus

## Ziel
Die Oberfläche meldet nur „Gespeichert“, wenn der Server die Änderung hat. Scheitert das Speichern, sieht der Nutzer das, und seine Arbeit geht nicht verloren. Rezepte, die nur auf diesem Gerät liegen (vorgemerkt oder abgelehnt), sind an der Karte erkennbar. Dazu drei kleine Korrekturen aus W.15 und U.1. Offline-Bearbeitung bestehender Rezepte bleibt ausgeschlossen (12.1).

## Erst lesen
1. `docs/tasks/W.35.bericht.md` – „Offen und Folgepunkte“; die Befunde der Prüfung stehen unten unter W.37
2. `docs/tasks/W.33.bericht.md` – Abschnitt zu abgelehnten Rezepten nach Neustart (Herkunft von W.34)
3. `.claude/rules/frontend.md` – Vormerkung, Löschen, Toasts (`useToast`-Wrapper), `BModal`
4. `frontend/src/store/recipeStore.ts` (`setRecipe`, `deleteRecipe`, `forgetRecipe`, `canDelete`, `pendingIds`), `store/pendingCreates.ts`, `store/listSync.ts`, `views/Edit.vue` (`saveRecipe`, Entwurf aus W.29), `components/recipe/ui/RecipeCard.vue` (`saveTags`), `js/appendFeedback.ts` (`saveFailedMessage`, `deleteFailedMessage`)

## Auftrag

### W.37 Speichern ehrlich
1. **`setRecipe` liefert ein Ergebnis** analog zu `deleteRecipe`: gespeichert, vorgemerkt geändert oder gescheitert mit Grund. Fehler beim PUT (`ApiError` 403/404/422/5xx, `OfflineError`, Timeout, 401 bei abgelehnter Sitzung) werden nicht mehr verschluckt. Ohne gültige Sitzung kein stilles lokales Speichern, sondern `failed` mit „keine Verbindung“ bzw. „Bitte neu anmelden“.
2. **Liste erst nach Erfolg ändern**, bzw. bei Fehler auf den vorherigen Stand zurücksetzen. Das gilt auch für den Pfad, der `LocalReadError` wirft. Detail-Cache (`writeRecipeDetail`) und `saveRecipes` nur nach Erfolg.
3. **Aufrufer:**
   - `Edit.vue`: „Gespeichert.“ nur bei Erfolg. Bei Fehler Meldung mit Grund (`saveFailedMessage`), der Entwurf bleibt erhalten (kein `discardDraft`), der Editor bleibt dirty.
   - `RecipeCard.vue` (Tags): bei Fehler Meldung und die Tag-Änderung in der Anzeige zurücknehmen.
4. **Gelöschtes vorgemerktes Rezept kehrt nicht zurück:**
   - Ein Listenabruf, der zwischen `forgetRecipe` und dem DELETE der Übertragung startet, darf das Rezept nicht wieder einführen.
   - Scheitert dieses DELETE, darf das Rezept nicht kommentarlos wiederkommen. Entweder erneut versuchen oder melden; Lösungsweg im Bericht begründen.
5. **`deleteRecipe` mit ungültigem Index** liefert kein `deleted`.
6. **Rule** `.claude/rules/frontend.md`: Den Satz „Toast nach der Übertragung … `TransferNotice`“ aus dem Favoriten-Absatz zurück zur Vormerkung; das neue Speicherergebnis kurz beschreiben.

### W.34 Lokale Rezepte kennzeichnen
1. Karten von Rezepten in der Vormerkung tragen eine Kennzeichnung „Nur auf diesem Gerät“, abgelehnte (`rejected`) mit Hinweis auf die Ablehnung („Vom Server abgelehnt“). Quelle: `pendingIds` bzw. der Vormerk-Status, eine Stelle im Store, keine IDB-Lesezugriffe je Karte.
2. Die Kennzeichnung verschwindet nach erfolgreicher Übertragung ohne Neuladen.
3. Kompakte Karten („Zuletzt“) und die Rezeptansicht: ebenfalls kennzeichnen, wenn es mit wenig Aufwand geht; sonst im Bericht begründen.
4. Gestaltung mit Design-Tokens, Text statt nur Farbe/Symbol (Barrierefreiheit), nicht größer als die Tag-Chips.

### W.36 Frontend-Kleinkram
1. `BModal`: `hide-footer` → `no-footer` in `views/Edit.vue` (Vorschau) und `views/HomeView.vue` (KI-Import). Sichtbar prüfen, dass kein leerer Footer mehr erscheint (U.1 A-01).
2. `views/Settings.vue` löschen (toter Code, U.1 P-06). Vorher per `git grep` bestätigen, dass nichts darauf verweist.
3. `frontend/.docker/nginx/prod.conf`: `manifest.webmanifest` mit `Content-Type: application/manifest+json` ausliefern. Im lokal gebauten Container per `curl -I` prüfen.

### Tests
- **Vitest** für W.37:
  - `setRecipe`: Erfolg, PUT-Fehler 403/422, offline, Sitzung abgelehnt
  - Rücksetzen der Liste
  - Edit.vue: kein „Gespeichert“ und Entwurf bleibt
  - Karte: Tag zurück
  - Geister-Fenster beim Löschen
  - ungültiger Index
- **Vitest** für W.34: Kennzeichnung bei vorgemerkt bzw. abgelehnt, verschwindet nach Übertragung.

## Ablage
- Geändert:
  - `store/recipeStore.ts`, `store/pendingCreates.ts` bzw. `store/listSync.ts`
  - `views/Edit.vue`, `components/recipe/ui/RecipeCard.vue`, `js/appendFeedback.ts`
  - `views/HomeView.vue`, `frontend/.docker/nginx/prod.conf`, `.claude/rules/frontend.md`
  - Specs daneben
- Entfernt: `views/Settings.vue`
- `recipeStore.ts` steht bei 671 Zeilen. Wächst er um mehr als ~60 Zeilen, das Speicherergebnis bzw. die Kennzeichnungslogik in ein eigenes Modul auslagern, wie `listSync.ts`.

## Nicht in diesem Auftrag
- Offline-Bearbeitung bzw. Vormerken von Änderungen an bestehenden Rezepten (12.1)
- Rechte zum Bearbeiten, „Nur lesen“, Experten-Modus (U.15)
- Rezeptansicht und Koch-Modus-Komponenten (U.3 in Nacharbeit; `Recipe.vue` nur, falls für W.34 Punkt 3 nötig, dann minimal)
- Dialog-Komponente statt `confirm()` (U.11)

## Entscheidungen, die ich treffe
- keine

## Fallstricke
- **Entwurf (W.29):** `Edit.vue` hält einen Entwurf mit `useDebouncedRefHistory`. Er darf bei gescheitertem Speichern nicht verworfen werden, sonst ist die Arbeit weg.
- **Vorgemerkte Rezepte:** `setRecipe` ändert sie nur in der Vormerkung. Das ist ein Erfolg („auf diesem Gerät gespeichert“) und kein Fehler. Die Meldung soll das unterscheiden, z. B. „Gespeichert, wird übertragen, sobald online.“
- **U.3 läuft parallel** (Nacharbeit, Merge von `main`). Überschneidung nur in `frontend.md`. Dort eigene Änderungen auf die genannten Absätze beschränken.
- **Windows:** `npm test` und `npm run build` nur aus einem Pfad mit großem `C:` ausführen. Mit kleinem `c:` scheitern Tests bzw. die App lädt Pinia doppelt (Bericht U.3).

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- W.37: Kein „Gespeichert“ bei gescheitertem PUT. Entwurf und Liste bleiben konsistent. Geister-Fenster geschlossen, ungültiger Index ohne Erfolg. Tests aus „Tests“ grün.
- W.34: Kennzeichnung an der Karte für vorgemerkte und abgelehnte Rezepte, mit Test und Screenshot (iPhone, hell/dunkel).
- W.36: kein leerer Modal-Footer, `Settings.vue` entfernt, Manifest mit `application/manifest+json` (per `curl -I` am lokalen Container belegt).
- Szenarien für meine Sichtprüfung im Bericht: offline bearbeiten und speichern, Tag offline ändern, Rezept offline anlegen und Karte ansehen.
- Verifikation gemäß Projekt-CLAUDE.md (Frontend; Container lokal bauen wegen `prod.conf`).
