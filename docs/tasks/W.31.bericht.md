# Bericht W.31: Auth-Nachzug nach W.23/W.28, Rezept anlegen robust, `useRecipeImport`

> Branch `worktree-W.31-auth-nachzug-anlegen` · Basis `bab174a` (= `df7b1e4` + `docs(roadmap)`) · Stand siehe letzter Commit · 2026-11-16 · Dauer: 18:26 – 18:42 (16 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Beim Anlegen eines Rezepts ist das Ergebnis jetzt eindeutig: `created`, `local` oder `failed`. Ein Fehler nach dem Anlegen erzeugt keine lokale Kopie und keine Meldung „offline“ mehr. Das Rezept kommt aus der Antwort direkt in die Liste, ohne Neuladen. Bei 4xx wird nichts lokal gespeichert, der Aufrufer zeigt einen Fehler. Alle Aufrufer werten das Ergebnis aus. Der Importablauf liegt in `useRecipeImport` und ist getestet. Netzprüfung und Login-Entscheidung liegen nur noch in `session.ts`. Nach einem Lock-Timeout greift der Backoff. Ein leerer Cache zeigt nicht mehr „Offline-Daten“.

## Commits
- `2efc852` fix(auth): Backoff nach Lock-Timeout, Re-Export getAccessToken entfernen
- `7667314` fix(frontend): Rezept anlegen mit eindeutigem Ergebnis, ohne Duplikat
- `80db0cc` refactor(ai): Importablauf in useRecipeImport auslagern
- `07df57b` docs(frontend): Regeln zu Anlegen, dataSource und Lock-Backoff nachziehen
- `9d5e307` fix(ai): doppeltes Wort im Hinweis zum Bild-Download entfernen
- (dieser Bericht)

## Umsetzung im Einzelnen
- **Auth:** Neu ist `loginFollows(state)` in `session.ts` (`rejected` und Netz). Der Store fragt das ab statt `navigator.onLine`, auch `onRoleUnavailable` nutzt es. Die Zustandstabelle aus W.23 bleibt unverändert gültig. `startBackoff()` greift nach `offline` mit Netz und jetzt auch nach dem Lock-Timeout.
- **`appendRecipe`** liefert `AppendResult`. Nach `created` übernimmt `insertCreated` das Rezept aus der Antwort (`detailToRecipe`) in Liste, Listen-Cache und Detail-Cache.
  - Gleichzeitige Abrufe: `loadRecipesFromApi` zählt die Abrufe (`listSeq`). Rezepte, die angelegt werden, während ein Abruf läuft, bleiben vorgemerkt (`createdPending`), bis ein später gestarteter Abruf fertig ist. Eine ältere Antwort, die nach einer neueren eintrifft, wird verworfen. So entfernt ein paralleles `loadAll` das neue Rezept nicht, und es erscheint nicht doppelt.
- **Meldungen:** `js/appendFeedback.ts` (`appendToast`, `appendedId`, `appendFailedMessage`, `LOCAL_ONLY_TEXT`) wird von HomeView, Recipe (Duplizieren), AdminRecipes und `useRecipeImport` genutzt. Die Texte:
  - `local`: „… Nur auf diesem Gerät gespeichert, nicht auf dem Server.“, ohne Versprechen späteren Hochladens.
  - `failed`: „Rezept nicht angelegt: keine Berechtigung / Rezeptdaten ungültig / Fehler N.“
- **`dataSource`:** Die Loader liefern `none`, wenn der Cache leer ist. `cache` gilt nur, wenn mindestens ein Teil aus dem Cache gelesen wurde. Das Beispielrezept als Rückfall zählt als `none`, die Migration aus dem alten localStorage als `cache`.

## Verifikation
- `npm run lint:check && npm run typecheck && npm test && npm run build` → grün: 25 Testdateien, 221 Tests (vorher 201, errechnet: +4 Session, +8 Store, +6 `useRecipeImport`, +3 `appendFeedback`, −1 Komponenten-Spec), Build in 1,49 s.
- Gegenprobe per Mutation, jeweils danach zurückgesetzt:
  - Backoff im Lock-Timeout entfernt: Der neue Session-Test fällt.
  - Merge `createdPending` entfernt: Der Test zum parallelen Listenabruf fällt.
  - Beispielrezept als `cache`: Der `dataSource`-Test fällt.
- Sichtprüfung: keine (kein Browser- oder Gerätelauf).
- Prüfzeit: 18:39:30 – 18:40:27, ~1 min. Größter Posten: Tests und Build.
- Prüfskripte: nur Scratchpad

### Szenarien für deine Sichtprüfung
1. **Import mit Vorlage:** Zwei Fotos, „Rezept erkennen“, „Rezept importieren“. Erwartet: Toast „Rezept … importiert.“, Bearbeitung mit Backend-ID, zwei Vorlagen am Rezept, das Rezept genau einmal in der Liste.
2. **Import offline:** Ergebnis erkennen lassen, dann Flugmodus und importieren. Erwartet: Erfolgs-Toast und Warnung „Nur auf diesem Gerät gespeichert, nicht auf dem Server. Die Vorlage wurde nicht gespeichert.“, Bearbeitung mit lokaler UUID.
3. **Neues Rezept als `readonly`:** Startseite, „Neues Rezept“. Erwartet: roter Toast „Rezept nicht angelegt: keine Berechtigung.“, keine Navigation, kein lokales Rezept in der Liste. Im Import-Dialog erscheint dieselbe Meldung im Dialog, Ergebnis und Seiten bleiben.
4. **Duplizieren:** Rezeptseite, Menü „Duplizieren“. Erwartet: Die Kopie öffnet sich, sie steht einmal in der Liste und auch nach Neuladen nur einmal.
5. **Start offline ohne Cache:** frische Installation bzw. Website-Daten gelöscht, Flugmodus, App öffnen. Erwartet: Banner „Offline · Keine Verbindung, noch keine Daten“, **ohne** „Offline-Daten“.

## Struktur und Doku
- Neue Module: `composables/useRecipeImport.ts` (108 Zeilen, + Spec), `js/appendFeedback.ts` (+ Spec). `AIRecipeImport.vue` schrumpft von 429 auf 370 Zeilen. `recipeStore.ts` wächst von 475 auf 535 Zeilen (Ergebnistyp, `insertCreated`, Schutz bei gleichzeitigen Abrufen).
- `js/appendFeedback.ts` importiert nur den Typ `AppendResult` aus dem Store. Es bleibt eine reine Funktion ohne Vue.
- Rules nachgetragen: `.claude/rules/frontend.md` (Anlegen, `dataSource`, `loginFollows`, Lock-Backoff; der Satz zum Re-Export ist entfallen) und `.claude/rules/ai-import.md` (Ablauf in `useRecipeImport`, `local`/`failed`).

## Mitgenommen
- `9d5e307` „Lokale Lokale Speicherung“ im Hinweis zum Bild-Download · XS

## Abweichungen vom Auftrag
- **`failed` im Import-Dialog:** Die Meldung erscheint als Fehler im Dialog (`alert-danger`), nicht als Toast. Der Dialog bleibt offen, Ergebnis und Seiten stehen für einen neuen Versuch bereit. Ein Toast neben dem offenen Modal wäre leichter zu übersehen. Die übrigen Aufrufer zeigen einen Toast.
- **Duplizieren (`Recipe.vue`)** zeigt bei `created` keinen Toast, wie bisher. Die geöffnete Kopie ist Rückmeldung genug. Bei `local` und `failed` erscheint ein Toast.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Anlegen bei abgelehnter Sitzung mit Netz** (`isAuthenticated() === false` wegen `rejected`): Das Rezept wird weiterhin lokal gespeichert (`local`), wie bisher, danach folgt der Login. Diese Kopie wird nie übertragen und beim nächsten erfolgreichen Listenabruf durch `writeRecipes` überschrieben. Das betrifft lokale Rezepte allgemein: Sie gehen beim nächsten Online-Laden aus Liste und Cache verloren. Die Meldung „nur auf diesem Gerät“ verspricht zwar keine Übertragung, aber auch keine Dauer. Gehört zu W.33/12.1. Bis dahin denkbar: `local` nur bei `offline`, bei `rejected` `failed` mit „Bitte neu anmelden“ (XS–S, fachliche Entscheidung).
- **`hasApiKey` in `AIRecipeImport.vue`** ist immer `true`, der Zweig „AI-Import nicht verfügbar“ ist toter Code. XS.
- **Zwischenstand von `7667314`:** Der Commit ändert die Signatur von `appendRecipe`, `AIRecipeImport.vue` folgt erst in `80db0cc`. Allein ausgecheckt ist `7667314` daher nicht typsauber. Der Pre-Commit-Hook prüft den Arbeitsbaum. Bei einem Squash-Merge spielt das keine Rolle.

## Status je Roadmap-Punkt
- `W.31` fertig (Sichtprüfung steht aus)

## Vorschlag Roadmap-Zeilen
`- [x] W.31 Auth-Nachzug, Rezept anlegen robust, useRecipeImport · 2026-11-16 · 9d5e307`
