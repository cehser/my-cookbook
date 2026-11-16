# Bericht W.33: Client-UUID beim Anlegen, lokal gespeicherte Rezepte nachladen statt verlieren

> Branch `worktree-W.33-client-uuid-lokale-rezepte` · Basis `db0dda2` (= `a44d523` + `docs(roadmap)`) · Stand `e8144c5` (+ dieser Bericht) · 2026-11-16/17 · Dauer: 23:22 – 23:39 und Nacharbeit 00:05 – 00:16 (28 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Ein Rezept, das nur auf dem Gerät angelegt wurde (`local`), steht jetzt dauerhaft in einer eigenen Vormerkung in der IndexedDB. Es übersteht Neuladen und App-Neustart. Beim nächsten Laden mit gültiger Sitzung wird es mit seiner UUID übertragen, danach erscheint der Toast „N Rezepte übertragen“. Eine Wiederholung legt nichts doppelt an: Bei 409 gleicht der Client per GET ab. Vorgemerkte Rezepte lassen sich ohne API-Aufruf bearbeiten und löschen. Bei abgelaufener Sitzung ergibt das Anlegen „Bitte neu anmelden“ statt einer lokalen Kopie. Das Backend dokumentiert 409 und lehnt die Nil-UUID mit 422 ab.

## Commits
- `199bddd` feat(backend): Nil-UUID als Rezept-ID ablehnen, 409 dokumentieren
- `6178739` fix(frontend): YAML-Import legt Rezept mit neuer UUID an
- `2fd08f0` feat(frontend): lokal angelegte Rezepte vormerken und nachträglich übertragen
- `c6b1b01` docs(frontend): Vormerkung lokaler Rezepte und 409-Abgleich beschreiben
- (dieser Bericht)

## Umsetzung im Einzelnen
- **Anlegen:** `recipeApi.create(id, payload)` schickt die `recipe_uuid` als `id`.
  - `createWithClientId` wertet 409 so aus: Hat das Rezept aus dem GET denselben Namen, gilt die Anlage als Wiederholung (`created`). Sonst ist das Ergebnis `rejected`, und es wird weder etwas überschrieben noch übernommen.
  - `appendRecipe` liefert `failed` mit `ApiError(401)` und damit „Bitte neu anmelden“, wenn `loginFollows(ensureAuth())` zutrifft. Das gilt direkt beim Anlegen und nach einem 401, wenn die Erneuerung gescheitert ist.
  - Ohne Netz ergibt das Anlegen `local`, ebenso bei Timeout, 5xx und `TypeError`. Das Rezept kommt dann in die Vormerkung.
- **Vormerkung:** `store/pendingCreates.ts` (232 Zeilen), IDB-Schlüssel `pendingCreates`, Lesen und Schreiben über `offlineCache.ts`. Alle Zugriffe laufen nacheinander über `locked`.
  - `loadRecipesFromApi` und der Cache-Pfad von `loadRecipes` führen die vorgemerkten Rezepte in die Liste ein. Das gilt auch, wenn der Listen-Cache leer ist.
  - Ein Rezept, das gerade gelöscht wird, filtert die Liste sofort heraus (`removing`). So bringt eine Lesung, die vor dem Löschen begonnen hat, es nicht zurück.
  - Detail-Prefetch nur für Rezepte aus der API-Liste (vorher wäre für ein vorgemerktes Rezept ein 404 gekommen).
- **Übertragung:** `transferPending` als Single-Flight, die Rezepte nacheinander.
  - Auslöser: `loadAllOnce` nach erfolgreichem Listenabruf mit gültiger Sitzung. Dazu `reloadIfStale`, wenn die Daten schon aus der API stammen und die Sitzung gültig ist. Deckt z. B. ein 5xx beim Anlegen ab, auf das ein Wechsel in den Vordergrund folgt.
  - 201 oder 409 mit Abgleich: Das Rezept wird aus der Vormerkung entfernt. `insertCreated` ersetzt die lokale Fassung und schreibt den Detail-Cache. `createdPending` schützt dabei gegen parallele Abrufe wie in W.31.
  - Ausfall: Der Lauf endet, die Rezepte bleiben vorgemerkt.
  - 4xx: Der Eintrag bekommt `rejected: <status>`, dazu kommt einmal ein Hinweis-Toast. Er wird nicht automatisch erneut gesendet. Das Rezept bleibt sichtbar und lässt sich löschen.
  - Wird das Rezept während der Anfrage gelöscht, kommt es nicht zurück in die Liste. Wird es während der Anfrage bearbeitet, wird der neuere Stand per PUT nachgeschoben.
- **Bearbeiten und Löschen:** `setRecipe` aktualisiert bei einem vorgemerkten Rezept nur die Vormerkung und sendet kein PUT. `deleteRecipe` entfernt es aus der Vormerkung ohne API-Aufruf und räumt bei jedem Löschen `createdPending` auf. Damit ist der W.31-Befund behoben, nach dem ein gelöschtes Rezept nach einem laufenden Abruf wieder auftauchte.
- **Meldungen** (`js/appendFeedback.ts`):
  - Bei `local` (`LOCAL_PENDING_TEXT`): „Auf diesem Gerät gespeichert, wird beim nächsten Online-Start übertragen.“
  - `transferToasts` liefert „1 Rezept übertragen.“ bzw. „N Rezepte übertragen.“. Bei einer Ablehnung kommt je Rezept: „Rezept „X“ nicht übertragen: <Grund>. Es bleibt auf diesem Gerät; nach einer Bearbeitung wird es erneut versucht.“
  - Gründe neu: 401 „Bitte neu anmelden“, 409 „ID bereits vergeben“.
  - Angezeigt werden die Toasts über `components/layout/TransferNotice.vue`. Die Komponente liegt innerhalb von `BApp`, weil `useToast` dessen Orchestrator braucht.
- **Duplikat herausgelöst:** Die Nutzlast für POST und PUT war in `appendRecipe` und `setRecipe` doppelt implementiert. Sie liegt jetzt in `recipeToPayload` (`js/recipeMapping.ts`) und wird dreimal genutzt.
- **Backend:** `responses={409: …}` an `POST /recipes`, `field_validator` gegen die Nil-UUID in `RecipeCreate`.

## Verifikation
- Frontend `npm run lint:check && npm run typecheck && npm test && npm run build` → grün: 25 Testdateien, 237 Tests (vorher 221, +16: Store +12, `appendFeedback` +2, Rest Anpassungen), Build 0,88 s.
- Backend `uv sync --frozen && uv run ruff check && uv run ruff format --check && uv run pytest` → 134 passed, 13 skipped. Lokal mit `--python cpython-3.14-windows-x86_64-none` (ARM-Falle).
- `uv run pytest -m db` gegen eine Wegwerf-DB `postgres:16-alpine` (Port 55433) → 13 passed, darunter neu: Nil-UUID ergibt 422, das Rezept existiert danach nicht. Container danach gestoppt.
- Kein Container-Build: Abhängigkeiten, Dockerfile und Migrationen sind unverändert.
- Abgedeckt per Vitest:
  - offline anlegen, Neustart (neuer Store, gleiche IDB), online: genau einmal übertragen, beim nächsten Laden kein zweites Senden
  - Laden vom Server mit 503 beim Übertragen: nichts geht verloren, auch offline ohne Listen-Cache nicht
  - 409 mit Abgleich ergibt `created`, 409 mit fremdem Namen ergibt `failed`
  - 4xx beim Übertragen: bleibt vorgemerkt, keine Schleife über `loadAll` und `reloadIfStale`; eine Bearbeitung hebt die Markierung auf
  - Bearbeiten und Löschen vorgemerkter Rezepte, auch Löschen während eines laufenden Abrufs und während die Vormerkung gelesen wird
  - `rejected` und 401 nach gescheiterter Erneuerung ergeben `failed`; `TypeError` ergibt `local`
  - kein doppeltes Senden bei parallelem `loadAll` und `reloadIfStale`
  - Bearbeitung während der Übertragung wird per PUT nachgeschoben
- Gegenprobe per Mutation (Scratchpad-Skript, jeweils zurückgesetzt): Jede der folgenden Mutationen lässt mindestens einen Test scheitern:
  - Single-Flight entfernt
  - `removing`-Filter entfernt (deckte zuerst kein Test ab, Test ergänzt)
  - abgelehnte Rezepte nicht übersprungen
  - Namensabgleich bei 409 entfernt
  - Vormerkung im Listenabruf entfernt
  - Aufräumen von `createdPending` beim Löschen entfernt
- Sichtprüfung: keine (kein Browser- oder Gerätelauf)
- Prüfzeit: Frontend 1 min 6 s, pytest 3,0 s, DB-Tests 5,0 s; größter Posten: Frontend-Tests und Build
- Prüfskripte: nur Scratchpad

### Szenarien für deine Sichtprüfung
1. **Offline importieren, App schließen, online öffnen:** Ergebnis erkennen lassen, Flugmodus, „Rezept importieren“. Erwartet: Warnung „Auf diesem Gerät gespeichert, wird beim nächsten Online-Start übertragen. Die Vorlage wurde nicht gespeichert.“ App schließen, Flugmodus aus, App öffnen. Erwartet: Toast „1 Rezept übertragen.“, das Rezept steht genau einmal in der Liste, die Bearbeitungs-URL bleibt gültig, ein Neuladen ändert nichts.
2. **Offline anlegen und bearbeiten:** Flugmodus, „Neues Rezept“, Name und Zutaten ändern, speichern. Neuladen (weiter offline): Das Rezept ist da, mit den Änderungen. Online gehen und die App in den Vordergrund holen bzw. neu öffnen. Erwartet: Übertragung mit dem bearbeiteten Stand, auf einem zweiten Gerät sichtbar.
3. **Als `readonly` offline anlegen und online gehen:** Erwartet beim Anlegen: Warnung „wird übertragen“. Online: gelber Toast „Rezept „…“ nicht übertragen: keine Berechtigung. …“, das Rezept bleibt in der Liste und lässt sich löschen. Erneutes Neuladen bringt keinen zweiten Toast und keine zweite Anfrage (Netzwerk-Tab).
4. **Abgelaufene Sitzung:** Sitzung im IdP beenden bzw. Refresh-Token widerrufen, dann mit Netz „Neues Rezept“. Erwartet: roter Toast „Rezept nicht angelegt: Bitte neu anmelden.“, kein Rezept in der Liste.
5. **Vorgemerktes löschen:** offline anlegen, löschen, online gehen. Erwartet: Das Rezept taucht nicht wieder auf, im Netzwerk-Tab gibt es kein `POST`.

## Struktur und Doku
- `recipeStore.ts` wächst von 535 auf 577 Zeilen (+42, unter der Grenze von ~80). Die Vormerkung und die Übertragung liegen im neuen Modul `store/pendingCreates.ts` (232 Zeilen), der Store ruft nur auf. Ebenfalls neu: `components/layout/TransferNotice.vue`. Keine bewussten Duplikate. `recipeToPayload` ersetzt die doppelte Nutzlast.
- Rules nachgetragen: `.claude/rules/frontend.md` (Anlegen, Vormerkung, Übertragung, Toast), `.claude/rules/backend-db.md` (409 heißt „existiert“, Abgleich per GET, Nil-UUID 422), `.claude/rules/ai-import.md` (`local` wird übertragen, die Vorlage nicht). README: ein Satz zum Vertrag. CLAUDE.md stimmt noch.

## Mitgenommen
- nichts

## Abweichungen vom Auftrag
- **YAML-Import mit neuer UUID** (`6178739`, HomeView und AdminRecipes): Ohne diese Änderung wäre die Client-UUID beim Import ein Fehler. Der Import übernahm die `recipe_uuid` aus der Datei. Mit `id` im POST ergäbe das 422 bei Beispielen wie `blah-001` oder `None`. Bei einem Export eines noch bestehenden Rezepts käme 409 mit passendem Namen, und der Import würde still als „angelegt“ gelten, obwohl nichts angelegt wurde. Ein Import ist ein neues Rezept, wie beim Duplizieren. Zu den Fallstricken „ID-Gleichheit“ gerechnet, nicht als Mitnahme.
- **Übertragung auch in `reloadIfStale`**, wenn die Daten schon aus der API stammen und die Sitzung gültig ist. Sonst bliebe ein Rezept nach einem 5xx bei sonst funktionierender Verbindung bis zum nächsten Neustart liegen. Der Text „beim nächsten Online-Start“ ist damit eher zu vorsichtig als falsch.
- **Eine Bearbeitung hebt die Ablehnungsmarke auf:** Das ist die einzige Wiederholung nach 4xx, und sie geschieht nicht automatisch, sondern nach einer Aktion des Nutzers. Ohne sie bliebe ein Rezept mit 422 oder ein Rezept nach einer späteren Rollenänderung für immer stehen. Der Hinweis-Toast nennt das.
- **Bearbeitung während der Übertragung:** Der neuere Stand wird per PUT nachgeschoben. Scheitert das PUT, bleibt die Bearbeitung nur lokal in der Liste (Warnung im Log), bis zum nächsten Bearbeiten oder Listenabruf. Das Zeitfenster ist eine einzelne POST-Anfrage.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Bestand vor W.33:** Rezepte, die vor diesem Auftrag als `local` gespeichert wurden, stehen nur im Listen-Cache, nicht in der Vormerkung. Beim nächsten Online-Laden werden sie wie bisher verworfen. Laut Auftrag keine Migration.
- **Abgelehnte Rezepte nach Neustart:** Der Hinweis erscheint einmal, nämlich bei dem Lauf, der die Ablehnung erhält. In der Liste ist ein abgelehntes, vorgemerktes Rezept danach nicht gekennzeichnet. Vorschlag: Markierung „nur auf diesem Gerät“ an der Rezeptkarte, solange es vorgemerkt ist · S.
- **Zwei Tabs:** `locked` und der Single-Flight wirken nur innerhalb eines Tabs. Übertragen zwei Tabs gleichzeitig, bekommt der zweite 409 mit eigenem Ersteller und wertet das als `created` (seit Nacharbeit über `created_by`). Ergebnis korrekt, nur eine Anfrage zu viel. Kein Handlungsbedarf.
- ~~409 nach Umbenennung~~ und ~~`generateUUID`~~: in der Nacharbeit erledigt (N1, N5).

## Status je Roadmap-Punkt
- `W.33` fertig (Sichtprüfung steht aus)

## Vorschlag Roadmap-Zeilen
`- [x] W.33 Client-UUID beim Anlegen, lokal angelegte Rezepte vormerken und übertragen · 2026-11-17 · e8144c5`

## Nacharbeit (2026-11-17, N1–N5)

> Ausgangsstand `58020a1`, vorher `git merge main` (`1eddc91`, ohne Konflikt) · Dauer 00:05 – 00:16 (11 min)

### Commits
- `1eddc91` Merge branch 'main' into worktree-W.33-client-uuid-lokale-rezepte
- `c3e42c1` fix(frontend): UUID per crypto.randomUUID erzeugen
- `94d0287` fix(frontend): Vormerkung je Nutzer, 409-Abgleich über den Ersteller
- `e8144c5` docs(frontend): Rules zur Vormerkung je Nutzer und 409-Abgleich nachziehen
- (diese Fortschreibung)

### Umsetzung
- **Vorklärung N1:** `created_by` ist `uuid.UUID(payload["sub"])` aus dem Access-Token (`auth/dependencies.py`). Das Backend prüft `aud`/`azp` gegen die eine Client-ID, ID-Token und Access-Token stammen also vom selben Client und tragen denselben `sub`. Das ist abgeleitet (Keycloak-Verhalten), nicht live geprüft. Verglichen wird ohne Groß-/Kleinschreibung, weil das Backend den `sub` als kanonische UUID ausgibt.
- **N1:** Bei 409 vergleicht das GET `created_by` mit `currentUserSub()`. Ein fremdes Rezept ergibt `rejected`. Bei einem eigenen Rezept wird der Serverstand mit dem vorgemerkten Stand verglichen (Nutzlast als JSON-Kopie). Weicht er ab, folgt ein PUT.
  - Ein Eintrag verlässt die Vormerkung erst, wenn der Server den vorgemerkten Stand hat (`settle`). Wurde das Rezept während der Anfrage bearbeitet, folgt ein PUT, höchstens 3 je Lauf. Scheitert der PUT, bleibt der Eintrag vorgemerkt. Beim nächsten Laden kommt 409 mit eigenem Ersteller, dann wieder ein PUT (B6).
- **N2:** Wird ein Rezept während des POST gelöscht und hat der POST angelegt (201, eigenes 409 oder PUT), folgt ein `DELETE`.
- **N3:** `PendingCreate.sub` wird beim Anlegen gesetzt. `listPending` liefert nur Einträge des angemeldeten Nutzers, und nur diese werden übertragen und angezeigt. Fremde Einträge bleiben unverändert in der IDB.
- **N4:** `readPendingCreates`/`writePendingCreates` werfen Fehler, statt `undefined` zu liefern oder sie zu schlucken.
  - `addPending` wirft `LocalSaveError`, `appendRecipe` meldet dann `failed` mit „Rezept nicht angelegt: konnte auf diesem Gerät nicht gespeichert werden.“.
  - Nach einem Lesefehler wird nicht geschrieben: Jeder Schreibzugriff liest unter `locked` und bricht beim Fehler ab. `listPending` liefert bei einem Lesefehler eine leere Liste, ohne zu schreiben.
  - `setRecipe` und `deleteRecipe` behandeln einen IDB-Fehler als „nicht vorgemerkt“ und gehen zur API. Sonst wäre ohne IndexedDB (privater Modus) jedes Bearbeiten gescheitert.
- **N5:** `generateUUID` nutzt `crypto.randomUUID()`, wenn verfügbar, sonst den bisherigen Rückfall.

### Verifikation
- `npm run lint:check && npm run typecheck && npm test && npm run build` → grün, 26 Testdateien, 246 Tests (vorher 237: +6 Store B1–B6, +1 B5 Lesefehler, +2 `uuid.spec.ts`), Build in 1,02 s. Prüfzeit 1 min 13 s.
- Backend nach dem Merge (selbst nicht geändert): `ruff check`, `ruff format --check`, `pytest` → 134 passed, 13 skipped, 2,0 s. Die DB-Tests habe ich nicht erneut ausgeführt, weil das Backend in der Nacharbeit nicht geändert wurde.
- Abnahmetests (`store/recipeStore.spec.ts`):
  - B1: Bearbeitung nach verlorener Antwort wird per PUT übertragen.
  - B2: Nach einer Umbenennung wird das Rezept als eigenes erkannt und danach normal bearbeitet (PUT) und gelöscht (DELETE).
  - B3: Bei Löschen während des POST geht ein `DELETE` hinaus.
  - B4: Einträge von Nutzer A werden mit Sitzung B weder angezeigt noch übertragen noch beschrieben, mit A dann übertragen.
  - B5: Schreibfehler ergibt `failed`. Ein Lesefehler führt nie zu einem Schreibzugriff, die IDB bleibt unverändert.
  - B6: Scheitert der PUT, bleibt der Eintrag; das nächste Laden schiebt nach.
- Gegenprobe per Mutation (Scratchpad, jeweils zurückgesetzt). Jede Mutation lässt mindestens einen Test scheitern:
  - Ersteller ignoriert
  - kein PUT bei abweichendem Stand
  - Eintrag vor dem PUT entfernt
  - kein DELETE
  - kein `sub`-Filter
  - Schreibfehler geschluckt
  - Lesefehler als leer gewertet
- Sichtprüfung: keine

### Abweichungen und Befunde
- **N2 greift nur für Admins:** `DELETE /recipes/{id}` verlangt `require_admin`. Bei einem Editor scheitert das nachgeschobene DELETE mit 403 (Warnung im Log), und das Rezept taucht beim nächsten Listenabruf wieder auf. Ob Editoren eigene Rezepte löschen dürfen, ist eine fachliche Entscheidung und nicht Teil dieses Auftrags. Mögliche Folgepunkte: DELETE für den Ersteller erlauben, oder das Löschen eines gerade übertragenen Rezepts für Nicht-Admins sperren · S.
- **Höchstens 3 PUTs je Rezept und Lauf**, falls der Nutzer während der Übertragung weiter bearbeitet. Danach bleibt der Eintrag für den nächsten Lauf vorgemerkt. Schutz gegen eine Endlosschleife, im Auftrag nicht genannt.
- **`setRecipe`/`deleteRecipe` bei IDB-Fehler:** gehen zur API, statt zu werfen (siehe N4). Ist das Rezept tatsächlich vorgemerkt und die IDB nur gerade nicht lesbar, ergibt das PUT bzw. DELETE ein 404, das nur protokolliert wird.
- **Vergleich bei eigenem 409:** Das Backend normalisiert Rezeptdaten (`normalize_recipe_data`, z. B. `sections`). Ein Unterschied nur durch die Normalisierung löst einen überflüssigen, aber harmlosen PUT aus.
