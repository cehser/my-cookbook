# Bericht W.37: Speichern ehrlich, lokale Rezepte kennzeichnen, Frontend-Kleinkram

> Branch `worktree-W.37-speichern-ehrlich` · Basis `72df9d4` (= `39914c0` + `docs(roadmap)`) · Stand `da32895` · 2026-11-18 · Dauer: 11:34 – 12:08 (34 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
„Gespeichert“ erscheint nur noch, wenn der Server die Änderung hat. Bei einem vorgemerkten Rezept lautet die Meldung „auf diesem Gerät gespeichert“. Scheitert das Speichern, nennt die Meldung den Grund, und Entwurf, Editor-Stand und Liste bleiben erhalten. Ein gelöschtes vorgemerktes Rezept kehrt weder durch einen parallelen Listenabruf noch durch ein gescheitertes `DELETE` zurück, denn die Löschung bleibt vorgemerkt, bis der Server sie bestätigt. Karten vorgemerkter bzw. abgelehnter Rezepte tragen „Nur auf diesem Gerät“ bzw. „Vom Server abgelehnt“. Dazu: Modals ohne leeren Footer, `Settings.vue` entfernt, Manifest mit `application/manifest+json`.

**Wichtig, nebenbei gefunden und behoben:** Tags über die Karte zu ändern schickte die Listenzeile als `data` per PUT. Die Listenzeile hat keine Zutaten, Schritte, Notizen und Zeiten, und das Backend ersetzt `data` vollständig (`routes/recipes.py`, `update_recipe`). Jede Tag-Änderung an einer Karte hat damit den Inhalt des Rezepts auf dem Server gelöscht und zusätzlich den Detail-Cache überschrieben. Jetzt geht ein PUT nur mit `tags` raus (Details unter „Abweichungen“).

## Commits
- `9ad6128` feat(frontend): ehrliches Speichern und Lösch-Vormerkung im Store
- `c08049d` fix(frontend): Edit meldet nur nach Erfolg „Gespeichert“
- `957605a` feat(frontend): Karte kennzeichnet lokale Rezepte, Tags ehrlich
- `326bd75` fix(frontend): BModal ohne leeren Footer (no-footer statt hide-footer)
- `9b5720c` fix(deploy): manifest.webmanifest als application/manifest+json ausliefern
- `41ae547` docs(frontend): Speicherergebnis, Lösch-Vormerkung und Kennzeichnung in Regeln
- `da32895` docs(frontend): Screenshots zu W.37 (Kennzeichnung, Modals, Speicherfehler)

Die Löschung von `views/Settings.vue` steckt in `9ad6128`: Sie war per `git rm` schon gestaged und ist versehentlich mit in den Store-Commit gegangen. Ein Umschreiben per Rebase hat die Worktree-Sandbox abgelehnt, deshalb blieb es so.

## Verifikation
- `npm run lint:check && npm run typecheck && npx vitest run && npm run build` (aus `C:\…\frontend`) → grün: 33 Testdateien, 320 Tests, Build ok, 41 s.
- Neue bzw. geänderte Tests:
  - `store/recipeStore.spec.ts`:
    - `setRecipe`: Erfolg, PUT 403/422/500, offline, Sitzung abgelehnt; Liste erst nach Erfolg; während des Speicherns gelöscht; vorgemerkt → `local`
    - `setRecipeTags`: PUT nur mit Tags, Fehler lässt die Liste unverändert, vorgemerkt mit vollständigem Rezept
    - Geister-Fenster: Abruf vor und nach der `DELETE`-Antwort; `DELETE` scheitert → vorgemerkt und Wiederholung; offline gelöscht; abgelehnt ohne `DELETE`; Löschen während der Übertragung mit erstem 404
    - ungültiger Index
    - `localStatus`: vorgemerkt → abgelehnt → bearbeitet → übertragen, Ablehnung nach Neustart
  - `views/Edit.spec.ts` (neu): „Gespeichert“ nur bei Erfolg; bei 403, offline und 401 Toast mit Grund, Entwurf bleibt, Speichern bleibt aktiv; `local` meldet den Hinweis.
  - `RecipeCard.spec.ts`: Tag wird sofort angezeigt und bei Fehler samt Toast zurückgenommen; Kennzeichnung bei vorgemerkt bzw. abgelehnt, auch kompakt.
- Gegenprobe: Ohne den neuen Filter im Listenabruf werden die beiden Geister-Tests rot.
- Container: Frontend-Image lokal gebaut (`docker build`, `nginx:1.30-alpine`), gestartet mit `--add-host backend:127.0.0.1`. `curl -I /manifest.webmanifest` → `Content-Type: application/manifest+json`. Vorher: `mime.types` von nginx 1.30 kennt `.webmanifest` nicht, der Rückfall ist `default_type application/octet-stream`. Den Compose-Stack habe ich nicht gebaut, weil Backend und Migrationen unverändert sind.
- Probe-Merge `git merge-tree main HEAD` gegen das aktuelle `main` (`0eeb80c`, inkl. U.3): konfliktfrei.
- Sichtprüfung:
  - Aufbau: Production-Build hinter dem Mock-Server aus U.1/U.3, Edge headless über playwright-core. Den Mock habe ich korrigiert, sein POST übernimmt jetzt die Client-ID.
  - Geräte: iPhone 390 × 844 hell/dunkel, Tablet 1180 × 820.
  - Bilder in `docs/plans/w37-speichern-ehrlich/`:
    - `iphone-{hell,dunkel}-karten.png`: Kennzeichnung im Raster und in „Zuletzt geöffnet“
    - `iphone-hell-nach-uebertragung.png`: „Nur auf diesem Gerät“ ist nach der Übertragung ohne Neuladen weg, Toast „1 Rezept übertragen.“; „Vom Server abgelehnt“ bleibt
    - `iphone-hell-speichern-gescheitert.png`: PUT 500 → „Rezept nicht gespeichert: Fehler 500.“, Speichern bleibt aktiv
    - `iphone-hell-ki-import.png`, `iphone-dunkel-vorschau.png`: kein Modal-Footer (gemessen: 0 `.modal-footer`, hell und dunkel)
    - `tablet-hell-karten.png`: Kennzeichnung 19,2 px hoch, Tag-Chip 20,4 px, beide 12 px Schrift
- Prüfzeit: ~8 min; größter Posten: Screenshot-Läufe mit Mock-Server (zwei Läufe, der erste deckte den Fehler im Mock auf).
- Prüfskripte: nur Scratchpad (`shoot-w37.mjs` neben dem Mock-Server).

### Szenarien für deine Sichtprüfung
1. **Bestehendes Rezept offline bearbeiten und speichern:** Flugmodus, Rezept öffnen, bearbeiten, speichern. Erwartet: roter Toast „Rezept nicht gespeichert: keine Verbindung zum Server.“, der Haken bleibt aktiv. Zurück und erneut öffnen bringt „Entwurf wiederhergestellt.“ Online speichern ergibt „Gespeichert.“
2. **Tag offline ändern:** Flugmodus, an einer Karte „Tags“, Tag hinzufügen. Erwartet: Der Tag erscheint kurz, danach roter Toast mit Grund, der Tag verschwindet wieder. Online: Tag hinzufügen, Rezept öffnen. **Zutaten und Schritte müssen noch da sein** (vorher wurden sie gelöscht).
3. **Rezept offline anlegen und Karte ansehen:** Flugmodus, „Neues Rezept“, speichern, zur Startseite. Erwartet: Karte mit „Nur auf diesem Gerät“, auch unter „Zuletzt geöffnet“. Online gehen und App in den Vordergrund holen bzw. neu öffnen. Erwartet: Toast „1 Rezept übertragen.“, die Kennzeichnung verschwindet.
4. **Als `readonly` offline anlegen, online gehen:** Erwartet: Karte mit „Vom Server abgelehnt“. Rezept bearbeiten und speichern: Die Kennzeichnung wechselt zu „Nur auf diesem Gerät“.
5. **Vorgemerktes löschen bei wackeligem Netz:** offline anlegen, online gehen, sofort löschen. Erwartet: Das Rezept taucht nach einem Neuladen nicht wieder auf, auch nicht auf einem zweiten Gerät.

## Struktur und Doku
- Gewachsene Dateien:
  - `store/recipeStore.ts` 671 → 717 (+46, unter der Schwelle von ~60)
  - `store/pendingCreates.ts` 385 → 509 (Lösch-Vormerkung, `readPending`, `deleteOnServer`)
  - `RecipeCard.vue` 669 → 688
  - `recipeStore.spec.ts` → 1545
- Neue Module:
  - `store/saveRecipe.ts` (69): `SaveResult`, `saveChange`, `sessionError`
  - `views/Edit.spec.ts` (162)
- `sessionError` ersetzt die doppelte Zuordnung „Login folgt → 401, sonst offline“ in `deleteRecipe`. `appendRecipe` behält sein eigenes `sessionExpired()`.
- Rules: `.claude/rules/frontend.md` nachgetragen:
  - neuer Absatz „Speichern“
  - Vormerkung um Lösch-Markierung und Kennzeichnung ergänzt
  - Toast-Satz aus dem Favoriten-Absatz zur Vormerkung verschoben
  - `LocalReadError` beim Bearbeiten ist jetzt `failed` statt geworfen

## Mitgenommen
- nichts

## Abweichungen vom Auftrag
- **Tags per PUT nur mit `tags` (`setRecipeTags`)** statt über `setRecipe`. Grund: Datenverlust auf dem Server (siehe „Ergebnis“). Der Auftrag verlangte für die Karte nur Meldung und Rücknahme. Den bisherigen Weg ehrlich zu machen hätte den Datenverlust beibehalten. Es nutzt die bestehende API (`RecipeUpdate` erlaubt `data = None`); Schema, Backend und Migration sind unverändert. Bitte prüfen, ob schon Rezepte betroffen sind: Rezepte, deren Tags über die Karte geändert wurden, haben auf dem Server leere Zutaten und Schritte. Erkennbar ist das an `updated_at` zum Zeitpunkt der Tag-Änderung bei leerem `data.ingredients`. Ich habe nichts live geprüft.
- **`setRecipe(recipe)` statt `setRecipe({ index, recipe })`:** Die Liste wird per ID aktualisiert. Ein Index war nach dem `await` womöglich veraltet und hätte ein falsches oder gelöschtes Rezept überschrieben.
- **W.37 Punkt 4, Lösungsweg „erneut versuchen“ statt „melden“:** Eine Meldung nach einem gescheiterten `DELETE` wäre missverständlich gewesen. Das Rezept ist lokal schon weg, und ob der Server es überhaupt hat, ist offen (meist hat er es nicht). Deshalb bleibt die Löschung in der Vormerkung markiert (`deleted`), der Listenabruf blendet sie aus, und jede Übertragung sendet sie erneut, vor den Anlagen. Erledigt ist sie bei 204/404 oder bei einer endgültigen 4xx-Ablehnung. Abgelehnte Einträge entfallen sofort ohne `DELETE`, denn der Server hat sie nicht. Bei einem fremden 409 hätte ein Admin-`DELETE` sonst das Rezept eines anderen gelöscht. Läuft gerade die Übertragung genau dieses Rezepts, entfernt erst die Übertragung die Markierung. Damit ist auch der Fall abgedeckt, dass das erste `DELETE` mit 404 kommt und der POST danach noch anlegt.
- **W.34 Punkt 3, Rezeptansicht nicht gekennzeichnet:** Kompakte Karten sind dieselbe Komponente und deshalb mit gekennzeichnet. `Recipe.vue` und die Display-Komponenten hat U.3 gerade umgebaut (inzwischen auf `main`). Um Konflikte zu vermeiden, habe ich die Ansicht nicht angefasst. Folgepunkt unten.
- Nicht gebaut: der Compose-Stack. Begründung unter „Verifikation“.

## Nachgetragen in Specs/Plänen
- `docs/plans/w37-speichern-ehrlich/`: Belegbilder

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Datenverlust durch Tag-Änderung prüfen und reparieren** (siehe Abweichungen): betroffene Rezepte in der Produktiv-DB suchen und aus Backup bzw. Detail-Caches wiederherstellen. Nur mit deiner Freigabe, erst Trockenlauf · S
- **Kennzeichnung in der Rezeptansicht** („Nur auf diesem Gerät“ im Kopf von `RecipeDisplay`, Quelle `store.localStatus`) nach U.3 · XS
- **Abgelehntes und zugleich gelöschtes Rezept:** Wird ein vorgemerktes Rezept gelöscht, während sein POST mit 4xx abgelehnt wird, erscheint einmal der Toast „nicht übertragen“, obwohl der Nutzer es gelöscht hat. Kosmetisch, kein Handlungsbedarf.
- **Edit.vue speichert Bild und Rezept unabhängig:** Scheitert das Rezept, kann das Foto trotzdem hochgeladen sein. Bestehendes Verhalten, mit 12.1 betrachten · S

## Status je Roadmap-Punkt
- `W.37` fertig (Sichtprüfung steht aus)
- `W.34` fertig (Rezeptansicht als Folgepunkt)
- `W.36` fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.37 Speichern ehrlich (SaveResult, Liste erst nach Erfolg, Lösch-Vormerkung bis Serverbestätigung), Tag-PUT ohne data · 2026-11-18 · da32895`
`- [x] W.34 Lokale Rezepte an der Karte kennzeichnen (vorgemerkt/abgelehnt) · 2026-11-18 · 957605a`
`- [x] W.36 Frontend-Kleinkram: no-footer, Settings.vue entfernt, Manifest-Content-Type · 2026-11-18 · 9b5720c`
