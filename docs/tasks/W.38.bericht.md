# Bericht W.38: Datenverlust abschließen

> Branch `worktree-W.38-datenverlust-abschliessen` · Basis `3aca08f` · Stand siehe letzter Commit · 2026-11-18 · Dauer: 13:28 – 13:53 (25 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Eine Fassung, die nur aus der Listenzeile stammt, kann nicht mehr als `data` gespeichert oder angelegt werden. `setRecipe` und `appendRecipe` lehnen sie zentral ab (`IncompleteRecipeError`), egal wer sie aufruft. Ist das Detail weder vom Server noch aus dem Cache ladbar, zeigt der Editor eine Meldung statt der Listenzeile, und Speichern ist gesperrt. Wird ein vorgemerktes Rezept gelöscht, bevor die Übertragung es anlegt, legt die Übertragung es nicht mehr an. Ein fremdes 409 bleibt auch nach einer Bearbeitung abgelehnt und wird nie per `DELETE` gelöscht, auch nicht von einem Admin. Die Rezeptansicht zeigt im Kopf „Nur auf diesem Gerät“ bzw. „Vom Server abgelehnt“.

**Nebenbei gefunden und behoben:** Admin → Rezepte → „Duplizieren“ und „YAML-Export“ arbeiteten mit `store.recipes[index]`, also mit der Listenzeile. Duplizieren legte eine leere Kopie an, der Export lieferte YAML ohne Zutaten und Schritte.

## Commits
- `d8e11be` feat(frontend): Kennzeichnung lokaler Rezepte auch in der Rezeptansicht
- `244ec63` fix(frontend): Listenzeile nie speichern, Lösch-Rennen und fremdes 409
- `d1d7bf4` docs(frontend): Sperre gegen Listenzeilen und fremdes 409 in Regeln
- `bdc0e58` docs(frontend): Screenshots zu W.38 (Kennzeichnung, Edit nicht ladbar)
- dazu dieser Bericht

`244ec63` umfasst die Punkte 1 bis 3 gemeinsam: `recipeStore.ts`, `offlineCache.ts` und die Store-Spec betreffen alle drei, und der Pre-commit-Hook prüft den Typecheck über den ganzen Baum. Ohne interaktives `git add -p` ließ sich das nicht sauber trennen.

## Lösungsweg Sperre (Punkt 1)
- **Kennzeichen `listOnly?: true` am `Recipe`**, gesetzt von `listItemToRecipe`. Es übersteht die `deepCopyJSON`-Kopien im Editor, deshalb greift die Sperre im Store auch für Kopien, die ein Aufrufer weiterreicht. Ein Symbol oder eine WeakSet ginge bei jeder JSON-Kopie verloren, die Sperre wäre dann wirkungslos.
- **Nie persistiert, nie im Payload:**
  - `offlineCache` entfernt es beim Schreiben von Liste, Detail und Vormerkung (`withoutListOnly`).
  - `recipeToPayload` und `detailToRecipe` lassen es weg.
  - Tests: `recipeMapping.spec.ts` (Payload, auch als JSON-String geprüft; Detail mit `listOnly` in `data`).
- **Nach dem Neustart neu abgeleitet:**
  - `markListRows` (`listSync.ts`) kennzeichnet beim Lesen des Listen-Caches jede nicht vorgemerkte Zeile ohne Zutaten und Schritte, im Cache-Pfad von `loadRecipes` und in `showCachedData`.
  - Das deckt auch Caches von vor diesem Stand ab, denn die enthalten kein Kennzeichen.
  - Ein echtes Rezept ohne Zutaten und Schritte gilt dabei ebenfalls als Listenzeile. Das kostet beim Öffnen nur einen Detailabruf.
  - Vorgemerkte Rezepte bleiben ungekennzeichnet, auch wenn sie ohne Zutaten sind (Test).
- **Vollständige Fassung holen:**
  - `store.loadCompleteRecipe` holt das Detail von der API, sonst aus dem Detail-Cache, sonst liefert es `null`.
  - Ein Cache-Eintrag, der selbst wie eine Listenzeile aussieht, zählt nicht. Solche Einträge konnte der Tag-Fehler vor W.37 geschrieben haben.
  - Genutzt von `useRecipeHelper.loadRecipe` (neu: `loadFailed`; ein Zähler verhindert, dass ein veraltetes Laden das gerade geöffnete Rezept überschreibt) und vom Admin-Duplizieren und -Export.
- **Edit.vue:**
  - Solange eine Listenzeile geladen wird: Spinner statt Editor.
  - Nicht ladbar: Meldung „Rezept konnte nicht geladen werden. Bearbeiten ist erst wieder möglich, wenn der Server erreichbar ist.“
  - Speichern ist gesperrt, auch per Strg+S.
  - Ein vorhandener Entwurf wird darüber nicht wiederhergestellt; er bleibt in localStorage erhalten.

## Geprüfte Schreibwege
| Weg | Kann eine Listenzeile weiterreichen? | Ergebnis |
|---|---|---|
| `Edit.vue` Speichern | ja, bei fehlgeschlagenem Detail-GET ohne Cache | Editor öffnet nicht; Store-Sperre als zweite Linie |
| `Recipe.vue` Duplizieren | ja, wenn die Ansicht nur die Listenzeile hat | `appendRecipe` lehnt ab: „Rezept nicht angelegt: Rezept nicht vollständig geladen.“ |
| `Recipe.vue` YAML-Export | ja | Meldung „Rezept nicht exportiert: nicht vollständig geladen.“, keine Datei (Test) |
| `AdminRecipes` Duplizieren | **ja, immer** (Fund) | über `loadCompleteRecipe`; nicht ladbar → Meldung |
| `AdminRecipes` YAML-Export | **ja, immer** (Fund) | wie Duplizieren |
| `AdminRecipes`/`HomeView` YAML-Import | nein (Datei); enthält sie `listOnly`, lehnt `appendRecipe` ab | unverändert |
| `HomeView` Neu, Beispiel | nein | unverändert |
| KI-Import (`useRecipeImport`) | nein (Rezept aus der KI-Antwort) | unverändert |
| Vorschau (Edit, BModal) | schreibt nicht | unverändert |
| Karte, Tags (`setRecipeTags`) | `PUT` nur mit `tags` (W.37) | unverändert |
| Übertragung (`createWithClientId`, `pushUpdate`) | nein: Die Vormerkung entsteht nur über `appendRecipe`/`setRecipe`, beide gesperrt | unverändert |

## Verifikation
- `npm run lint:check && npm run typecheck && npm test && npm run build` (aus `C:/…/frontend`): grün, 39 Testdateien, 385 Tests, Build 1,2 s.
- Neue bzw. geänderte Tests:
  - `recipeStore.spec.ts`:
    - `setRecipe`/`appendRecipe` lehnen die Listenzeile ab (kein PUT bzw. POST, Liste unverändert, nichts vorgemerkt)
    - Listen-Cache nach Neustart: Listenzeilen gesperrt, Vorgemerktes bleibt bearbeitbar (`local`); vorläufige Cache-Daten gekennzeichnet
    - `loadCompleteRecipe`: API, Cache, leerer Cache → `null`, Vorgemerktes unverändert
  - Rennen mit Deferreds:
    - Lauf hängt am ersten POST, zweites Rezept wird gelöscht (DELETE 404, Eintrag entfernt), ein nachgesendetes DELETE würde scheitern → kein POST für das gelöschte, kommt nicht zurück
    - während des eigenen POST gelöscht, DELETE der Übertragung 503 → bleibt als Löschung vorgemerkt, Listenabruf blendet es aus, nächste Übertragung erledigt es
  - Fremdes 409 als Admin:
    - nach Bearbeitung weiter `rejected`/`foreign`, keine neue Übertragung, Löschen ohne `DELETE`
    - Altbestand `rejected: 409` ohne Feld
    - Löschen während des POST, Server antwortet mit fremdem 409 → nie `DELETE`
  - Geändert: „während der eigenen Übertragung gelöscht“ erwartet jetzt ein `DELETE` (von der Übertragung) statt zwei (siehe Abweichungen).
  - `recipeMapping.spec.ts`: Kennzeichen nie im Payload, nie aus dem Detail, `withoutListOnly`, `looksLikeListRow`.
  - `useRecipeHelper.spec.ts`: Listenzeile wird ersetzt bzw. `loadFailed`.
  - `Edit.spec.ts`: nicht ladbar → Meldung, kein Eingabefeld, Speichern deaktiviert, auch direkter `saveRecipe`-Aufruf ohne `setRecipe`.
  - `Recipe.spec.ts`: `localStatus` geht an `RecipeDisplay`; YAML-Export einer Listenzeile.
  - `RecipeDisplay.spec.ts`: Kennzeichnung mobil und Desktop, beide Status.
- Gegenprobe (Mutation): Ohne die Prüfung vor dem POST wird der Renntest „vor seiner Anlage gelöscht“ rot. Ohne das aufgeschobene `DELETE` werden „während der eigenen Übertragung gelöscht“ und die beiden Admin-Tests rot.
- Sichtprüfung: Production-Build hinter einem Mock-Server (statische Auslieferung, Mock-API mit Detail-GET 503, POST 503 bzw. 403). Sitzung und Vormerkung per Seed-Seite in localStorage und IndexedDB vorbelegt. Edge headless über playwright-core, iPhone 390 × 844 hell, Bilder in `docs/plans/w38-datenverlust/`:
  - `iphone-hell-rezept-nur-auf-geraet.png`, `iphone-hell-rezept-abgelehnt.png`: Kennzeichnung im Kopf, gemessen 19,2 px hoch, 12 px Schrift (wie an der Karte)
  - `iphone-hell-edit-nicht-ladbar.png`: Editor eines Server-Rezepts bei Detail-GET 503 ohne Cache: Meldung, Speichern ausgegraut
- Prüfzeit: ~6 min; größter Posten: Screenshot-Harness aufbauen (der aus U.1/W.37 lag nicht mehr vor).
- Prüfskripte: nur Scratchpad.

## Struktur und Doku
- Gewachsene Dateien: `pendingCreates.ts` 509 → 547 Zeilen (nur Vormerkung: `isForeign`, `stillOpen`), `recipeStore.ts` 717 → 760, `recipeStore.spec.ts` um ~290 Zeilen.
- Neues Modul: `components/recipe/ui/LocalStatusBadge.vue`, aus `RecipeCard.vue` herausgelöst statt kopiert. Karte und Rezeptansicht nutzen dieselbe Komponente.
- Rules: nachgetragen in `.claude/rules/frontend.md` (Sperre gegen Listenzeilen und `loadCompleteRecipe` unter „Speichern“, fremdes 409, Prüfung vor dem POST, `DELETE` während der eigenen Übertragung und Kennzeichnung unter „Vormerkung“).

## Mitgenommen
- nichts

## Abweichungen vom Auftrag
- **Löschen während der eigenen Übertragung:** Bisher sendete `deleteRecipe` sofort ein `DELETE`, auch während der POST desselben Rezepts lief. Ist die ID fremd (409), hätte dieses `DELETE` für einen Admin das fremde Rezept gelöscht. Deshalb sendet jetzt nur noch die Übertragung das `DELETE`, und zwar erst, wenn ihr POST das Rezept als eigenes angelegt hat. Der bestehende Test wurde angepasst (ein `DELETE` statt zwei).
- **Prüfung vor dem POST:** Variante „vor dem POST unter `locked` prüfen“ (`stillOpen`) statt „Markierung neu schreiben“. Sie sendet außerdem den aktuellen Stand des Eintrags, nicht den Schnappschuss vom Laufbeginn; das spart einen PUT, wenn das Rezept inzwischen bearbeitet wurde.
- **Außerhalb der Ablage geändert:** `components/admin/AdminRecipes.vue` (Fund, siehe Tabelle), `components/recipe/ui/RecipeCard.vue` (Badge herausgelöst), `js/offlineCache.ts` (Kennzeichen entfernen, Feld `foreign`), `js/appendFeedback.ts` (Meldung), `store/listSync.ts` (`markListRows`), `types/recipe.ts`.
- **`SaveResult` `local` hat optional `stillRejected`**, damit die Karte und die Rezeptansicht nach der Bearbeitung eines fremden Rezepts weiter „abgelehnt“ zeigen. Das kommt ohne zusätzliche IndexedDB-Lesung aus.

## Nachgetragen in Specs/Plänen
- `docs/plans/w38-datenverlust/`: Screenshots

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Backend als zweite Linie gegen leeres `data`:**
  - Bisher ersetzt `update_recipe` `data` vollständig.
  - Vorschlag: Teil-Update (Merge), oder ein PUT, der Zutaten und Schritte leert, obwohl beide vorher gefüllt waren, wird abgelehnt (422).
  - Damit wäre auch ein künftiger Client-Fehler oder ein alter, noch installierter PWA-Stand abgefangen. Bis alle Geräte das Update haben, kann ein alter Client den W.37-Fehler weiter auslösen. · S
- **Restrisiko fremde ID ohne Markierung:**
  - Ein vorgemerktes Rezept, das nie übertragen wurde und dessen UUID zufällig einem fremden Rezept gehört, würde ein Admin beim Löschen per `DELETE` treffen.
  - Praktisch nur bei einer UUID-Kollision.
  - Absichern ließe sich das im Client (GET mit Ersteller-Abgleich vor dem `DELETE`) oder im Backend (Admin-`DELETE` nur mit ausdrücklichem Parameter). · XS–S
- **Screenshot-Harness wiederholbar ablegen**, z. B. `frontend/scripts/shots/` mit Mock-API und Seed. Er wurde seit U.1 mehrfach neu gebaut. · S
- **Entwurf bei nicht ladbarem Detail:** Der Entwurf bleibt erhalten, wird aber erst angeboten, wenn das Detail wieder ladbar ist. Bewusst so, nur zur Kenntnis.

## Szenario für deine Sichtprüfung
1. Online ein Rezept öffnen, das noch nie im Detail geöffnet wurde (sonst steht es im Detail-Cache): Die App frisch starten bzw. in DevTools → Application den Eintrag `recipe:<id>` in IndexedDB `keyval-store` löschen.
2. In der Galerie bleiben, dann den Server unerreichbar machen (DevTools → Network → Request-Blocking auf `*/api/v1/recipes/*`; „Offline“ allein reicht nicht, weil dann die Sitzung `offline` ist und der Editor ebenfalls aus dem Cache liest).
3. Rezept öffnen → ⋮ → Bearbeiten.
4. Erwartet: kurz Spinner, dann „Rezept konnte nicht geladen werden …“; Speichern ausgegraut, Strg+S meldet dasselbe. Auf dem Server bleibt das Rezept unverändert.
5. Gegenprobe: Blockierung aufheben, Seite neu laden → Editor mit Zutaten und Schritten.

## Status je Roadmap-Punkt
- `W.38` fertig (Sichtprüfung steht aus)

## Vorschlag Roadmap-Zeilen
`- [x] W.38 Datenverlust abschließen (Sperre gegen Listenzeilen, Prüfung vor POST, fremdes 409 ohne DELETE, Kennzeichnung in der Rezeptansicht) · 2026-11-18 · bdc0e58`
