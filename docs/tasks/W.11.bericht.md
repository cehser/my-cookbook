# Bericht W.11: Rezepte nach Login und Token-Ablauf zuverlässig laden

> Branch `worktree-W.11-login-laden` · Basis `d101f5f` (Auftrag: `f20df40`, dazwischen nur `docs(roadmap)`) · Stand `8a154a4` · 2026-11-14 · Dauer: 15:46 – 16:21 (35 min, davon Warten an Checkpoints 17 min), Nacharbeit Logout-Widerruf bis 16:43 (Beginn nicht festgehalten), Nacharbeit N1–N5 17:15 – 17:31 (16 min) · Status: fertig

## Ergebnis
Die Token-Erneuerung läuft als Single-Flight, die sich alle Aufrufer teilen. Ihr Ergebnis ist `valid`, `offline` oder `rejected`. `getAccessToken()` erneuert einen abgelaufenen Token, statt `null` zu liefern. Rezepte, Settings und Favoriten werden erst nach geklärtem Auth-Zustand geladen. Nachgeladen wird nach Login/Erneuerung (`userLoaded`), wenn das Gerät wieder online ist und wenn die App wieder in den Vordergrund kommt. Daten aus IndexedDB sind im Banner als „Offline-Daten“ markiert. Die Rezeptliste lädt alle Seiten.

Nacharbeit N1–N5: Nur `invalid_grant`, `invalid_client` und `unauthorized_client` gelten als abgelehnt; eine IdP-Störung (5xx/429) führt nicht mehr zum Logout. 4xx-Antworten der API sind kein Cache-Fall, Rolle `pending` bekommt weder Banner noch Dauer-Nachladen. Eine abgelehnte Erneuerung löst an genau einer Stelle den Login aus, im Vordergrund wird der Auth-Zustand immer geprüft. Beim Start steht der Cache sofort als vorläufiger Stand da, API-Anfragen brechen nach 15 s ab, und die Suche lädt alle Seiten.

## Commits
- `63d1fca` feat(auth): Token-Erneuerung als Single-Flight mit Ergebnis-Typ
- `ff52806` feat(frontend): Daten nach geklärtem Auth-Zustand laden, Cache markieren
- `b68f94b` refactor(auth): toten addUserSignedOut-Handler entfernen
- `b482bca` docs(roadmap): Plan W.11 um Befunde C2, T2, T4 ergänzen
- `4d88a9d` feat(auth): Refresh-Token beim Logout widerrufen
- `64df3f2` Merge branch 'main' into worktree-W.11-login-laden (Nacharbeit, ohne Konflikte)
- `576a3f7` fix(auth): Ablehnung nur bei invalid_grant, zentraler Login bei rejected (N1, N3, Discovery-Timeout)
- `d7918c0` feat(frontend): Timeout im API-Client, Client-Fehler erkennen (N4, N2)
- `8a154a4` fix(frontend): Cache vorläufig zeigen, 4xx nicht als Ausfall werten (N4, N2, N3, N5)

## Erkundung (Auftrag Schritt 1)
- **`isAuthenticated()`:** 13 Aufrufe, 12 im Store, 1 in `useRecipeHelper.loadRecipe`. Die drei Lade-Aufrufe sind durch `loadAll()` → `ensureAuth()` ersetzt. Die übrigen Aufrufe (Schreibpfade, Detail) nutzen weiter `isAuthenticated()`, das jetzt über `ensureAuth()` abgelaufene Tokens erneuert.
- **IndexedDB-Rückfälle:** `loadSettings`, `loadRecipes` (mit localStorage-Migration und Beispielrezept), `loadFavorites`, `useRecipeHelper.loadRecipe` (Detail). Hinzu kommen die Schreibzugriffe in `saveSettings`, `saveRecipes`, `setRecipe`, `add/removeFavorite`, `loadRecipesFromApi`, `loadRecipeDetailFromApi` und `prefetchRecipeDetails`. Alle laufen jetzt über `js/offlineCache.ts`. Ausnahme ist `recipe_pictures`; das bleibt laut Auftrag im Store.
- **oidc-client-ts 3.5.0, aus dem Quelltext:**
  - Ist ein Refresh-Token vorhanden, geht `signinSilent()` direkt an den Token-Endpunkt, ohne iframe. Die iOS/ITP-Sorge betrifft nur Sitzungen ohne Refresh-Token.
  - Parallele `signinSilent()` werden **nicht** zusammengefasst (T2 war echt).
  - `automaticSilentRenew` reagiert nur auf den „expiring“-Timer eines noch gültigen Tokens. Ein beim Start bereits abgelaufener Token löst nichts aus.
  - `monitorSession` ist standardmäßig `false`, `addUserSignedOut` feuerte also nie.
  - Jede Nicht-2xx-Antwort des Token-Endpunkts mit OAuth-JSON wird zu `ErrorResponse`, **auch 5xx/429** (`server_error`, `temporarily_unavailable`). Meine erste Fassung hatte daraus pauschal „abgelehnt“ gemacht; korrigiert in N1. Netzfehler ergeben `TypeError`, Timeouts `ErrorTimeout` (Standard 10 s), Antworten ohne JSON ein generisches `Error`.
  - Discovery und JWKS werden ohne `requestTimeoutInSeconds` **ohne Timeout** abgerufen (Nacharbeit N4).
- **`public/silent-renew.html`** sendet `location.href` als String. Die Bibliothek erwartet aber `{source: "oidc-client", url, keepOpen}`. Eine iframe-Erneuerung würde deshalb immer nach 10 s abbrechen. Sie wird nicht mehr genutzt: Ohne Refresh-Token gilt `rejected`. Die Datei ist unverändert.
- **C2 (nur bewertet):** Bei `registerType: autoUpdate` ruft `registerSW` `onNeedRefresh` nie auf, der Hook `router.afterEach` in `main.ts` ist toter Code. In Wirklichkeit lädt vite-plugin-pwa 1.2.0 die Seite **sofort** neu, sobald ein neuer Service Worker aktiv wird. Das trifft auch Sitzungen, in denen gerade gekocht oder bearbeitet wird (Entwürfe sichert `useDraft`). Nach Updates sucht der Browser nur bei Navigation oder Registrierung. Eine fortgesetzte iOS-PWA kann deshalb lange mit altem JS laufen. Folgepunkt siehe unten.
- **`cachedRole`:** Keine Änderung nötig. Ein Benutzerwechsel geht immer über einen Redirect zum IdP, die Seite wird also voll neu geladen und der Modulzustand zurückgesetzt.

## Verifikation
- `npm run lint:check && npm run typecheck && npm run build` auf dem Stand nach `git merge main` (Lock aus W.14, `npm ci`): alle Exit 0. ESLint meldet eine Prettier-Warnung in `components/features/AIRecipeImport.vue:375`; die Datei ist hier unverändert, die Warnung besteht so schon auf `main`.
- Auth-Simulation: `auth/oidc.ts` mit rolldown gebündelt, `oidc-client-ts` durch eine Attrappe ersetzt, 24 Prüfungen in Node, alle OK. Geprüft:
  - 6 parallele Aufrufer → genau 1 Erneuerung
  - danach keine weitere Erneuerung
  - `invalid_grant` → `rejected` und die Sitzung wird verworfen
  - Netzfehler → `offline` und die Sitzung bleibt
  - `navigator.onLine=false` → kein IdP-Aufruf
  - ohne Refresh-Token → `rejected`
  - Rotation durch einen anderen Tab → `valid`
  - 401 mit bereits ersetztem Token → kein Refresh
  - 3× 401 parallel → 1 Refresh
  - Expiring-Event nutzt dieselbe Erneuerung
  - Fehlerklassifikation
  - Logout bei erfolgreichem, fehlgeschlagenem und hängendem Widerruf → immer `signoutRedirect` (hängend nach 5 s)
- Nacharbeit, Auth-Simulation jetzt 45 Prüfungen (zusätzlich API-Client mit Fake-`fetch`), alle OK. Neu geprüft:
  - **N1:** `server_error`/`temporarily_unavailable` → `offline`, die Sitzung bleibt; `invalid_grant`/`invalid_client`/`unauthorized_client` → `rejected`
  - **N3:** Ereignis `onSessionRejected` genau einmal bei parallelen Aufrufern, auch aus dem 401-Pfad und dem Ablauf-Timer; bei `offline` kein Ereignis
  - **N3, `requestLogin`:** kein Redirect auf `/callback` und offline; bei mehrfachem Aufruf genau ein Redirect mit der ersten Rücksprung-URL
  - **N4:** hängender Fetch → `ApiTimeoutError` nach dem Timeout und kein Client-Fehler (also Cache); Standard-Timeout aktiv; `timeoutMs: 0` bricht nie ab
  - **N2:** 403 → Client-Fehler, 503 → kein Client-Fehler
  - **401:** abgelehnte Erneuerung → `ApiError 401` mit Detail; erfolgreiche Erneuerung → Wiederholung liefert Daten
- Nacharbeit, Store-Simulation (neu, Pinia in Node, `idb-keyval` als Speicher-Fake, Fake-`fetch`): 12 Prüfungen, alle OK.
  - **N2, `pending`:** Quelle `api`, keine Rezepte und Favoriten, kein Nachladen; vorläufige Cache-Rezepte werden entfernt
  - **N4:** Cache nach 30 ms sichtbar (Quelle `cache`), danach API-Daten (Quelle `api`)
  - **Ausfall:** Netzfehler und 503 → Cache
  - **`rejected` online:** Quelle `none`, keine Anfragen
  - **Folgelauf:** genau einmal bei Cache-Ergebnis, keiner bei API-Ergebnis
  - **N5:** 450 Rezepte über 3 Seiten, für Liste und Suche (mit `q`)
- Sichtprüfung: keine. Ohne IdP ist das lokal nicht lauffähig; die Abnahme auf iPhone/iPad steht unten.
- Prüfzeit: ~2 min je Lauf, drei Läufe; größter Posten: `npm run build` (Kette 1:51 min, nach dem Logout-Commit 1:15 min, Nacharbeit 1:10 min)
- Prüfskripte: nur Scratchpad (`authsim/`). Sie wären die Vorlage für W.10.

## Testszenarien für die Abnahme (iPhone/iPad, PWA)
Konsole bzw. Web-Inspector: Jede Erneuerung erzeugt die Meldung `[Auth] Token-Erneuerung per Refresh-Token`.
1. **Frischer Login:** abmelden, anmelden. Erwartung: Rezepte, Favoriten und Settings kommen ohne manuelles Neuladen von der API, kein Banner. Im Netzwerk-Tab je ein Aufruf `/recipes?page=1…`, `/favorites`, `/me/settings` nach dem Callback.
2. **PWA nach Ablauf des Access-Tokens öffnen** (nach mehr als dessen Laufzeit, App aus dem Hintergrund oder neu gestartet). Erwartung: kein Login, kein „Offline-Daten“, Daten von der API. Genau **eine** Meldung „Token-Erneuerung“ und **ein** POST an den Token-Endpunkt, obwohl Guard, Settings, Rezepte, Favoriten und Bilder gleichzeitig starten.
3. **Flugmodus, App öffnen:** Erwartung: Rezepte aus dem Cache, Banner „Offline · Offline-Daten“. Netz wieder an: Erwartung: automatisches Nachladen, Banner verschwindet.
3b. **API ausgefallen, Netz da** (z. B. Backend-Container gestoppt): Erwartung: Banner nur „Offline-Daten“. Backend starten, App in den Hintergrund und wieder nach vorn: Erwartung: Nachladen, Banner verschwindet.
4. **Session widerrufen** (im IdP die Offline-Session bzw. die App-Sitzung des Nutzers beenden), dann PWA mit abgelaufenem Access-Token öffnen. Erwartung: Weiterleitung zum Login, keine stillen Cache-Daten. Ohne Netz in diesem Zustand: Cache-Daten (ohne Netz ist kein Login möglich). **Pflichttest:** Belegt live, dass der IdP mit `invalid_grant` als JSON antwortet. Kommt stattdessen „Offline-Daten“, ist die Fehlerklassifikation für diesen IdP falsch.
5. **Laufender Betrieb über die Token-Laufzeit hinaus** (App offen lassen): Erwartung: etwa 60 s vor Ablauf genau eine Erneuerung, kein Neuladen der Rezeptliste.
6. **Abmelden** (Profil → Logout): Erwartung: im Netzwerk-Tab ein POST an den Revocation-Endpunkt (Keycloak: `…/protocol/openid-connect/revoke`), danach Redirect zum IdP-Logout. In Keycloak ist die Offline-Session der App für den Nutzer danach weg (Admin-Konsole → Benutzer → Sitzungen bzw. Account-Konsole → Anwendungen).
7. **Rolle `pending`** (neuen Nutzer anmelden, nicht freischalten): Erwartung: Hinweis „Dein Account wartet auf Freigabe“, **kein** Offline-Banner, keine Rezepte. Im Netzwerk-Tab je einmal 403 auf `/recipes` und `/favorites`, beim Wechsel in den Vordergrund keine erneuten Listenaufrufe. Nach der Freigabe durch einen Admin: App neu öffnen → Rezepte erscheinen.
8. **Schlechtes Netz** (online, aber hängende Verbindung; z. B. Network Link Conditioner „100% Loss“ im Entwicklermenü des iPhone oder WLAN ohne Internet): Erwartung: Die Rezepte aus dem Cache stehen **sofort** da, nach ca. 1,5 s erscheint „Offline-Daten“. Nach spätestens ~15 s (API) bzw. ~10–20 s (IdP bei abgelaufenem Token) ist der Ladeversuch beendet; die Seite bleibt bedienbar und hängt nicht leer. Netz normal: App in den Vordergrund holen → Nachladen, Banner verschwindet.
9. **Sitzung im laufenden Betrieb abgelehnt** (App offen, im IdP Offline-Session beenden, dann Ablauf des Access-Tokens abwarten oder App in den Hintergrund und nach Token-Ablauf wieder nach vorn): Erwartung: Weiterleitung zum Login, danach zurück auf die vorherige Seite. Auf einem Freigabe-Link `/s/…` keine Weiterleitung.

## Struktur und Doku
- **Gewachsene Dateien:** `store/recipeStore.ts` hat jetzt 529 Zeilen (vorher 426). Gründe sind `loadAll`/`reloadIfStale`/`loadAllOnce`/`showCachedData`, Paginierung und Mapper. Die Mapper `listItemToRecipe` und `detailToRecipe` ersetzen drei vorhandene Kopien desselben Codes. `auth/oidc.ts` hat 274 Zeilen (vorher 126), `api/client.ts` 170 (vorher 98).
- **Neues Modul:** `frontend/src/js/offlineCache.ts`
- **Bewusste Duplikate:** keine
- **CLAUDE.md, `.claude/rules/frontend.md`:** stimmen noch. Hinweis: Die Rule beschreibt `autoUpdate` korrekt, sagt aber nichts zum sofortigen Neuladen (siehe Folgepunkt C2).

## Abweichungen vom Auftrag
- **`views/Callback.vue` unverändert** (laut Ablage sollte die Datei wachsen). `signinRedirectCallback` löst `userLoaded` aus, und darüber lädt `App.vue` nach. Ein zusätzlicher Aufruf in `Callback.vue` wäre ein zweiter Mechanismus. Gegen das Wettrennen mit dem Ladelauf aus `onMounted` hilft der Folgelauf in `loadAll()`.
- **Zusätzlich:** Nachladen bei `visibilitychange` (App wieder im Vordergrund). Eine fortgesetzte iOS-PWA erhält kein `online`-Event. Ohne diesen Auslöser bliebe „Offline-Daten“ bei einem API-Ausfall mit Netz bis zum nächsten Token-Ereignis stehen. Das Nachladen greift nur, wenn die Daten nicht von der API stammen.
- **Nachladen bei `userLoaded` und online nur, wenn die Daten nicht von der API stammen.** Sonst würde jede reguläre Erneuerung (alle paar Minuten) die ganze Liste neu laden.
- **localStorage-Migration in `loadRecipes`:** Die Logik ist unverändert, nur `get`/`set` laufen jetzt über `offlineCache`, und der Block wird awaited statt mit `.then()` nebenher ausgeführt.
- **T4 ohne Keycloak-Werte entschieden** (Rückmeldung am Checkpoint: Die Lösung muss IdP-agnostisch mit allen Einstellungen funktionieren). Session-Monitoring bleibt aus und der tote `addUserSignedOut`-Handler ist entfernt. Das Ende der Sitzung greift, sobald der IdP die Erneuerung ablehnt.
- **Zusätzlich nach Freigabe:** `logout()` widerruft den Refresh-Token vor dem Redirect (RFC 7009), weil ein Logout beim IdP Offline-Tokens nicht zwingend beendet. Das gilt für Keycloak als unbestätigt. Bewusst nicht über `revokeTokensOnSignout`: Laut Quelltext bricht damit der ganze Logout ab, wenn der Widerruf scheitert (kein Revocation-Endpunkt, kein Netz). Jetzt gilt ein Timeout von 5 s, danach wird in jedem Fall abgemeldet.

- **Nacharbeit N3, Mechanik:** `requestLogin()` ist die einzige Stelle mit Login-Redirect. Die Guards rufen sie mit der Zielroute auf. Außerhalb einer Navigation löst der Router sie über `onSessionRejected` aus, und zwar erst nach `router.isReady()`: Vorher steht `currentRoute` auch beim Öffnen eines Freigabe-Links auf `/`. Öffentliche Routen (`/callback`, `/s/:token`) tragen dafür neu `meta.public`.
- **Nacharbeit N4, zusätzlich:** `requestTimeoutInSeconds: 10` für oidc-client-ts. Ohne diesen Wert laufen Discovery und JWKS ohne Timeout; bei hängender Verbindung und abgelaufenem Token blockierte der Guard die erste Navigation unbegrenzt, und die Seite blieb leer. Das ist eine Ergänzung über den Wortlaut von N4 hinaus, dient aber demselben Ziel.
- **Nacharbeit N4, Banner:** Bei bestehendem Netz erscheint „Offline-Daten“ erst nach 1,5 s im Cache-Zustand, ohne Netz sofort. Ohne diese Verzögerung blitzt das Banner bei jedem Start kurz auf, weil der Cache vorläufig dasteht, bis die API antwortet (meist < 1 s). Die Quelle ist sofort `cache`, verzögert wird nur die Anzeige. Ist das nicht gewünscht: `CACHE_HINT_DELAY_MS` in `App.vue` auf 0 setzen.
- **Nacharbeit N4, Ausnahmen vom Timeout:** `timeoutMs: 0` für die langen Admin-Jobs `migrate-images`, `cleanup-images` und `strip-image-ids`. AI-Import (`api/ai.ts`) und Bild-Uploads (`api/images.ts`) laufen nicht über den API-Client und bleiben ohne Timeout.
- **Nacharbeit N2:** Bei 4xx wird der Store geleert (Rezepte, Favoriten), der IndexedDB-Cache aber nicht. Ein später herabgestufter Nutzer sähe offline weiter den alten Cache. Das habe ich bewusst nicht weiter behandelt.

## Nachgetragen in Specs/Plänen
- `docs/plans/zuverlaessigkeit-login-ai-import.md`: C2 korrigiert, T2 bestätigt/behoben, T4 entschieden, Checkpoint erledigt

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **C2, Service-Worker-Update steuern:** Das sofortige Neuladen mitten in der Sitzung vermeiden, z. B. mit `registerType: prompt` und Neuladen beim nächsten Seitenwechsel, so wie der heutige tote Code es gemeint hat. Dazu periodisch oder bei `visibilitychange` `registration.update()` aufrufen. Aufwand S.
- **Erneuerung über mehrere Tabs absichern:** Rotation mit Max Reuse 0 und zwei gleichzeitig erneuernden Tabs. Ein enges Zeitfenster bleibt, in dem ein Tab den frisch gespeicherten Token des anderen löscht. Folge ist ein Login-Redirect, kein Datenverlust. Abhilfe: Web Locks API (`navigator.locks`, iOS ≥ 15.4) um `renewToken()`, ohne neue Abhängigkeit. Für eine PWA mit einem Fenster ist das kaum relevant. Aufwand S.
- **`public/silent-renew.html` reparieren** (`signinSilentCallback()` bzw. das richtige Nachrichtenformat) oder samt `silent_redirect_uri` entfernen; die Seite wird nicht mehr genutzt. Aufwand XS.
- **Erneuerungsversuche bei IdP-Ausfall mit Netz:** Jeder API-Aufruf versucht erneut eine Erneuerung (parallele Aufrufe werden zusammengefasst). Ein kurzes Backoff wäre möglich. Aufwand XS, nur bei Bedarf.
- **Prettier-Warnung in `AIRecipeImport.vue:375`** (besteht auf `main`): bei W.12 mit erledigen. Aufwand XS.
- **Sortier-Tie-Breaker im Backend** für stabile Paginierung: W.20 (nicht hier).
- **C3** (Prefetch der Details bricht ab → offline fehlen Details): unverändert, war nicht beauftragt.

## Status je Roadmap-Punkt
- `W.11` fertig (Abnahme auf dem Gerät steht aus)
  - N1 fertig
  - N2 fertig
  - N3 fertig
  - N4 fertig (zusätzlich Discovery-Timeout, Banner-Verzögerung, siehe Abweichungen)
  - N5 fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.11 Rezepte nach Login und Token-Ablauf zuverlässig laden · 2026-11-14 · 8a154a4`
