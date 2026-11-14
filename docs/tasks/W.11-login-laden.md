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
