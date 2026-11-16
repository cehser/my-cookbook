# Auftrag W.33: Client-UUID beim Anlegen, lokal gespeicherte Rezepte nachladen statt verlieren

> Erstellt 2026-11-16 vom Master · Roadmap: `ROADMAP.md` Punkt W.33 (Rest) · Basis: `main@a44d523` · Aufwand: M–L · Modell: Opus

## Ziel
Rezepte, die nur auf dem Gerät angelegt wurden (Ergebnis `local` aus W.31), gehen nicht mehr verloren. Sie bleiben über Neuladen und App-Neustart erhalten und werden beim nächsten Laden mit gültiger Sitzung mit ihrer UUID zum Backend übertragen. Eine Wiederholung legt dank Client-UUID (Backend seit W.32) nichts doppelt an. Offline bearbeitete **bestehende** Rezepte und Konflikte bleiben ausdrücklich bei 12.1.

## Erst lesen
1. `docs/tasks/W.31.bericht.md` – „Offen und Folgepunkte“; `docs/tasks/W.32.bericht.md` – Vertrag `id`/409
2. `.claude/rules/frontend.md` (Anlegen, `dataSource`, `loginFollows`), `.claude/rules/backend-db.md` (Client-ID)
3. `frontend/src/store/recipeStore.ts` (`appendRecipe`, `insertCreated`, `createdPending`/`listSeq`, `loadRecipesFromApi`, `setRecipe`, `deleteRecipe`, `saveRecipes`), `js/offlineCache.ts`, `js/appendFeedback.ts`, `api/recipes.ts`
4. `backend/app/routes/recipes.py` (`create_recipe`), `app/schemas/recipe.py` (`RecipeCreate.id`)

## Auftrag
1. **UUID mitschicken:** `appendRecipe` sendet `recipe_uuid` als `id`. Bei 409 per `GET /recipes/{id}` abgleichen: Existiert das Rezept und passt der Name, gilt es als `created` (Wiederholung). Sonst ist es ein Fehler. Eine fremde Kollision ist bei UUIDv4 praktisch ausgeschlossen, darf aber nicht still überschrieben oder als eigenes Rezept übernommen werden.
2. **Ausstehende Anlagen dauerhaft vormerken:** Ein `local`-Rezept kommt in eine persistente Liste in der IndexedDB, getrennt von der Rezeptliste aus der API, z. B. `pendingCreates` in `offlineCache.ts`.
   - `loadRecipesFromApi` führt die ausstehenden Rezepte in die angezeigte Liste und den Listen-Cache ein, statt sie zu überschreiben.
   - Nach jedem Laden mit gültiger Sitzung werden sie nacheinander mit `id` übertragen:
     - **201** und **409 nach Abgleich:** aus der Vormerkung entfernen, Detail-Cache aktualisieren.
     - **Offline, Timeout oder 5xx:** vorgemerkt lassen, beim nächsten Laden erneut versuchen.
     - **4xx außer 409:** vorgemerkt lassen, nicht automatisch erneut senden. Der Nutzer bekommt einen Hinweis, das Rezept bleibt sichtbar und löschbar.
   - Übertragungen laufen nicht doppelt, wenn `loadAll` parallel oder erneut startet (Single-Flight).
3. **Bearbeiten und Löschen ausstehender Rezepte:** `setRecipe` auf ein vorgemerktes Rezept aktualisiert den Eintrag in der Vormerkung, statt `PUT` zu senden. Das Backend kennt das Rezept noch nicht, ein `PUT` gäbe 404. `deleteRecipe` entfernt es aus der Vormerkung, ohne API-Aufruf, und räumt auch `createdPending` auf. Damit ist der W.31-Befund behoben, nach dem ein gelöschtes Rezept nach einem laufenden Abruf wieder auftaucht.
4. **Abgelaufene Sitzung beim Anlegen:** Bei `rejected` mit Netz (`loginFollows`) und bei 401 nach gescheiterter Erneuerung ist das Ergebnis `failed` mit der Meldung „Bitte neu anmelden“, nicht `local`.
5. **Meldung bei `local`:** wahrheitsgemäß, etwa „Auf diesem Gerät gespeichert, wird beim nächsten Online-Start übertragen.“ Nach erfolgreicher Übertragung ein Toast („N Rezepte übertragen“). Ein Hinweis bei 4xx gemäß Schritt 2.
6. **Backend:** 409 in der OpenAPI-Doku von `POST /recipes` (`responses`); die Nil-UUID als `id` mit 422 ablehnen; Test.
7. **Doku:** Rule `backend-db.md` und `README.md` berichtigen: 409 heißt „existiert“, ein Client gleicht per GET ab, statt sie blind als Erfolg zu werten. `.claude/rules/frontend.md` um die Vormerkung ergänzen.
8. **Tests:**
   - **Vitest:** offline anlegen, App neu starten, wieder online, das Rezept wird übertragen und erscheint genau einmal. Laden vom Server während der Vormerkung verliert nichts. 409 mit Abgleich ergibt `created`. 4xx beim Übertragen lässt das Rezept vorgemerkt, ohne Schleife. Bearbeiten und Löschen eines vorgemerkten Rezepts. `rejected` beim Anlegen ergibt `failed`. `TypeError` (fetch ohne Netz) ergibt `local`. Kein doppeltes Senden bei parallelem `loadAll`.
   - **Backend:** Nil-UUID ergibt 422.

## Ablage
- Geändert: `store/recipeStore.ts` (+ Spec), `js/offlineCache.ts`, `js/appendFeedback.ts` (+ Spec), `api/recipes.ts` (`create` mit `id`, `get`), Rules, `README.md`; Backend `routes/recipes.py`, `schemas/recipe.py`, `tests/db/test_api.py`
- Wächst `recipeStore.ts` um mehr als ~80 Zeilen: Vormerkung und Übertragung in ein eigenes Modul, z. B. `store/pendingCreates.ts`, mit dem Store als dünner Aufrufer

## Nicht in diesem Auftrag
- Offline-Änderungen an bestehenden Rezepten, Änderungs-Warteschlange, Konflikterkennung (12.1)
- Vorlagen-Bilder für offline importierte Rezepte nachträglich hochladen (Blobs sind nach dem Import weg)
- Favoriten, Settings oder Bilder offline
- Hintergrund-Sync per Service Worker

## Entscheidungen, die ich treffe
- keine. Der Master hat entschieden: Bei 4xx bleibt das Rezept vorgemerkt und sichtbar, mit Hinweis, und wird nicht automatisch wiederholt. Bei 409 wird per GET abgeglichen.

## Fallstricke
- **Vormerkung statt Diff:** Ausstehende Rezepte sind nicht „Rezepte, die in der API-Liste fehlen“. So würden auf einem anderen Gerät gelöschte Rezepte wieder hochgeladen. Nur ausdrücklich vorgemerkte Rezepte übertragen.
- **Bestand vor W.33:** Rezepte, die vor diesem Auftrag als `local` gespeichert wurden, sind nur in der Rezeptliste des Caches und werden beim nächsten Online-Laden verworfen wie bisher. Eine Migration ist nicht nötig, sie stehen nicht in der Vormerkung. Im Bericht nennen.
- **ID-Gleichheit:** Mit Client-UUID sind lokale ID und Backend-ID gleich. Navigation, Entwürfe (`useDraft` nach UUID) und Detail-Cache bleiben nach der Übertragung gültig. Prüfen, dass kein Pfad noch die Antwort-ID als „neue“ ID behandelt.
- **`createdPending`/`listSeq` (W.31)** bleiben für Anlagen während eines laufenden Abrufs nötig. Zusammenspiel mit der Vormerkung testen: kein Duplikat, kein Verschwinden.
- **Übertragung braucht `valid`:** nicht bei `offline` oder `rejected` übertragen. Die Entscheidung kommt aus `session.ts`, keine eigene `navigator.onLine`-Prüfung.
- **README:** W.9 ändert die README parallel, Konflikt beim Merge möglich. Änderungen klein halten.
- **DB-Tests lokal** nur mit `postgres:16-alpine` (Rule `backend-tooling.md`).

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- Offline angelegtes Rezept übersteht App-Neustart und wird beim nächsten Online-Laden genau einmal übertragen (Test); Laden vom Server verliert keine vorgemerkten Rezepte
- 409 per Abgleich behandelt, 4xx beim Übertragen ohne Verlust und ohne Schleife; Bearbeiten/Löschen vorgemerkter Rezepte korrekt
- Anlegen bei abgelaufener Sitzung ergibt „Bitte neu anmelden“ statt lokaler Kopie
- Backend: 409 dokumentiert, Nil-UUID 422 (Test)
- Szenarien für meine Sichtprüfung im Bericht (offline importieren → App schließen → online öffnen; offline anlegen und bearbeiten; als `readonly` offline anlegen und online gehen)
- Verifikation gemäß Projekt-CLAUDE.md (Frontend und Backend inkl. DB-Tests)

## Nacharbeit (2026-11-17, nach Prüfung)

Ausgangsstand: `58020a1`. Vorher `git merge main` im Worktree.

- **N1 409-Abgleich über den Ersteller statt den Namen** (Befunde B1, B2, B6): Bei 409 per GET prüfen, ob `created_by` dem eigenen `sub` entspricht (vorher klären, dass `created_by` im Backend gleich dem `sub` aus dem Token ist; `currentUserSub()` in `session.ts`). Eigenes Rezept: weicht der Serverstand vom vorgemerkten Stand ab, den vorgemerkten Stand per PUT nachschieben, erst nach Erfolg aus der Vormerkung entfernen; scheitert der PUT, bleibt der Eintrag vorgemerkt und wird beim nächsten Laden erneut versucht. Gleiches gilt für die Bearbeitung während einer laufenden Übertragung (B6: Eintrag erst nach erfolgreichem PUT entfernen). Fremdes Rezept: `rejected` wie bisher. Hintergrund: POST committet, Antwort geht verloren (Timeout/504), Nutzer bearbeitet bzw. benennt um; heute überschreibt der alte Serverstand die Bearbeitung bzw. das Rezept hängt als „abgelehnt“ fest.
- **N2 Gelöscht während POST** (B3): Liefert `takeAfterCreate` nichts, weil das Rezept während der Anfrage gelöscht wurde, und hat der POST angelegt (201 oder eigenes 409), danach `DELETE` senden.
- **N3 Vormerkung je Nutzer** (B4): Jeder Eintrag speichert den `sub` beim Anlegen. Liste und Übertragung berücksichtigen nur Einträge des angemeldeten Nutzers; fremde bleiben unberührt in der IndexedDB (nicht übertragen, nicht als abgelehnt markiert, nicht angezeigt). Einträge ohne `sub` (Bestand aus dem Branch) gibt es produktiv nicht; keine Migration.
- **N4 IndexedDB-Fehler** (B5): Schreibfehler der Vormerkung werfen; `appendRecipe` meldet dann `failed` („konnte auf diesem Gerät nicht gespeichert werden“) statt `local`. Nach einem Lesefehler nicht schreiben (kein Überschreiben der Vormerkung mit einer leeren Liste).
- **N5 UUID** (B9): `generateUUID` nutzt `crypto.randomUUID()`, wenn verfügbar, sonst die bisherige Funktion.

### Abnahme Nacharbeit
- Je ein Vitest für B1 (Bearbeitung nach verlorener Antwort bleibt erhalten), B2 (Umbenennung nach verlorener Antwort, Rezept wird eigenes und bleibt bearbeit- und löschbar), B3 (gelöscht während POST, `DELETE` gesendet), B4 (Einträge von Nutzer A werden mit Sitzung B nicht übertragen und nicht angezeigt), B5 (Schreib- und Lesefehler), B6 (PUT scheitert, Eintrag bleibt)
- Verifikation gemäß Projekt-CLAUDE.md (Frontend; Backend nur, falls geändert)
- Bericht um Abschnitt „Nacharbeit“ fortschreiben
