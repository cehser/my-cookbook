# Bericht W.40: Backend-Schutz gegen leeres `data`, Kleinkram nach W.38, Screenshot-Harness

> Branch `worktree-W.40-schutzlinie-und-harness` · Basis `28c3540` (= `63b5ee9` + `docs(roadmap)`) · Stand `5c49b2f` · 2026-11-18 · Dauer: 15:37 – 15:58 (21 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
- **W.40:** `PUT /recipes/{id}` antwortet mit 422, wenn ein Rezept mit Inhalt weder Zutaten noch Schritte behielte. Rezept, Tags und `updated_at` bleiben dann unverändert. Damit können alte PWA-Stände den Datenverlust aus W.37 auf dem Server nicht mehr auslösen.
- **W.41:**
  - Der Editor meldet bei fremd abgelehnten Rezepten „nur auf diesem Gerät, abgelehnt“.
  - `saveFailedMessage` hat einen eigenen Text für Listenzeilen und zeigt bei der neuen 422 den Grund vom Server.
  - Vor dem `DELETE` eines nie bestätigten, vorgemerkten Rezepts prüft ein GET, wer es angelegt hat.
- **W.42:** `npm run shots -- <szenario|all> [ordner]` macht die Screenshots aus W.38 mit installiertem Edge oder Chrome nach.

## Commits
- `5988d2d` feat(backend): PUT lehnt das Leeren von Zutaten und Schritten mit 422 ab
- `f16ba36` fix(backend): 422-Detail beim Leeren als kurzen Grund für den Client
- `99c2386` feat(frontend): Meldungen für fremd abgelehnte Rezepte und 422 beim Leeren
- `5427aad` test(frontend): Erwartung an den Text für fremd abgelehnte Rezepte korrigieren
- `faf96fc` feat(frontend): Ersteller-Abgleich vor dem DELETE vorgemerkter Rezepte
- `8e98b59` build(frontend): Screenshot-Harness mit playwright-core
- `fb46623` docs(frontend): Beispielbilder des Screenshot-Harness (W.38 nachgestellt)
- `5c49b2f` chore(backend): ruff format für den 422-Text

## Verifikation
- Frontend: `npm run lint:check && npm run typecheck && npm test && npm run build` → grün.
  - 39 Testdateien, 393 Tests
  - `typecheck` prüft jetzt auch `scripts/shots`
  - Build in 575 ms; Gesamtlauf 28,8 s
- Backend: `uv sync --frozen && uv run ruff check && uv run ruff format --check && uv run pytest` → grün, 158 bestanden, 27 übersprungen (2,52 s).
  - Der erste Lauf war rot: `ruff format` bemängelte `f16ba36`. Behoben in `5c49b2f`.
- DB-Tests gegen `postgres:16-alpine`: `pytest -m db` → 27 bestanden (8,62 s). Neu sind 6 Fälle:
  - Ablehnung ohne Änderung an Daten, Tags und `updated_at`
  - PUT im Stil der alten Listenzeile, mit `tags`
  - ein leeres Rezept bleibt leer und lässt sich wieder füllen
  - nur Zutaten leeren, nur Schritte leeren
  - PUT nur mit `tags`
- Dazu Unit-Tests der Regel ohne DB: `tests/test_recipe_schema.py`.
- Container nicht gebaut: keine Änderung an Backend-Abhängigkeiten, Dockerfile oder Migrationen. `playwright-core` ist eine Frontend-devDependency ohne Install-Skript.
- Sichtprüfung mit `npm run shots -- all docs/plans/w40-screenshot-harness`, Laufzeit 11,5 s:
  - 6 Bilder (iPhone hell/dunkel × 3 Szenarien), inhaltlich gleich den W.38-Bildern
  - Desktop einmal geprüft (`SHOTS_DEVICES=desktop`)
- Prüfzeit: ~3 min; größter Posten: Frontend-Gesamtlauf.
- Prüfskripte: wiederholbar abgelegt unter `frontend/scripts/shots/`.

## Struktur und Doku
- **Neue Module:**
  - `frontend/src/store/serverCreator.ts` (`isOwnRecipe`, `serverCreator`). Der `sub`-Abgleich für Serverrezepte steht jetzt an einer Stelle, auch `createWithClientId` nutzt ihn.
  - `frontend/scripts/shots/`: `run.ts`, `mockApi.ts`, `seed.ts`, `scenarios.ts`, `types.ts`, `tsconfig.json`
- **Gewachsen:**
  - `pendingCreates.ts` 547 → 596 Zeilen. GET und Entscheidung liegen in `serverCreator.ts`. In `pendingCreates.ts` stehen nur die Reaktion darauf (`creatorBeforeDelete`: Ausfall, aufgegeben, fremd) und das Herauslösen von `dropAfterDeletion`. Die Reaktion hängt an `dropEntry`/`noteDeleted`, die modulintern sind.
  - `recipeStore.spec.ts` +~110 Zeilen
  - `tests/db/test_api.py` +109 Zeilen
- **Rules:**
  - `.claude/rules/backend-db.md`: PUT-Sperre
  - `.claude/rules/frontend.md`: Speichern-Meldungen, Ersteller-Abgleich, Verweis auf den Harness
  - neu `.claude/rules/screenshots.md` mit `paths: frontend/scripts/shots/**`
- **Harness in Lint und Typecheck:** `eslint .` deckt `scripts/` ab. Eigener `tsconfig` (Node-Auflösung, `erasableSyntaxOnly`), eingebunden über `npm run typecheck`, das damit auch in CI läuft. Ausgeführt wird der Harness in CI nicht, und er gelangt nicht in den Build (Vite bündelt nur `src/`).
- **`@types/node`** nutzt der Harness-`tsconfig` transitiv (26.6.6 im Lock). Es ist nicht direkt deklariert, um keine weitere Abhängigkeit ohne Rückfrage einzuführen. Fällt es transitiv weg, scheitert `typecheck`.

## Mitgenommen
- nichts

## Abweichungen vom Auftrag
- **422-Text gekürzt** (`f16ba36`): Das Frontend zeigt ein Klartext-`detail` einer 422 als Grund an („Rezept nicht gespeichert: Zutaten und Schritte würden geleert, Rezept unverändert. Bitte neu laden und erneut bearbeiten.“). Ein `detail` als Liste (Pydantic-Validierung) ergibt weiter „Rezeptdaten ungültig“.
- **Ersteller-Abgleich, Randfälle:** Der Auftrag nennt sie nicht, ich habe sie so festgelegt:
  - Übrige 4xx beim GET (z. B. 403): Löschung aufgegeben, ohne `DELETE`. Ohne Bestätigung wird nie gelöscht.
  - Ohne `sub`: Markierung bleibt. „Fremd“ lässt sich so nicht entscheiden.
  - Fremd: kein `noteDeleted`, damit das fremde Serverrezept nach dem nächsten Abruf sichtbar bleibt.
  - Hat die Übertragung die Anlage gerade bestätigt (`knownOwn`), entfällt das GET.
- **Bestehende Tests angepasst:**
  - „vor seiner Anlage gelöscht“ prüft jetzt GET 404 → kein `DELETE`, vorher DELETE 404.
  - Zwei Tests bekommen ein GET-Mock für den eigenen Ersteller.
- **Commit-Hygiene:** `99c2386` wurde mit einem roten Test committet, weil ich die Befehle falsch verkettet hatte; behoben in `5427aad`. Den eigenen, ungepushten Commit `5c49b2f` habe ich per `--amend` umbenannt (Typ `style` → `chore`).

## Nachgetragen in Specs/Plänen
- `docs/plans/w40-screenshot-harness/`: 6 Beispielbilder

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Hinweis für die Sichtprüfung, alte Clients:** Ein PWA-Stand von vor W.37 verschluckt die 422 und schreibt die leere Fassung trotzdem in seinen lokalen Cache. Der Server bleibt heil. Das alte Gerät zeigt das Rezept bis zum Update leer, nach dem Update und einem Listenabruf wieder vollständig. Prüfen: mit einem alten Stand die Tags an der Karte ändern → Server-Detail unverändert.
- **Dunkelmodus, Rezeptkopf ohne Bild:** Die Bildfläche oben bleibt hellgrau, sichtbar in `iphone-dunkel-rezept-*.png`. Das bestand schon vor diesem Auftrag. Vorschlag U-Punkt · XS
- **`@types/node` direkt als devDependency** deklarieren, falls der Harness-Typecheck nicht vom transitiven Paket abhängen soll · XS (neue Abhängigkeit, Rückfrage)

## Status je Roadmap-Punkt
- `W.40` fertig
- `W.41` fertig
- `W.42` fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.40 Backend-Sperre gegen leeres data (PUT 422, wenn Zutaten und Schritte geleert würden) · 2026-11-18 · 5c49b2f`
`- [x] W.41 Kleinkram nach W.38 (Meldung fremd abgelehnt, saveFailedMessage, Ersteller-Abgleich vor DELETE) · 2026-11-18 · faf96fc`
`- [x] W.42 Screenshot-Harness (frontend/scripts/shots, npm run shots, playwright-core 1.65.1) · 2026-11-18 · fb46623`
