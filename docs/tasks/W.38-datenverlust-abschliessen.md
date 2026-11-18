# Auftrag W.38: Datenverlust abschließen

> Erstellt 2026-11-18 vom Master · Roadmap: `ROADMAP.md` Punkt W.38 · Basis: `main@411550c` · Aufwand: S · Modell: Opus

## Ziel
Keine Speicherung kann einen Rezeptinhalt mehr durch eine unvollständige Fassung ersetzen. Kein gelöschtes vorgemerktes Rezept kehrt zurück. Ein fremdes Rezept wird nie per DELETE gelöscht. Vorgemerkte Rezepte sind auch in der Rezeptansicht gekennzeichnet. Die Wiederherstellung bereits beschädigter Rezepte gehört nicht hierher (W.39).

## Erst lesen
1. `docs/tasks/W.37.bericht.md` – „Ergebnis“ (Datenverlust durch Tags) und „Offen und Folgepunkte“
2. `.claude/rules/frontend.md` – Absätze Speichern, Vormerkung, Löschen
3. `frontend/src/composables/useRecipeHelper.ts` (`loadRecipe`, Rückfall bei fehlgeschlagenem Detail-GET), `views/Edit.vue`, `views/Recipe.vue` (Duplizieren, YAML-Export), `store/recipeStore.ts` (`setRecipe`, `localStatus`), `store/saveRecipe.ts`, `store/pendingCreates.ts` (`markDeleted`, `dropEntry`, `deleteOnServer`, `doTransfer`, `rejected`), `js/recipeMapping.ts` (`listItemToRecipe`)
4. Backend `routes/recipes.py` `update_recipe`: `data` wird vollständig ersetzt

## Auftrag
1. **Unvollständige Fassung nie speichern:**
   - **Edit.vue:** Ist der Detailstand nicht ladbar (Detail-GET scheitert online und es gibt keinen Detail-Cache), öffnet der Editor nicht mit der Listenzeile. Stattdessen Meldung („Rezept konnte nicht geladen werden“) und kein Speichern möglich.
   - **Zentrale Sperre im Store:** Eine Fassung, die nur aus der Listenzeile stammt, darf nie als `data` per PUT gehen. Mit einer zweiten Absicherung im Store, unabhängig vom Aufrufer, z. B. ein nicht persistiertes Kennzeichen „nur Listenzeile“ aus `listItemToRecipe`, das `setRecipe` ablehnt (`failed`). Lösungsweg im Bericht begründen.
   - **Weitere Schreibwege prüfen:** Alle Stellen, die eine Rezeptfassung an `setRecipe` oder `appendRecipe` geben (Duplizieren, YAML-Export bzw. -Import, KI-Import, Vorschau), daraufhin prüfen, ob sie eine Listenzeile weiterreichen können. Funde beheben oder im Bericht begründen. Duplizieren einer Listenzeile darf keine leere Kopie anlegen.
2. **Löschen während der Übertragung:** Wird ein vorgemerktes Rezept gelöscht, bevor die laufende Übertragung es anlegt (DELETE bekommt 404, Eintrag wird entfernt), und scheitert danach das nachgesendete DELETE, muss die Löschung vorgemerkt bleiben. Entweder vor dem POST unter `locked` prüfen, ob der Eintrag noch existiert bzw. nicht `deleted` ist, oder bei Fehlschlag die Markierung neu schreiben. Test mit Deferreds.
3. **Fremdes 409:** Das Ergebnis „409, Rezept eines anderen“ bekommt ein eigenes Kennzeichen, das eine Bearbeitung nicht aufhebt (anders als `rejected`). Löschen eines so markierten Eintrags sendet nie ein DELETE. Test als Admin.
4. **Kennzeichnung in der Rezeptansicht:** „Nur auf diesem Gerät“ bzw. „Vom Server abgelehnt“ im Kopf der Rezeptansicht, Quelle `store.localStatus`, gleiche Gestaltung wie an der Karte (W.34).
5. **Rules** `.claude/rules/frontend.md` nachtragen: Sperre gegen Listenzeilen, fremdes 409.

## Ablage
- Geändert: `composables/useRecipeHelper.ts`, `views/Edit.vue`, `store/recipeStore.ts` bzw. `store/saveRecipe.ts`, `store/pendingCreates.ts`, `js/recipeMapping.ts`, `views/Recipe.vue` bzw. `components/recipe/display/RecipeDisplay.vue` (Kennzeichnung), Specs daneben, `.claude/rules/frontend.md`
- `pendingCreates.ts` steht bei 509 Zeilen: nichts Neues hineinlegen, was nicht zur Vormerkung gehört

## Nicht in diesem Auftrag
- Wiederherstellung beschädigter Rezepte (W.39)
- Backend-Änderungen, z. B. Teil-Update von `data` (Merge statt Ersetzen). Falls du das für nötig hältst: im Bericht als Folgepunkt vorschlagen
- „Nur lesen“, Experten-Modus, ⋮-Menü für alle Rollen (U.15)
- Offline-Bearbeitung bestehender Rezepte (12.1)

## Entscheidungen, die ich treffe
- keine

## Fallstricke
- **Kennzeichen nicht persistieren und nie in den Payload:** Ein Feld an `Recipe`, das in die IndexedDB oder per `recipeToPayload` an den Server gelangt, würde den Fehler verlagern. In `recipeToPayload` explizit ausschließen und testen.
- **Rezepte aus dem Listen-Cache nach Neustart** sind ebenfalls nur Listenzeilen. Die Sperre muss auch für sie greifen, nicht nur für frische Abrufe.
- **Vorgemerkte Rezepte** liegen vollständig in der Liste (`insertCreated`, Vormerkung). Sie dürfen nicht fälschlich als Listenzeile gesperrt werden.
- **Windows:** `npm test` und `npm run build` nur aus einem Pfad mit großem `C:` (Rule `frontend.md`).

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- Edit.vue öffnet keine Listenzeile; der Store lehnt das Speichern einer Listenzeile ab (Test); `recipeToPayload` enthält das Kennzeichen nie (Test)
- Liste der geprüften Schreibwege im Bericht mit Ergebnis
- Rennen „Löschen während der Übertragung, DELETE scheitert“ und „fremdes 409 nach Bearbeitung“ mit Tests
- Kennzeichnung in der Rezeptansicht mit Test und Screenshot (iPhone hell)
- Szenario für meine Sichtprüfung: Rezept öffnen, Server nicht erreichbar, ohne Cache bearbeiten wollen
- Verifikation gemäß Projekt-CLAUDE.md (Frontend)
