# Auftrag W.11: Rezepte nach Login und Token-Ablauf zuverlässig laden

> Erstellt 2026-11-14 vom Master · Roadmap: `ROADMAP.md` Punkt W.11 · Basis: `main@f20df40` · Aufwand: M–L · Modell: Opus

## Ziel
Nach dem Login und beim Öffnen der PWA mit abgelaufenem Access-Token (Regelfall wegen `offline_access`) kommen Rezepte, Settings und Favoriten verlässlich von der API. IndexedDB dient nur noch als Ersatz bei echtem Offline oder API-Ausfall, sichtbar markiert und mit Nachladen. Offline-Schreiben ist nicht Teil dieses Auftrags (Roadmap 12).

## Erst lesen
1. `docs/plans/zuverlaessigkeit-login-ai-import.md` – Abschnitt „W.11“ (Befunde L1–L3, C1–C3, T1–T5, Richtung, Checkpoint)
2. `frontend/src/auth/oidc.ts`, `auth/guards.ts`, `api/client.ts` – Token-Pfad
3. `frontend/src/store/recipeStore.ts` – `loadSettings`, `loadRecipes`, `loadRecipesFromApi`, `prefetchRecipeDetails`, `loadFavorites`
4. `frontend/src/App.vue` (`onMounted`, Offline-Banner), `views/Callback.vue`, `composables/useRecipeHelper.ts` (Detail-Laden)
5. Doku von oidc-client-ts 3.5 zu `signinSilent` mit Refresh-Token, parallelen Aufrufen, `automaticSilentRenew`, `monitorSession`

## Auftrag
1. **Erkundung:** alle 13 Aufrufe von `isAuthenticated()` und alle IndexedDB-Rückfälle erfassen. Das tatsächliche Verhalten von oidc-client-ts aus Doku/Quelltext bestimmen: Wird bei vorhandenem Refresh-Token der Token-Endpunkt genutzt oder das iframe (`silent-renew.html`)? Werden parallele `signinSilent()` zusammengefasst? Welchen Standardwert hat `monitorSession`? Ergebnis kurz im Bericht.
2. **Auth (T1, T2, T5):**
   - Eine Single-Flight-Erneuerung, die alle Aufrufer teilen (Guard, API-Client, Store, `automaticSilentRenew`-Pfad).
   - `getAccessToken()` erneuert bei abgelaufenem Token, statt `null` zu liefern.
   - Ergebnis unterscheiden: gültig / kein Netz / Anmeldung abgelehnt (`invalid_grant`, kein Refresh-Token) → Login.
3. **Laden (L1, L2, C1):**
   - Laden erst nach geklärtem Auth-Zustand, nicht blind in `App.vue onMounted`.
   - Nach Login-Callback, nach erfolgreicher Token-Erneuerung (Event `userLoaded`) und beim Wechsel offline → online neu laden.
   - Gilt für Rezepte, Settings und Favoriten gleichermaßen.
4. **Zugriffsschicht:** IndexedDB-Zugriffe für Rezepte, Settings und Favoriten aus Store und `useRecipeHelper` in ein Modul bündeln (`frontend/src/js/offlineCache.ts`, ohne Vue). Rückfall nur bei Offline oder API-Fehler; der Store merkt sich die Quelle.
5. **Sichtbarkeit (C1):** Kommen die Daten aus dem Cache, zeigt das vorhandene Offline-Banner in `App.vue` einen Hinweis „Offline-Daten“ (auch bei bestehender Verbindung, aber ausgefallener API). Das Banner verschwindet nach erfolgreichem Nachladen.
6. **Liste (L3):** `loadRecipesFromApi` lädt alle Seiten statt nur `page_size: 200`.
7. **C2 (Service-Worker-Update)** nur prüfen und im Bericht bewerten, nicht ändern.
8. **T4** erst nach dem Checkpoint.

## Ablage
- Neu: `frontend/src/js/offlineCache.ts` (IndexedDB-Zugriff).
- Wächst: `auth/oidc.ts` (Single-Flight, Ergebnis-Typ), `store/recipeStore.ts` (Laden, Quelle), `App.vue` (Start und Banner), `views/Callback.vue` (Laden nach Login).
- Alte localStorage-Migration (`loadYamlCookbook` in `loadRecipes`) und `loadRecipePictures` nicht anfassen.

## Nicht in diesem Auftrag
- Offline-Schreiben, Warteschlange, Sync (Roadmap 12). Die Zugriffsschicht soll nur andockbar sein.
- `api/ai.ts` (W.12). Es profitiert später vom neuen `getAccessToken()`, wird hier aber nicht umgestellt.
- `package.json` und Lockfile: Parallel läuft W.14. Keine neuen Abhängigkeiten; `useOnline` aus `@vueuse/core` ist vorhanden.
- Refresh-Token in `localStorage`, CSP.

## Entscheidungen, die ich treffe
- T4: Verhalten bei Ende der IdP-Session trotz gültigem Offline-Token (siehe Checkpoint).

## Fallstricke
- Auf iOS kann das iframe-Silent-Renew an Cookie-Beschränkungen (ITP) scheitern; nur die Erneuerung per Refresh-Token ist verlässlich (unbestätigt, in Schritt 1 prüfen).
- `App.vue onMounted` läuft auch auf `/callback`. Session Restore (`restoreSession`) im selben Hook nicht brechen.
- `cachedRole` in `guards.ts` überlebt einen User-Wechsel ohne Logout. Prüfen, nur bei Bedarf ändern.
- Ohne IdP ist die Laufzeit kaum lokal testbar. Logik so schneiden, dass sie ohne Browser-Redirect nachvollziehbar ist (W.10 bringt später Tests), und Testszenarien für mich vorbereiten.

## Checkpoints
- **Vor T4:** Ich liefere die Keycloak-Werte (Access Token Lifespan, Revoke Refresh Token, SSO Session Idle/Max, Offline Session Idle/Max). Bis dahin T1–T3 und T5 fertigstellen. Liegen die Werte beim Abschluss nicht vor, T4 im Bericht als offenen Folgepunkt beschreiben.

## Abnahme
- Testszenarien im Bericht, von mir auf iPhone/iPad (PWA) durchzuführen, jeweils mit Erwartung:
  1. Frischer Login → alle Rezepte, Favoriten, Settings von der API, ohne manuelles Neuladen.
  2. PWA nach > Access-Token-Laufzeit öffnen → Daten von der API, kein Login, kein „Offline-Daten“.
  3. Flugmodus → Rezepte aus dem Cache, Hinweis „Offline-Daten“; Netz an → Nachladen, Hinweis verschwindet.
  4. Abgelaufene oder widerrufene Session → Login statt stiller Cache-Daten.
- Pro Start höchstens eine Token-Erneuerung (Konsole/Netzwerk-Tab), auch bei parallelen Anfragen.
- Verifikation gemäß Projekt-CLAUDE.md (Frontend)

## Nacharbeit (2026-11-14, aus der Abnahme durch den Master)

Im bestehenden Worktree auf Branch `worktree-W.11-login-laden`. Zuerst `git merge main`, um den Lock aus W.14 zu übernehmen und dagegen zu verifizieren. Danach:

- **N1 Klassifikation (Fehler):** `classifyRenewError` (`auth/oidc.ts`) wertet jede `ErrorResponse` als `rejected`. oidc-client-ts erzeugt `ErrorResponse` aber bei jedem Nicht-2xx mit OAuth-JSON, auch bei 5xx/429 (`server_error`, `temporarily_unavailable`) → Zwangs-Logout bei kurzer IdP-Störung. Neu: `rejected` nur bei `error === "invalid_grant"` (ggf. `invalid_client`, `unauthorized_client`), sonst `offline`. Kommentar korrigieren.
- **N2 Client-Fehler ≠ Ausfall (Fehler):** `loadRecipes`/`loadFavorites`/`loadSettings` fallen bei jedem API-Fehler auf den Cache zurück. Nutzer mit Rolle `pending` bekommen 403 → dauerhaft „Offline-Daten“ und Neuladen bei jedem Vordergrundwechsel. Neu: `ApiError` mit 4xx (außer 401) ist kein Cache-Fall; für `pending` gilt der bestehende Hinweis in `HomeView`, kein Offline-Banner.
- **N3 Abgelehnte Erneuerung im laufenden Betrieb:** Wird die Erneuerung im Ablauf-Timer oder im 401-Pfad mit `rejected` beendet, passiert heute nur `removeUser()`; eine fortgesetzte PWA zeigt still die alten Daten. Neu: bei `rejected` und online zentral Login auslösen (eine Stelle, keine Redirect-Schleife auf `/callback`). Beim Wechsel in den Vordergrund den Auth-Zustand prüfen, auch wenn die Daten von der API stammen.
- **N4 Schlechtes Netz (Regression):** Bei `navigator.onLine === true`, aber hängender Verbindung bleibt die Liste bis zum Fetch-Fehler leer (früher: Cache sofort). Neu: Cache sofort als vorläufige Daten zeigen (Quelle „cache“, Banner), danach durch API-Daten ersetzen; dazu Timeout per `AbortController` im API-Client (Größenordnung 15 s, nicht für AI-Import und Uploads).
- **N5 Suche:** `searchRecipesApi` ist weiter auf 200 Treffer begrenzt; wie die Liste paginieren.

Nicht in der Nacharbeit: Sortier-Tie-Breaker im Backend (W.20), Service-Worker-Update (C2), `silent-renew.html`, Web Locks.

Abnahme Nacharbeit: Verifikation gemäß Projekt-CLAUDE.md auf Stand nach `git merge main`; Auth-Simulation um N1 (5xx mit `server_error` → `offline`, `invalid_grant` → `rejected`) und N3 erweitert; Testszenarien im Bericht um „Rolle pending“ und „schlechtes Netz“ ergänzt. Bericht `W.11.bericht.md` fortschreiben.

## Nacharbeit 2 (2026-11-14, aus der Abnahme der Nacharbeit)

Im selben Worktree. Zuerst `git merge main`. N1–N4 sind im Kern richtig. Offen:

- **N6 Refresh ohne Timeout (Fehler):** `userManager.signinSilent()` ohne Argument reicht `timeoutInSeconds: undefined` durch, das in `_useRefreshToken` den Settings-Default per Spread überschreibt (`oidc-client-ts.js:3121`, `:3160`) → `fetchWithTimeout` ohne Timeout. Bei hängender Verbindung blockiert der Guard die Erstnavigation, `getAccessToken()` liegt außerhalb des API-Timeouts. Fix: `signinSilent({ silentRequestTimeoutInSeconds: 10 })`. Prüfen, ob `requireAuth` bei vorhandenem Cache die Navigation freigeben kann, statt auf die Erneuerung zu warten.
- **N7 Callback-Sackgasse (Fehler):** Bei Fehler in `Callback.vue` → `router.replace("/")` → Guard `rejected` → `requestLogin` unterdrückt, weil `location.pathname` noch `/callback` ist → Spinner bleibt dauerhaft. Fix: `requestLogin` prüft das Ziel, nicht `location.pathname`; `Callback.vue` zeigt im Fehlerfall Meldung und Button „Erneut anmelden“; automatische Wiederholungen per `sessionStorage`-Zähler begrenzen.
- **N8 Vordergrund-Prüfung wirkt nicht:** `App.vue` verwirft das Ergebnis von `ensureAuth()`. Fix: bei `rejected` und online die zentrale Login-Stelle auslösen.
- **N9 Login-Redirect robust:** `loginStarted` bei `pageshow` mit `persisted` zurücksetzen (bfcache nach Zurück vom IdP). Im `onSessionRejected`-Listener nicht überspringen, solange ein Guard läuft, sondern auf `loginStarted` verlassen. Während `logout()` läuft, `requestLogin` unterdrücken (Rennen Widerruf ↔ Erneuerung).
- **N10 Client-Fehler präzisieren:** 408 und 429 sind kein verbindlicher Client-Fehler, sondern Ausfall (Cache). `loadSettings` bei 4xx konsistent zu Rezepten/Favoriten.
- **N11 Toter Code:** `searchRecipesApi` hat keinen Aufrufer (auch auf `main` nicht) → entfernen statt paginieren.
- **N12 Schnitt (eigener Commit, reine Verschiebung, zuletzt):** `auth/oidc.ts` teilen: `auth/session.ts` für `AuthState`, Klassifikation, Single-Flight-Erneuerung, `ensureAuth`, `getAccessToken`, `renewAfterUnauthorized`, `onSessionRejected`; in `oidc.ts` bleiben UserManager-Setup, `requestLogin`, `handleCallback`, `logout`, `getUser`.

Nicht in Nacharbeit 2 (im Bericht als bekannt vermerken): `invalid_scope`/Validierungsfehler nach Refresh gelten als `offline`; 401 auf frisch erneuerten Token hält die Quelle auf „cache“; Store-Schnitt (`recipeApi.listAll`, Mapper-Modul).

Abnahme Nacharbeit 2: Verifikation gemäß Projekt-CLAUDE.md; Auth-Simulation um N6 (hängender Token-Endpunkt → `offline` nach ≤ 10 s, Guard gibt frei), N7 (Callback-Fehler → kein Endlos-Spinner, begrenzte Wiederholung), N8, N9 (bfcache, Logout-Rennen), N10 erweitert; Testszenarien im Bericht um „Callback-Fehler“ ergänzt; Bericht fortschreiben.
