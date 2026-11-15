# Bericht W.22: Service-Worker-Update steuern

> Branch `worktree-W.22-sw-update` · Basis `baa5e88` (Auftrag: `af486fb`) · Stand `cca25c0` + Bericht · 2026-11-15 · Dauer: 00:38 – 00:48 (10 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Ein neuer Service Worker wartet (`registerType: "prompt"`, kein `skipWaiting`/`clientsClaim` im erzeugten `sw.js`, nur der `SKIP_WAITING`-Message-Handler). `src/js/swUpdate.ts` aktiviert ihn still per `updateSW(true)` bei der nächsten Navigation (nicht die erste, nicht `/callback`) oder beim Wechsel in den Hintergrund, aufgeschoben solange eine schreibende Anfrage läuft. Beim Start und beim Wechsel in den Vordergrund ruft es `registration.update()` auf, höchstens alle 30 min und nur online.

## Commits
- `cca25c0` feat(pwa): Service-Worker-Update still bei Navigation oder Hintergrund aktivieren
- `2b251dc` docs(pwa): Rule zum Service-Worker-Update anpassen

## Verifikation
- `npm run lint:check` → 0 Fehler, 148 Warnungen (nur `␍` durch CRLF-Checkout unter Windows, nicht von dieser Änderung)
- `npm run typecheck` → grün
- `npm run build` → grün (PWA v1.3.0, `generateSW`)
- Browsertest im Build (`vite preview`, Chrome 157 headless via playwright-core), Builds A→B→C→D mit Marker `window.__build`:
  - A geladen, SW kontrolliert die Seite; `update()` beim Start: 1 Aufruf
  - B ausgeliefert, Tab offen, kein Navigieren: bleibt A, kein Neuladen
  - Navigation auf `/callback` mit wartendem Update: kein Neuladen
  - Danach Seitenwechsel: lädt B (Neuladen)
  - `visible` direkt nach dem Start: 0 `update()`-Aufrufe; nach simulierten 31 min: 1 Aufruf bei zwei `visible`; offline nach 70 min: 0
  - C ausgeliefert, Tab offen: bleibt B; Wechsel in den Hintergrund: lädt C
  - D ausgeliefert, POST (3 s verzögert) läuft, Hintergrund: kein Neuladen; nach Ende des POST: lädt D
  - Erstes Laden: kein Neuladen (A, B, C jeweils geladen ohne Schleife)
- Sichtprüfung: keine. Der Commit-Hash im Profil wurde nicht geprüft; stattdessen Marker pro Build (Login/OIDC im Test nicht konfiguriert, getestet auf der öffentlichen Route `/s/:token`, Navigation per `pushState` + `popstate`).
- Prüfzeit: Frontend-Verifikation 39 s (lint, typecheck, build); größter Posten: Browsertest (Aufbau mit selbstsigniertem Preview-Zertifikat, vier Builds)
- Prüfskripte: nur Scratchpad (`…\scratchpad\pw\t.mjs`)

## Struktur und Doku
- Neues Modul `frontend/src/js/swUpdate.ts` (~85 Zeilen), keine Duplikate.
- `.claude/rules/frontend.md`: `autoUpdate`-Satz ersetzt.

## Abweichungen vom Auftrag
- **Schreibende Anfragen:** Statt `client.ts` zu ändern (außerhalb der Ablage) zählt `swUpdate.ts` nicht-GET-`fetch`-Aufrufe über einen Wrapper um `window.fetch`. Das deckt auch AI-Import und Bild-Upload ab (eigene `fetch`-Aufrufe), die lang laufen. Ohne das würde ein Tab-Wechsel am Desktop sie abbrechen.
- **`App.vue`:** Der Auftrag nennt dort einen `visibilitychange`-Handler (Sitzungsprüfung). Im Code gibt es keinen (`grep visibilitychange` → keine Treffer in `src`). `swUpdate.ts` registriert einen eigenen.
- **Basis:** `af486fb` → `baa5e88` enthält neben Roadmap-Commits auch den Merge von W.3 und `docs(auth)`; nichts davon berührt die betroffenen Dateien.
- **`EnterWorktree`:** Das Tool lehnte den (von ihm selbst angelegten) Worktree ab; gearbeitet wurde per absolutem Pfad im Worktree, Git löst ihn korrekt als verknüpften Worktree auf.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- Ein Neuladen im Hintergrund unterbricht keine laufende Eingabe im Edit-Formular außer über `useDraft`; ungespeicherte Formularstände sichert nur der Entwurf. Unverändert, kein neuer Punkt.
- Die Nebenbedingung „mehrere Tabs“: `updateSW(true)` lädt alle Tabs desselben SW neu. Nicht getestet, Folgepunkt nur falls im Betrieb auffällig.

## Status je Roadmap-Punkt
- `W.22` fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.22 Service-Worker-Update steuern · 2026-11-15 · cca25c0`

---

## Nacharbeit

> Ausgangsstand `cca25c0` · Stand `7951515` + Bericht · 2026-11-15 · Dauer: 01:06 – 01:13 (ca. 7 min, kein Warten an Checkpoints) · Status: fertig

### Ergebnis
- **N1:** `router.afterEach((to, _from, failure) => …)` ignoriert Navigationen mit `failure`; `firstNavigation` wird erst nach einer erfolgreichen Navigation zurückgesetzt.
- **N2:** Kein Neuladen mehr bei `hidden`. `hidden` merkt nur den Zeitpunkt. Bei `visible` wird aktiviert, wenn die App mindestens 10 min im Hintergrund war, ein Update bereit ist und keine schreibende Anfrage läuft, sonst gedrosselt `registration.update()`. Aktivierung bei erfolgreicher Navigation bleibt. Der Wrapper um `fetch` zählt weiter laufende Schreibzugriffe, löst aber nichts mehr nach deren Ende aus.
- **N3:** `onNeedReload` ist gesetzt. Eigene Aktivierung (`applying`) lädt sofort neu, fremde (anderer Tab) setzt `reloadPending`; dieser Tab lädt dann unter denselben Bedingungen wie N1/N2.
- **Rule** `.claude/rules/frontend.md` angepasst.

Beleg zu N3 (Quelle `frontend/node_modules/vite-plugin-pwa/dist/client/build/register.js`, Version 1.3.0 laut Build): Im Modus `prompt` hängt `showSkipWaitingPrompt` (Zeile ~53–62) einen Listener `wb.addEventListener("controlling", …)` an. Bei `event.isUpdate` ruft er `onNeedReload()` auf, falls gesetzt, sonst `window.location.reload()`. `updateServiceWorker(true)` (Zeile ~20) sendet nur `SKIP_WAITING`; das Neuladen kommt allein aus diesem Listener. Er feuert bei jedem Controllerwechsel, auch wenn ein anderer Tab aktiviert hat. Deshalb muss `onNeedReload` selbst entscheiden, ob es sofort lädt (eigene Aktivierung) oder wartet.

### Commits
- `df965cc` fix(pwa): Navigationsfehler und gecancelte Initialnavigation ignorieren (N1)
- `be0a56f` fix(pwa): Update nicht bei hidden, sondern bei Rückkehr nach 10 min aktivieren (N2)
- `8f45b94` fix(pwa): Neuladen durch Aktivierung in anderem Tab aufschieben (N3)
- `7951515` docs(pwa): Rule an Aktivierung bei Navigation oder Rückkehr anpassen

### Verifikation
- `npm run lint:check`, `npm run typecheck`, `npm run build` → grün, keine Ausgabe von Fehlern.
- Browsertest im Build (`vite preview`, Chrome headless, `playwright-core`), Builds A→B→C→D mit Marker `window.__build`, Zeit per `Date.now`-Offset simuliert, `hidden`/`visible` per Event:
  - S1 B bereit, Tab offen: bleibt A, kein Neuladen. Navigation auf `/callback`: kein Neuladen.
  - S2 `hidden` → `visible` nach 5 min mit wartendem Update: kein Neuladen.
  - S3 Kaltstart auf `/` mit gespeicherter Route `/recipe/123` und wartendem Update (anderer Tab offen): kein Neuladen, auch nach weiteren 2,5 s nicht.
  - S4 Zwei Tabs, beide A, B wartet: Tab 1 navigiert, lädt B. Tab 2 bleibt A, auch 1,5 s später. Tab 2 navigiert, lädt B.
  - S5 C bereit, Tab 2 `hidden`, Tab 1 navigiert (lädt C): Tab 2 bleibt B. Rückkehr von Tab 2 nach 11 min: lädt C.
  - S6 D bereit: Rückkehr nach ≥ 10 min bei laufendem POST (3 s): kein Neuladen. Rückkehr nach ≥ 10 min ohne POST: lädt D.
- **Grenze von S3:** Im Test blieb der Pfad `/`, die Route `/recipe/123` wurde nicht erreicht (kein OIDC konfiguriert, `requireAuth` bricht ab). Die gecancelte Initialnavigation ist damit nicht belegt. Gezeigt ist nur, dass beim Kaltstart mit gespeicherter Route kein Neuladen auftritt. Ein Vergleichslauf mit altem Code (zum Nachweis, dass N1 den Fehler behebt) fehlt.
- Prüfskript: nur Scratchpad (`…\scratchpad\pw\t2.mjs`).

### Abweichungen vom Auftrag
- keine. Die geänderte Vorgabe zu `hidden` (N2) ersetzt die frühere Vorgabe des Ursprungsauftrags.

### Offen und Folgepunkte
- Navigation mit laufender schreibender Anfrage überspringt die Aktivierung; sie erfolgt erst beim nächsten Auslöser (nächste Navigation oder Rückkehr). Bewusst so gelassen (N2: `pendingWrites === 0` als Bedingung).
