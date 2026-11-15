# Bericht W.23: Auth-Feinschliff, Login-Entscheidung zentral

> Branch `worktree-W.23-auth-feinschliff` · Basis `3673f1d` (= `b07bb40` + `docs(roadmap)`) · Stand `d031803` · 2026-11-15 · Dauer: 22:59 – 23:20 (21 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Ob die App zum Login leitet, entscheidet nur noch `session.ts` mit einem Einstieg je Auslöser (`onNavigation`, `onResume`, `onOnline`, `onRejected`, `onCallback`). Ohne Netz wird der Login vorgemerkt und beim nächsten Auslöser mit Netz ausgeführt. Damit führt offline → online ohne Sitzung jetzt zum Login. Bei hängendem IdP und leerem Cache erscheint nach etwa 10 s ein Hinweis statt eines leeren Bildschirms. Rollen-Routen gehen offline mit gespeicherter Rolle. Der Callback löst den Code genau einmal ein. Die Erneuerung läuft unter Web Lock und mit 30 s Backoff. Der Importzyklus ist aufgelöst (`oidc → session → userManager`).

## Commits
- `58642cb` refactor(auth): Login-Entscheidung zentral in session.ts
- `4f7af0f` chore(auth): ungenutzte silent-renew.html entfernen
- `4735920` test(pwa): Chunk-Handler und SW-Update-Aktivierung abdecken
- `d031803` docs(auth): Regeln zu Sitzung und Login auf den neuen Aufbau, Plan W.23 umgesetzt
- (dieser Bericht)

## Verifikation
- `npm run lint:check && npm run typecheck && npm test && npm run build` → grün. 17 Testdateien, 151 Tests (vorher 13 Dateien). Build 965 ms.
- Neue Specs:
  - `auth/session.spec.ts` (39): je Tabellenzeile mindestens ein Fall, dazu Single-Flight, Lock, Backoff, Callback-Sperre und iOS-Reihenfolge online/visible
  - `auth/guards.spec.ts` (9): Zeile „Navigation mit Rolle“
  - `router/index.spec.ts` (6): Chunk-Handler
  - `js/swUpdate.spec.ts` (7): `applyUpdate`
- Gegenprobe per Mutation:
  - Ohne Schleifenschutz schlagen 2 Router-Tests fehl.
  - Ohne Offline- und Schreibsperre in `applyUpdate` schlagen 3 Tests fehl.
  - Der Fall „preloadError außerhalb der Navigation“ schlägt beim Entfernen der `pendingTarget`-Prüfung nicht an. Grund: Der Reset in `beforeEach` deckt den Fall ebenfalls ab, die Prüfung ist doppelt.
- Abnahme-Greps:
  - kein `@/auth/oidc` in `session.ts` und `userManager.ts`
  - `requestLogin` nur in `session.ts`; dort ist es nicht exportiert
  - `navigator.onLine` außerhalb von `session.ts` nur in Store, `useRecipeHelper` und `swUpdate`, nirgends für eine Login-Entscheidung
- Sichtprüfung im Build: `dist/` über einen eigenen Node-Server mit Mock-IdP (Discovery, `/idp/auth`, „hängen“ = keine Antwort), Edge headless über `playwright-core`, 10/10 OK. Warum Mock-IdP und kein gestubbter `userManager`: Nur so laufen der echte Build mit SW und das echte oidc-client-ts. Geprüft wird bis zum Redirect bzw. Timeout; der Token-Tausch ist in den Unit-Tests abgedeckt.
  - S1 offline → online ohne Sitzung: Offline zeigt `/favorites` den Hinweis „Keine Verbindung, noch keine Daten“, der IdP wird nicht angefragt. Nach `setOffline(false)` folgt der Redirect zu `/idp/auth`, Rücksprungziel `/favorites`.
  - S2 Kaltstart mit abgelaufener Sitzung, IdP antwortet nicht, kein Cache: Hinweis nach 10,1 s, kein Login-Redirect.
  - S3 öffentlicher Link `/s/abc`: kein Login, auch nicht nach offline/online und `visibilitychange`.
  - S4 geschützte Route ohne Sitzung, online, ohne Cache: sofort Login.
- Nicht geprüft:
  - kompletter Login mit Token-Tausch gegen einen echten IdP
  - Firefox und Safari
  - Container-Lauf: keine Abhängigkeiten, kein Dockerfile, keine Migration geändert
- Prüfzeit: ~1 min für die volle Verifikation (23:18:02 – 23:18:53), Browserszenarien 21 s. Größter Posten: `npm test` (16,7 s).
- Prüfskripte: nur Scratchpad (`C:\Users\ce\AppData\Local\Temp\claude\beb48852c7fd70f3\2a2505a6-d259-48a2-b2ae-10cc0a783470\scratchpad\e2e\run.mjs`). Das Skript nutzt `playwright-core` aus dem Scratchpad von W.25 und ist keine Projektabhängigkeit.

## Struktur und Doku
- Neue Module:
  - `auth/userManager.ts`: Instanz und Setup
  - `auth/role.ts`: Rollenspeicher und `/me`. Nicht in der Ablage des Auftrags. Eigenes Modul, weil Guard und Logout die Rolle brauchen und `session.ts` `api/client` nicht importieren darf (`client` importiert `session`, das wäre ein neuer Zyklus).
- Gewachsene Dateien:
  - `auth/session.ts` von 189 auf 439 Zeilen: Login, Callback und Einstiege kamen aus `oidc.ts` dazu, `oidc.ts` schrumpft auf 63 Zeilen.
  - `auth/session.spec.ts` hat 522 Zeilen.
  - Ein Aufteilen von `session.ts` (z. B. Login und Callback in ein eigenes Modul) widerspräche der Vorgabe „eine Stelle in `session.ts`“. Deshalb nicht aufgeteilt.
- Keine bewussten Duplikate.
- `.claude/rules/frontend.md` „Sitzung und Login“ ist neu gefasst: Aufbau, Einstiege, Hinweis, Lock, Backoff, Callback, Rolle, Re-Export. `CLAUDE.md` stimmt noch.

## Mitgenommen
- `58642cb` (im Haupt-Commit) Toten Export `getUser` aus `oidc.ts` entfernt, keine Aufrufer · XS
- `4735920` `vitest.config.ts`: Stub-Resolver für `virtual:pwa-register`. Ohne ihn ist `swUpdate.ts` in Vitest nicht ladbar; nur für Tests · XS

## Abweichungen vom Auftrag
Auslegungen der Tabelle (kein Widerspruch, deshalb kein Checkpoint):
- **„Rolle aus dem Speicher“:** Ich habe das als persistent gelesen, weil das Ziel „Rolle ohne Netz“ auch nach einem Kaltstart gelten soll. Die Rolle liegt in localStorage (`my-cookbook-role`), je `sub`. Mit gültiger Sitzung wird sie einmal je Seitenaufruf im Hintergrund aufgefrischt, beim Logout gelöscht. Eine im Backend entzogene Rolle wirkt in der Oberfläche deshalb erst nach dieser Auffrischung, also eine Navigation später. Das Backend prüft unabhängig davon.
- **Hinweise:** Beide erscheinen im vorhandenen Offline-Banner in `App.vue`, weil `HomeView.vue` für W.28 gesperrt ist: „Keine Verbindung, noch keine Daten“ und „Ohne Verbindung nicht verfügbar“ (Rolle). Sie verschwinden, sobald die Sitzung gültig ist.
- **Login-Redirect scheitert** (Discovery-Timeout bei hängendem IdP, Navigation `rejected` mit Netz ohne Cache): Das behandle ich nach der Zeile „IdP hängt“ wie offline, also durchlassen mit Hinweis statt abbrechen. Vorher stand dann ein leerer Bildschirm.
- **online-Ereignis mit vorgemerktem Login, aber inzwischen gültiger Sitzung** (z. B. in einem anderen Tab angemeldet): kein Login. Die Tabelle sagt „Login vorgemerkt → Login“; ein unnötiger IdP-Rundlauf brächte hier nichts. Bei `offline` oder `rejected` gilt die Tabelle wörtlich.
- **Backoff:** Das `online`-Ereignis beendet ihn, weil das Netz gewechselt hat. Nur nach `offline` mit `navigator.onLine === true`, wie beauftragt.
- **`onSessionRejected`** (Listener-API) ist entfallen. Abgelehnte Erneuerungen rufen direkt den Einstieg `onRejected`; außer dem Router gab es keinen Abonnenten.
- **Callback-Sperre:** Der Schlüssel ist der `state` der URL. Er wird vor dem Token-Abruf in `sessionStorage` gesetzt. Ein Reload mitten im Abruf ohne entstandene Sitzung zählt als Fehler und geht den begrenzten Neuversuch.

## Nachgetragen in Specs/Plänen
- `docs/plans/zuverlaessigkeit-login-ai-import.md`: W.23 als umgesetzt markiert, Abweichung zu „Richtung“ Punkt 4 (`getAccessToken` bleibt als Re-Export).

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **Nach dem Merge von W.28:** `api/images.ts` auf `getAccessToken` aus `@/auth/session` umstellen und den Re-Export in `oidc.ts` entfernen. Aufwand XS.
- **Store prüft `navigator.onLine` selbst** (`recipeStore.ts:96`, Login-nahe Logik). Er sollte stattdessen das Ergebnis aus `session.ts` nutzen. Wegen W.28 nicht angefasst. Aufwand XS–S.
- **„Offline-Daten“ ohne Daten:** Im Browser zeigte S1 offline ohne Cache „Offline · Offline-Daten · Keine Verbindung, noch keine Daten“. Der Store setzt `dataSource = "cache"`, auch wenn der Cache leer ist. Das widerspricht sich in der Anzeige. Vorschlag: `cache` nur setzen, wenn Daten gelesen wurden (Store, nach W.28). Aufwand XS.
- **Doppelte Absicherung im Chunk-Handler** (`pendingTarget`-Prüfung und Reset in `beforeEach`): Das ist harmlos und bleibt, weil die Tests das Verhalten ohnehin abdecken. Nur zur Kenntnis.

### Gerätetest (iPhone/iPad, installierte PWA)
1. **Offline → online ohne Sitzung:** angemeldet, Flugmodus an. In der PWA abmelden geht offline nicht, deshalb in den Safari-Einstellungen die Website-Daten der App löschen, oder den Refresh-Token im IdP widerrufen und warten, bis der Access-Token abgelaufen ist. App öffnen: Daten aus dem Cache, kein Login-Versuch. Flugmodus aus: genau ein Wechsel zum IdP-Login, danach zurück auf dieselbe Seite.
2. **Aufwecken nach langer Pause** (über Nacht, Token abgelaufen, mit Netz): App aus dem Hintergrund holen. Keine Login-Seite, Daten laden nach. Im IdP-Log genau eine Token-Erneuerung, keine zweite.
3. **Aufwecken offline nach Sitzungsende:** Sitzung im IdP beenden, App im Flugmodus aufwecken: Cache, kein Login. Flugmodus aus: genau ein Login-Redirect, auch wenn „online“ und „sichtbar“ in beliebiger Reihenfolge kommen.
4. **Hängender IdP:** Neue Installation ohne Cache, IdP nicht erreichbar, z. B. WLAN ohne Internet oder IdP gestoppt. Start: nach höchstens etwa 10–20 s der Hinweis „Keine Verbindung, noch keine Daten“, kein weißer Bildschirm.
5. **Rolle offline:** Als Editor einmal online „Bearbeiten“ öffnen. Flugmodus an, App schließen und neu starten, ein Rezept bearbeiten: Die Edit-Seite öffnet sich. Ohne vorherigen Online-Besuch: Startseite mit dem Hinweis „Ohne Verbindung nicht verfügbar“.
6. **Callback-Reload:** Während des Logins auf `/callback` sofort neu laden bzw. die App wechseln. Danach angemeldet oder die Meldung „Anmeldung fehlgeschlagen“ mit Knopf, keine Schleife.
7. **Geteilter Link** (`/s/…`) ohne Anmeldung: kein Login, auch nicht nach Flugmodus an/aus.
8. **Zwei Tabs** (iPad, Safari): Beide Tabs offen lassen, bis der Token abläuft. Danach beide nutzen: kein Login-Redirect.

## Status je Roadmap-Punkt
- `W.23` fertig (Abnahme auf dem Gerät steht aus)

## Vorschlag Roadmap-Zeilen
`- [x] W.23 Auth-Feinschliff, Login-Entscheidung zentral · 2026-11-15 · d031803`
