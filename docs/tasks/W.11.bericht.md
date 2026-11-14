# Bericht W.11: Rezepte nach Login und Token-Ablauf zuverlässig laden

> Branch `worktree-W.11-login-laden` · Basis `d101f5f` (Auftrag: `f20df40`, dazwischen nur `docs(roadmap)`) · Stand `b482bca` · 2026-11-14 · Dauer: 15:46 – 16:21 (35 min, davon Warten an Checkpoints 17 min) · Status: fertig

## Ergebnis
Die Token-Erneuerung läuft als Single-Flight, die sich alle Aufrufer teilen. Ihr Ergebnis ist `valid`, `offline` oder `rejected`. `getAccessToken()` erneuert einen abgelaufenen Token, statt `null` zu liefern. Rezepte, Settings und Favoriten werden erst nach geklärtem Auth-Zustand geladen. Nachgeladen wird nach Login/Erneuerung (`userLoaded`), wenn das Gerät wieder online ist und wenn die App wieder in den Vordergrund kommt. Daten aus IndexedDB sind im Banner als „Offline-Daten“ markiert. Die Rezeptliste lädt alle Seiten.

## Commits
- `63d1fca` feat(auth): Token-Erneuerung als Single-Flight mit Ergebnis-Typ
- `ff52806` feat(frontend): Daten nach geklärtem Auth-Zustand laden, Cache markieren
- `b68f94b` refactor(auth): toten addUserSignedOut-Handler entfernen
- `b482bca` docs(roadmap): Plan W.11 um Befunde C2, T2, T4 ergänzen

## Erkundung (Auftrag Schritt 1)
- **`isAuthenticated()`:** 13 Aufrufe, 12 im Store, 1 in `useRecipeHelper.loadRecipe`. Die drei Lade-Aufrufe sind durch `loadAll()` → `ensureAuth()` ersetzt. Die übrigen Aufrufe (Schreibpfade, Detail) nutzen weiter `isAuthenticated()`, das jetzt über `ensureAuth()` abgelaufene Tokens erneuert.
- **IndexedDB-Rückfälle:** `loadSettings`, `loadRecipes` (mit localStorage-Migration und Beispielrezept), `loadFavorites`, `useRecipeHelper.loadRecipe` (Detail). Hinzu kommen die Schreibzugriffe in `saveSettings`, `saveRecipes`, `setRecipe`, `add/removeFavorite`, `loadRecipesFromApi`, `loadRecipeDetailFromApi` und `prefetchRecipeDetails`. Alle laufen jetzt über `js/offlineCache.ts`. Ausnahme ist `recipe_pictures`; das bleibt laut Auftrag im Store.
- **oidc-client-ts 3.5.0, aus dem Quelltext:**
  - Ist ein Refresh-Token vorhanden, geht `signinSilent()` direkt an den Token-Endpunkt, ohne iframe. Die iOS/ITP-Sorge betrifft nur Sitzungen ohne Refresh-Token.
  - Parallele `signinSilent()` werden **nicht** zusammengefasst (T2 war echt).
  - `automaticSilentRenew` reagiert nur auf den „expiring“-Timer eines noch gültigen Tokens. Ein beim Start bereits abgelaufener Token löst nichts aus.
  - `monitorSession` ist standardmäßig `false`, `addUserSignedOut` feuerte also nie.
  - Ein Fehler am Token-Endpunkt mit OAuth-JSON wird zu `ErrorResponse`. Netzfehler ergeben `TypeError`, Timeouts `ErrorTimeout` (Standard 10 s), sonstige HTTP-Fehler ein generisches `Error`.
- **`public/silent-renew.html`** sendet `location.href` als String. Die Bibliothek erwartet aber `{source: "oidc-client", url, keepOpen}`. Eine iframe-Erneuerung würde deshalb immer nach 10 s abbrechen. Sie wird nicht mehr genutzt: Ohne Refresh-Token gilt `rejected`. Die Datei ist unverändert.
- **C2 (nur bewertet):** Bei `registerType: autoUpdate` ruft `registerSW` `onNeedRefresh` nie auf, der Hook `router.afterEach` in `main.ts` ist toter Code. In Wirklichkeit lädt vite-plugin-pwa 1.2.0 die Seite **sofort** neu, sobald ein neuer Service Worker aktiv wird. Das trifft auch Sitzungen, in denen gerade gekocht oder bearbeitet wird (Entwürfe sichert `useDraft`). Nach Updates sucht der Browser nur bei Navigation oder Registrierung. Eine fortgesetzte iOS-PWA kann deshalb lange mit altem JS laufen. Folgepunkt siehe unten.
- **`cachedRole`:** Keine Änderung nötig. Ein Benutzerwechsel geht immer über einen Redirect zum IdP, die Seite wird also voll neu geladen und der Modulzustand zurückgesetzt.

## Verifikation
- `npm run lint:check && npm run typecheck && npm run build`: grün (ESLint ohne Befund, vue-tsc ohne Fehler, Build inkl. Service Worker)
- Auth-Simulation: `auth/oidc.ts` mit rolldown gebündelt, `oidc-client-ts` durch eine Attrappe ersetzt, 21 Prüfungen in Node, alle OK. Geprüft:
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
- Sichtprüfung: keine. Ohne IdP ist das lokal nicht lauffähig; die Abnahme auf iPhone/iPad steht unten.
- Prüfzeit: ~2 min; größter Posten: `npm run build` (gesamte Kette 1:51 min)
- Prüfskripte: nur Scratchpad (`authsim/`). Sie wären die Vorlage für W.10.

## Testszenarien für die Abnahme (iPhone/iPad, PWA)
Konsole bzw. Web-Inspector: Jede Erneuerung erzeugt die Meldung `[Auth] Token-Erneuerung per Refresh-Token`.
1. **Frischer Login:** abmelden, anmelden. Erwartung: Rezepte, Favoriten und Settings kommen ohne manuelles Neuladen von der API, kein Banner. Im Netzwerk-Tab je ein Aufruf `/recipes?page=1…`, `/favorites`, `/me/settings` nach dem Callback.
2. **PWA nach Ablauf des Access-Tokens öffnen** (nach mehr als dessen Laufzeit, App aus dem Hintergrund oder neu gestartet). Erwartung: kein Login, kein „Offline-Daten“, Daten von der API. Genau **eine** Meldung „Token-Erneuerung“ und **ein** POST an den Token-Endpunkt, obwohl Guard, Settings, Rezepte, Favoriten und Bilder gleichzeitig starten.
3. **Flugmodus, App öffnen:** Erwartung: Rezepte aus dem Cache, Banner „Offline · Offline-Daten“. Netz wieder an: Erwartung: automatisches Nachladen, Banner verschwindet.
3b. **API ausgefallen, Netz da** (z. B. Backend-Container gestoppt): Erwartung: Banner nur „Offline-Daten“. Backend starten, App in den Hintergrund und wieder nach vorn: Erwartung: Nachladen, Banner verschwindet.
4. **Session widerrufen** (im IdP die Offline-Session bzw. die App-Sitzung des Nutzers beenden), dann PWA mit abgelaufenem Access-Token öffnen. Erwartung: Weiterleitung zum Login, keine stillen Cache-Daten. Ohne Netz in diesem Zustand: Cache-Daten (ohne Netz ist kein Login möglich).
5. **Laufender Betrieb über die Token-Laufzeit hinaus** (App offen lassen): Erwartung: etwa 60 s vor Ablauf genau eine Erneuerung, kein Neuladen der Rezeptliste.

## Struktur und Doku
- **Gewachsene Dateien:** `store/recipeStore.ts` hat jetzt 490 Zeilen (vorher 426). Gründe sind `loadAll`/`reloadIfStale`/`loadAllOnce`, Paginierung und Mapper. Die Mapper `listItemToRecipe` und `detailToRecipe` ersetzen drei vorhandene Kopien desselben Codes. `auth/oidc.ts` hat 198 Zeilen (vorher 126).
- **Neues Modul:** `frontend/src/js/offlineCache.ts`
- **Bewusste Duplikate:** keine
- **CLAUDE.md, `.claude/rules/frontend.md`:** stimmen noch. Hinweis: Die Rule beschreibt `autoUpdate` korrekt, sagt aber nichts zum sofortigen Neuladen (siehe Folgepunkt C2).

## Abweichungen vom Auftrag
- **`views/Callback.vue` unverändert** (laut Ablage sollte die Datei wachsen). `signinRedirectCallback` löst `userLoaded` aus, und darüber lädt `App.vue` nach. Ein zusätzlicher Aufruf in `Callback.vue` wäre ein zweiter Mechanismus. Gegen das Wettrennen mit dem Ladelauf aus `onMounted` hilft der Folgelauf in `loadAll()`.
- **Zusätzlich:** Nachladen bei `visibilitychange` (App wieder im Vordergrund). Eine fortgesetzte iOS-PWA erhält kein `online`-Event. Ohne diesen Auslöser bliebe „Offline-Daten“ bei einem API-Ausfall mit Netz bis zum nächsten Token-Ereignis stehen. Das Nachladen greift nur, wenn die Daten nicht von der API stammen.
- **Nachladen bei `userLoaded` und online nur, wenn die Daten nicht von der API stammen.** Sonst würde jede reguläre Erneuerung (alle paar Minuten) die ganze Liste neu laden.
- **localStorage-Migration in `loadRecipes`:** Die Logik ist unverändert, nur `get`/`set` laufen jetzt über `offlineCache`, und der Block wird awaited statt mit `.then()` nebenher ausgeführt.
- **T4 ohne Keycloak-Werte entschieden** (Rückmeldung am Checkpoint: Die Lösung muss IdP-agnostisch mit allen Einstellungen funktionieren). Session-Monitoring bleibt aus und der tote `addUserSignedOut`-Handler ist entfernt. Das Ende der Sitzung greift, sobald der IdP die Erneuerung ablehnt.

## Nachgetragen in Specs/Plänen
- `docs/plans/zuverlaessigkeit-login-ai-import.md`: C2 korrigiert, T2 bestätigt/behoben, T4 entschieden, Checkpoint erledigt

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **C2, Service-Worker-Update steuern:** Das sofortige Neuladen mitten in der Sitzung vermeiden, z. B. mit `registerType: prompt` und Neuladen beim nächsten Seitenwechsel, so wie der heutige tote Code es gemeint hat. Dazu periodisch oder bei `visibilitychange` `registration.update()` aufrufen. Aufwand S.
- **Erneuerung über mehrere Tabs absichern:** Rotation mit Max Reuse 0 und zwei gleichzeitig erneuernden Tabs. Ein enges Zeitfenster bleibt, in dem ein Tab den frisch gespeicherten Token des anderen löscht. Folge ist ein Login-Redirect, kein Datenverlust. Abhilfe: Web Locks API (`navigator.locks`, iOS ≥ 15.4) um `renewToken()`, ohne neue Abhängigkeit. Für eine PWA mit einem Fenster ist das kaum relevant. Aufwand S.
- **`public/silent-renew.html` reparieren** (`signinSilentCallback()` bzw. das richtige Nachrichtenformat) oder samt `silent_redirect_uri` entfernen; die Seite wird nicht mehr genutzt. Aufwand XS.
- **Erneuerungsversuche bei IdP-Ausfall mit Netz:** Jeder API-Aufruf versucht erneut eine Erneuerung (parallele Aufrufe werden zusammengefasst). Ein kurzes Backoff wäre möglich. Aufwand XS, nur bei Bedarf.
- **C3** (Prefetch der Details bricht ab → offline fehlen Details): unverändert, war nicht beauftragt.

## Status je Roadmap-Punkt
- `W.11` fertig (Abnahme auf dem Gerät steht aus)

## Vorschlag Roadmap-Zeilen
`- [x] W.11 Rezepte nach Login und Token-Ablauf zuverlässig laden · 2026-11-14 · b482bca`
