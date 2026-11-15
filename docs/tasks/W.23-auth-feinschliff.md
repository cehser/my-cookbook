# Auftrag W.23: Auth-Feinschliff, Login-Entscheidung zentral

> Erstellt 2026-11-15 vom Master · Roadmap: `ROADMAP.md` Punkt W.23 · Basis: `main@b07bb40` · Aufwand: M · Modell: Opus

## Ziel
Ob und wann die App zum Login leitet, entscheidet genau eine Stelle in `session.ts` nach der Zustandstabelle unten; Guards, Router, App und Callback rufen nur diese auf. Damit funktionieren der Login nach offline → online, die Rolle ohne Netz und der Start bei hängendem IdP, und es gibt keine doppelte Erneuerung. Der Import-Zyklus `oidc.ts` ⇄ `session.ts` verschwindet. Kein neues Login-Verfahren, keine IdP-Änderung.

## Erst lesen
1. `docs/plans/zuverlaessigkeit-login-ai-import.md` – Abschnitt „W.23 Auth-Feinschliff“
2. `.claude/rules/frontend.md` – „Sitzung und Login“
3. `docs/tasks/W.11.bericht.md` – „Offen und Folgepunkte“ (Web Locks, `silent-renew.html`, Backoff, bekannte Lücken)
4. `docs/tasks/W.10-vitest.md` – „Korrektur“ (fehlende Sperre im Callback), `docs/tasks/W.25.bericht.md` – Chunk-Handler und `applyUpdate` ohne Unit-Tests
5. `frontend/src/auth/{oidc,session,guards}.ts`, `src/App.vue` (Resume, online), `src/router/index.ts` (Login-Ziel, `onSessionRejected`, Chunk-Handler), `src/views/Callback.vue`, `src/js/swUpdate.ts`, `src/js/offlineCache.ts`
6. Vorhandene Specs: `App.spec.ts`, `Callback.spec.ts`

## Zustandstabelle (Vorgabe)

Begriffe: **Sitzung** = `ensureAuth()`-Ergebnis (`valid`, `offline` = Erneuerung nicht möglich, `rejected` = keine Sitzung oder vom IdP abgelehnt). **Netz** = `navigator.onLine`. **Cache** = `hasCachedRecipes()`. **Login** = `requestLogin(Ziel)`, nie für öffentliche Routen (`meta.public`, Callback, Share-Link), nie während Logout. **Login vormerken** = merken und beim nächsten `online`-Ereignis bzw. nächsten Auslöser mit Netz ausführen.

| Auslöser | Sitzung | Netz | Cache | Verhalten |
|---|---|---|---|---|
| Navigation (geschützt) | valid | – | – | durchlassen |
| Navigation | offline | – | ja | durchlassen (nur lesen), Guard wartet nicht auf die Erneuerung |
| Navigation | offline | – | nein | durchlassen, Hinweis „Keine Verbindung, noch keine Daten“ statt leerem Bildschirm |
| Navigation | rejected | ja | ja | durchlassen, danach Login (wie heute) |
| Navigation | rejected | ja | nein | Navigation abbrechen, Login |
| Navigation | rejected | nein | ja/nein | durchlassen (wie offline), Login vormerken |
| Navigation mit Rolle | wie oben | – | – | Rolle aus dem Speicher; ohne bekannte Rolle: `/me`, aber höchstens so lange wie die Erneuerung; offline ohne bekannte Rolle → Startseite mit Hinweis |
| Resume (`visible`) | valid, Token nicht abgelaufen | – | – | nichts |
| Resume | Token abgelaufen | ja | – | eine Erneuerung (Single-Flight, keine zweite durch Ablauf-Timer oder Store) |
| Resume | rejected | ja | – | Login für aktuelle Route |
| Resume | rejected/offline | nein | – | Login vormerken bzw. nichts |
| `online`-Ereignis | Login vorgemerkt oder keine Sitzung | ja | – | Login für aktuelle Route |
| `online`-Ereignis | sonst | ja | – | `ensureAuth()` (erneuert bei Bedarf), Daten laden wie heute |
| Sitzung abgelehnt (Timer, 401, Store) | rejected | ja | – | Login für aktuelle Route |
| Sitzung abgelehnt | rejected | nein | – | Login vormerken |
| Callback | – | – | – | Code genau einmal verarbeiten (Sperre auch bei zweitem Mount/Reload), Erfolg → Ziel, Fehler → Meldung und der vorhandene begrenzte Neuversuch |
| IdP hängt (Timeout) | → offline | ja | ja/nein | wie „offline“; kein endloses Warten, Hinweis ohne Cache |

Widerspricht die Tabelle beim Umsetzen dem Code oder sich selbst, anhalten und vorlegen (siehe Checkpoints).

## Auftrag
1. **`auth/userManager.ts`:** `UserManager`-Instanz und Setup aus `oidc.ts` dorthin; `session.ts` importiert nur noch `userManager.ts`, `oidc.ts` nutzt `session.ts`. Kein Zyklus mehr (Kommentar zur Temporal Dead Zone entfernen).
2. **Zentrale Entscheidung** in `session.ts` nach der Tabelle: ein Einstieg je Auslöser (z. B. `onNavigation`, `onResume`, `onOnline`, `onRejected`); „Netz“ wird nur dort geprüft. `requireAuth`, `requireRole`, Router (`onSessionRejected`), `App.vue` (Resume, online) und `Callback.vue` rufen nur diese Einstiege auf.
3. **Callback-Sperre** gegen doppelte Verarbeitung desselben Codes.
4. **Mehrere Tabs:** `renewToken` unter `navigator.locks` (Fallback ohne Locks: wie heute); nach dem Lock prüfen, ob ein anderer Tab bereits erneuert hat.
5. **Backoff:** nach einer als `offline` gewerteten Erneuerung mit Netz frühestens nach 30 s erneut versuchen (API-Aufrufe teilen das Ergebnis), danach normal.
6. **Aufräumen:** `public/silent-renew.html` und `silent_redirect_uri` entfernen; `getAccessToken` aus `oidc.ts` **nicht** entfernen (siehe Fallstricke), als Re-Export aus `session.ts` belassen und markieren.
7. **Tests (Vitest):**
   - Zustandstabelle: je Zeile ein Fall gegen die Einstiege in `session.ts` (`userManager`, `navigator.onLine`, `hasCachedRecipes`, `requestLogin` gemockt).
   - Single-Flight und Lock, Backoff, Callback-Sperre.
   - Chunk-Handler (`router/index.ts`: `vite:preloadError` nur während Navigation, Schleifenschutz 10 s) und `applyUpdate` (`swUpdate.ts`: nicht offline, nicht bei `pendingWrites`). Dafür nötige kleine Exporte sind erlaubt, Verhalten nicht ändern.
8. **Doku:** `.claude/rules/frontend.md` „Sitzung und Login“ auf den neuen Aufbau; Plan-Abschnitt W.23 als umgesetzt markieren.

## Ablage
- Neu: `src/auth/userManager.ts`, Specs `src/auth/session.spec.ts` (Tabelle), `src/router/index.spec.ts` bzw. `src/js/swUpdate.spec.ts`
- Geändert: `src/auth/{oidc,session,guards}.ts`, `src/App.vue` (nur Auth-Teile), `src/router/index.ts`, `src/views/Callback.vue`, `src/js/swUpdate.ts` (nur testbare Exporte), `public/silent-renew.html` (gelöscht), `.claude/rules/frontend.md`, Plan

## Nicht in diesem Auftrag
- `src/api/images.ts` (W.28 ändert die Datei parallel); Umstellung von `getAccessToken` dort folgt nach dem Merge von W.28
- IdP-/Keycloak-Einstellungen, Token-Laufzeiten, neue Login-Methoden
- Store-Logik außerhalb des Auth-Bezugs, `App.vue` ohne Bezug zum Login
- Verhalten von SW-Update und Chunk-Handler ändern (nur testen)

## Entscheidungen, die ich treffe
- keine über die Tabelle hinaus. Abweichungen nur über den Checkpoint.

## Fallstricke
- **W.28 läuft parallel** und ändert `api/images.ts`, `recipeStore.ts`, `HomeView.vue`, `Recipe.vue`, `Edit.vue`, `AIRecipeImport.vue`. Diese Dateien nicht anfassen. `api/images.ts` importiert `getAccessToken` aus `@/auth/oidc`; der Export muss bleiben.
- **oidc-client-ts:** `signinSilent()` immer mit `silentRequestTimeoutInSeconds` (Rule). `getUser()` liest Storage; nach einer Erneuerung in einem anderen Tab kann der Token schon rotiert sein (vorhandene Prüfung in `renewOnce` erhalten).
- **Login-Ziel beim Kaltstart:** Vor Abschluss der ersten Navigation ist `currentRoute` die Startroute `/`; `router/index.ts` nutzt deshalb `pendingTarget`. Öffentliche Links dürfen keinen Login auslösen.
- **`App.vue` cancelt beim Kaltstart** die Initialnavigation per `router.replace(savedPath)`; Guards laufen dabei zweimal.
- **`navigator.onLine`** ist nur bei `false` verlässlich (WLAN ohne Internet meldet `true`); Timeout der Erneuerung (10 s) bleibt die eigentliche Absicherung.
- **iOS-PWA:** `online`-Ereignis und `visibilitychange` kommen nach dem Aufwecken in beliebiger Reihenfolge; beide Einstiege müssen idempotent sein (kein doppelter Login-Redirect).
- **Web Locks:** iOS ≥ 15.4; Lock nur um die Erneuerung, nicht um `requestLogin`.
- Bestehende Specs (`App.spec.ts`, `Callback.spec.ts`) mocken `@/auth/oidc`; nach dem Umbau Mocks anpassen, Testabsicht beibehalten.

## Checkpoints
- Nur falls die Zustandstabelle beim Umsetzen widersprüchlich, unvollständig oder mit dem Code unvereinbar ist: betroffene Zeilen mit Vorschlag vorlegen und anhalten. Sonst ohne Halt bis zum Bericht.

## Abnahme
- Kein Import von `@/auth/oidc` in `session.ts`; kein Zyklus (`madge` o. Ä. nicht nötig: `grep` genügt)
- Jede Zeile der Zustandstabelle hat einen Test; Callback-Sperre, Lock, Backoff, Chunk-Handler und `applyUpdate` getestet
- Login-Entscheidungen nur noch über die Einstiege in `session.ts` (`grep` nach `requestLogin` außerhalb von `session.ts`/`oidc.ts`)
- Browserszenarien im Build (`playwright-core` wie in W.22/W.25, OIDC per Mock-IdP oder gestubbtem `userManager`, im Bericht begründen): offline → online ohne Sitzung führt zum Login; Kaltstart mit hängendem IdP ohne Cache zeigt Hinweis; öffentlicher Link ohne Login
- Szenarien für meinen Gerätetest (iPhone/iPad, PWA) im Bericht
- Verifikation gemäß Projekt-CLAUDE.md (Frontend, inkl. `npm test`)
