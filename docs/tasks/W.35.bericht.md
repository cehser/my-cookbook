# Bericht W.35: Löschrechte, Favoriten für `readonly`, Randfälle der Vormerkung

> Branch `worktree-W.35-loeschrechte-vormerkung` · Basis `66a2125` (= `b98024f` + `docs(roadmap)`) · Stand `f2c5eb1` (+ Berichtsnachtrag) · 2026-11-18 · Dauer: 08:59 – 09:33 und Nachtrag Folgepunkte 10:51 – 10:58 (41 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Admins löschen alle Rezepte, Editoren ihre eigenen. Rezepte ohne `created_by` löschen nur Admins. Backend und Oberfläche wenden dieselbe Regel an. Den Lösch-Knopf in Karte, Rezeptansicht und Verwaltung sieht nur, wer löschen darf. Ein Rezept verschwindet erst nach erfolgreichem Löschen aus der Liste. Scheitert das Löschen (403, offline, abgelaufene Sitzung), erscheint ein roter Toast, und das Rezept bleibt stehen. `readonly` sieht den Stern und kann Favoriten setzen, auch mit „Nur lesen“. Das × in der Verwaltung fragt mit dem Rezeptnamen nach. Die sieben Randfälle der Vormerkung aus W.33 sind behoben.

## Commits
- `2c8a3e3` feat(backend): Editoren dürfen eigene Rezepte löschen
- `96c54e7` feat(frontend): Löschrecht, ehrliches Löschen, Favoriten für readonly
- `f70e8f0` docs(frontend): Rules zu Löschrecht, Löschergebnis und Vormerk-Randfällen
- `57bf607` refactor(frontend): Übertragung ohne settle-force, toten Grabstein-Pfad entfernen
- `252bc9d` docs(frontend): Löschen während settle in den Rules beschreiben
- `7c011e9` docs(roadmap): Abschlussbericht W.35
- `7fdd424` fix(frontend): Speicherfehler in Karte und Bearbeitung mit Grund melden
- `f2c5eb1` refactor(frontend): Listen-Abgleich aus recipeStore nach listSync auslagern
- (Berichtsnachtrag)

## Umsetzung im Einzelnen
- **Backend:** `can_delete_recipe(user, created_by)` steht in `app/auth/dependencies.py`. `DELETE /v1/recipes/{id}` hängt jetzt an `require_editor`: `readonly` und `pending` bekommen 403, bevor nachgeschlagen wird. Danach prüft der Endpunkt 404 und dann das Recht (403 mit „Nur eigene Rezepte löschen (Admins: alle)“).
- **Regel im Frontend an einer Stelle:** `canDeleteRecipe`, `canFavorite` und `sameUser` liegen in `auth/role.ts`.
  - `sameUser` vergleicht klein geschrieben, ohne Bindestriche und Klammern. Auch der 409-Abgleich in `pendingCreates.ts` nutzt sie jetzt.
  - Der Getter `store.canDelete(recipe)` versorgt die Regel mit Rolle, `store.userSub` (gesetzt in `loadAllOnce`) und `store.pendingIds`.
  - `created_by` kommt aus Liste und Detail (`recipeMapping.ts`) und gelangt nie in den Payload. Beim Anlegen wird es verworfen (Duplikat, YAML-Import).
  - Die Rezeptansicht nimmt den Ersteller aus der Listenzeile. Ältere Detail-Caches kennen `created_by` noch nicht.
- **Ehrliches Löschen:** `deleteRecipe` liefert `DeleteResult`.
  - Ohne gültige Sitzung kommt `OfflineError` (neu in `api/client.ts`) bzw. 401, ohne API-Aufruf. 404 zählt als gelöscht.
  - Die Aufrufer nutzen `composables/useRecipeDelete.ts`, das bei einem Fehler einen Toast zeigt (`deleteFailedMessage`). Das gilt für Home, Suche, Favoriten, Rezeptansicht und Verwaltung.
  - Die Rezeptansicht wartet auf das Ergebnis und navigiert nur nach Erfolg.
- **Kein Geist:** `deletedRecently` funktioniert wie `createdPending` mit `listSeq`. Es filtert Listenabrufe, die vor dem Löschen begonnen haben.
- **Randfälle der Vormerkung:**
  - Ein vorgemerktes Rezept wird lokal sofort entfernt. Mit gültiger Sitzung geht trotzdem ein `DELETE` hinaus. 404 und andere Fehler werden nur protokolliert.
  - Ohne `sub` wird nichts vorgemerkt: `NotSignedInError`, Meldung „Rezept nicht angelegt: Bitte anmelden.“.
  - Den Ersteller-Abgleich übernimmt `sameUser` (siehe oben).
  - Lehnt der Server den PUT nach der Anlage ab: `created` mit `updateError` bzw. `transferReport.updateRejected`. Meldung „Rezept „X“ angelegt, letzte Änderung nicht übertragen: <Grund>.“. Der Eintrag verlässt die Vormerkung, sofern nicht danach erneut bearbeitet wurde.
  - IDB-Lesefehler: Ist das Rezept laut `store.pendingIds` vorgemerkt, wirft `setRecipe` `LocalReadError` (Edit.vue und Tag-Bearbeitung der Karte melden „Rezept nicht gespeichert: auf diesem Gerät nicht lesbar.“), und `deleteRecipe` liefert `failed`. Sonst geht es wie bisher zur API (privater Modus).
  - Löschen während `settle`: Gewinnt `settle`, ist das Rezept angelegt, und das Löschen geht über die API. Gewinnt das Löschen, sendet die Übertragung `DELETE`. Ein älterer Abruf bringt das Rezept nicht zurück.
  - Wirft `currentUserSub()`, liefert `listPending` eine leere Liste, und `addPending` wirft `LocalSaveError`.
- **Favoriten:** Stern in Karte und Kopfzeile ab `readonly` (`canFavorite`). „Nur lesen“ blendet weiter das Aktionsmenü aus.
- **Verwaltung:** `confirm('Rezept "<Name>" wirklich löschen?')`, `aria-label` und `title` „Rezept „<Name>“ löschen“. Löschen per ID statt Index. Das × erscheint nur mit Löschrecht, weil Editoren die Verwaltung sehen.

## Verifikation
- Frontend `npm run lint:check && npm run typecheck && npm test && npm run build` → grün, 31 Testdateien, 288 Tests (vorher 247), Build 1,30 s
- Backend `uv sync --frozen && uv run ruff check && uv run ruff format --check && uv run pytest` → 142 passed, 18 skipped (lokal mit `--python cpython-3.14-windows-x86_64-none`, ARM-Falle)
- `uv run pytest -m db` gegen eine Wegwerf-DB `postgres:16-alpine` (Port 55435) → 18 passed. Neu: Admin löscht fremdes, Editor eigenes, Editor fremdes → 403, `readonly` → 403, ohne `created_by` nur Admin. Container danach gestoppt.
- Kein Container-Build: Abhängigkeiten, Dockerfile und Migrationen sind unverändert.
- **Altbestand ohne `created_by`** (lokale Compose-DB `my-cookbook-db`, nur lesend per `psql`): 0 von 4 Rezepten. Produktiv nicht geprüft.
- Neue Tests:
  - `auth/role.spec.ts`: Normalisierung, Rechtematrix
  - Store +17: Löschergebnis, Grabstein, `canDelete`, Randfälle
  - `RecipeCard.spec.ts`, `AdminRecipes.spec.ts`, `views/Recipe.spec.ts`
  - Mapping und Feedback
  - Backend: `test_can_delete_recipe` (Smoke) und 5 DB-Tests
- Gegenprobe per Mutation (Scratchpad-Skript, jeweils zurückgesetzt): Alle 21 Mutationen lassen mindestens einen Test scheitern. Dazu gehören: Grabstein entfernt, API-Fehler als Erfolg, optimistisches Entfernen, kein DELETE bei vorgemerkten Rezepten, Normalisierung entfernt, Stern wieder an `read_only`, Knopf immer sichtbar, Rückfrage entfernt, Navigation trotz Fehler, `updateError` nicht zurückgesetzt, Fehler aus `currentUserSub` nicht abgefangen.
  - Zwei Mutationen überlebten zunächst. Der Code war tot bzw. überflüssig und wurde entfernt (`57bf607`).
- Nachtrag Folgepunkte: Frontend erneut voll geprüft → grün, 32 Testdateien, 293 Tests (+5: `listSync.spec.ts` 3, Karte 1, Feedback 1), Build 1,01 s, Prüfzeit 1 min 0 s. Backend unverändert, nicht erneut geprüft.
- Sichtprüfung: keine (kein Browser- oder Gerätelauf)
- Prüfzeit: Frontend 1 min 14 s, Backend 15 s, DB-Tests 14 s; größter Posten: Frontend-Tests und Build
- Prüfskripte: nur Scratchpad

### Szenarien für deine Sichtprüfung
1. **Als Editor, eigenes Rezept:** Rezept anlegen, im Kartenmenü und im ⋮ der Rezeptansicht steht „Löschen“. Löschen → Rückfrage → Rezept weg, nach dem Neuladen auch.
2. **Als Editor, fremdes Rezept** (vom Admin angelegt): Kein „Löschen“ in Karte, Rezeptansicht und Verwaltung, „Bearbeiten“ bleibt.
3. **Als Editor offline, eigenes Rezept löschen:** roter Toast „Rezept nicht gelöscht: keine Verbindung zum Server.“, die Karte bleibt.
4. **Als `readonly`** (Profil „Nur lesen“ an): Stern auf Karte und in der Kopfzeile, antippen → im Favoriten-Tab. Kein ⋮-Menü.
5. **Als Admin, Verwaltung → Rezepte:** × antippen → „Rezept "X" wirklich löschen?“, Abbrechen lässt es stehen, OK löscht. Screenreader liest „Rezept „X“ löschen“.

## Struktur und Doku
- `recipeStore.ts` wuchs von 588 auf 706 Zeilen; nach dem Auslagern des Listen-Abgleichs nach `store/listSync.ts` (62 Zeilen) sind es 671 (+83). `deleteRecipe` und `forgetRecipe` bleiben im Store, weil sie dessen State ändern.
  - Treiber: `deleteRecipe` mit drei Pfaden und Doku, `forgetRecipe`, `canDelete`, `pendingIds` und `userSub`.
  - `pendingCreates.ts`: 320 → 385. `auth/role.ts`: 88 → 129.
  - Neu: `composables/useRecipeDelete.ts`.
- Keine bewussten Duplikate. Die Regel „darf löschen“ steht je einmal im Backend und im Frontend (Spiegel, in beiden Rules verlinkt).
- Rules nachgetragen:
  - `.claude/rules/backend-db.md`: Löschrecht
  - `.claude/rules/frontend.md`: Löschen, Favoriten, Randfälle der Vormerkung, Sätze zu „DELETE braucht admin“ korrigiert
- CLAUDE.md stimmt noch.

## Mitgenommen (auf deine Anweisung nach dem Bericht)
- Tag-Bearbeitung der Karte: Speicherfehler als Toast mit Grund (`7fdd424`)
- Edit.vue: Speicherfehler nennt den Grund, neue Meldung `saveFailedMessage` (`7fdd424`)
- Listen-Abgleich (`listSeq`, `createdPending`, `deletedRecently`) in `store/listSync.ts` mit eigener Spec (`f2c5eb1`)

## Abweichungen vom Auftrag
- **Lösch-Knopf auch in der Verwaltung nach Recht:** Der Auftrag nennt für Schritt 2 Karte und Rezeptansicht. Die Verwaltung sehen aber auch Editoren (`Administration.vue`). Ohne die Prüfung hätten sie dort ein × für fremde Rezepte, das nur noch mit Fehler-Toast endet. Eine Zeile, gleiche Regel.
- **Löschen bleibt sichtbar bis zur Antwort** statt optimistisch zu verschwinden und bei einem Fehler zurückzukehren. Der Auftrag lässt beides zu. So gibt es kein Flackern und kein Wiedereinfügen an der falschen Stelle.
- **DELETE für vorgemerkte Rezepte auch für `readonly`:** Ein abgelehntes, vorgemerktes Rezept von `readonly` löst beim Löschen ein `DELETE` aus. Das Backend antwortet mit 403, das wird nur protokolliert, lokal ist das Rezept gelöscht. Eine Sonderregel nach Rolle habe ich nicht eingebaut.
- **Bestehende Tests angepasst:** „Löschen: aus der Vormerkung, kein API-Aufruf“ und B3 erwarteten kein `DELETE` für vorgemerkte Rezepte. Schritt 6 verlangt genau das, daher erwarten sie jetzt das `DELETE` (404 egal).
- **Vormerk-Einträge ohne `sub`** (vor W.33 N3 oder abgemeldet angelegt) werden nicht mehr angezeigt, weil `sameUser` zwei vorhandene IDs verlangt. Vorher erschienen sie, solange kein Nutzer angemeldet war.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Detail-Cache ohne `created_by`:** Ältere Detail-Caches (vor diesem Stand) kennen den Ersteller nicht. Die Rezeptansicht weicht auf die Listenzeile aus. Fehlt die Zeile (Direktaufruf offline ohne Listen-Cache), sieht ein Editor dort kein „Löschen“. Selbstheilend mit dem nächsten Prefetch, kein Handlungsbedarf.
- **`setRecipe` schluckt PUT-Fehler** (offline, 403, 422) mit `console.warn`; Karte und Edit.vue melden dann „Gespeichert“ bzw. nichts. Bestehendes Verhalten, nicht Teil von W.35 · S

## Status je Roadmap-Punkt
- `W.35` fertig (Sichtprüfung steht aus)

## Vorschlag Roadmap-Zeilen
`- [x] W.35 Löschrechte (Editor eigene, Admin alle), ehrliches Löschen, Favoriten für readonly, Randfälle der Vormerkung · 2026-11-18 · f2c5eb1`
