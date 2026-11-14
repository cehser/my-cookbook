# Plan: Zuverlässigkeit Login-Laden und AI-Import

Stand: 2026-11-14 · Roadmap: W.11, W.12

## Symptome (Meldung des Nutzers)
- Nach dem Login sind nicht sofort alle Rezepte geladen.
- Der AI-Import per Foto oder Weblink hakt manchmal.

Nicht reproduziert. Die Befunde unten stammen aus dem Lesen des Codes (2026-11-14). Stand ist jeweils angegeben: **Code** = Ablauf im Code belegt, **plausibel**, **unbestätigt** = vor einer Entscheidung prüfen.

## W.11 Rezepte zuverlässig laden

### Ursachen
| # | Befund | Stand |
|---|---|---|
| L1 | `App.vue` `onMounted` ruft `loadRecipes()` einmal auf, auch auf `/callback`. Der Token-Tausch in `Callback.vue` läuft dann noch, also `isAuthenticated()` false → IndexedDB oder Beispielrezept. Nach dem Login wird nicht neu geladen. | Code |
| L2 / T1 | Wegen `offline_access` (Refresh-Token in `localStorage`) ist der Access-Token beim App-Start meist abgelaufen. `isAuthenticated()` prüft nur `!expired` und versucht keinen Refresh → IndexedDB. Regelfall, nicht Ausnahme. | Code |
| L3 | Die Liste lädt höchstens 200 Rezepte (`page_size: 200`, keine Paginierung). | Code, erst ab über 200 Rezepten relevant |
| C1 | Jeder API-Fehler (auch 5xx/Timeout) fällt still auf IndexedDB zurück: kein Hinweis „Offline-Daten“, kein späteres Nachladen. | Code |
| C2 | Der Service Worker aktiviert Updates erst beim nächsten Seitenwechsel (`main.ts`). Eine Sitzung kann mit altem JS laufen. | plausibel |
| C3 | Die Liste in IndexedDB enthält nur Kopfdaten, die Details kommen per Prefetch. Bricht das Prefetch ab, fehlen sie offline. | Code, nur offline |
| T2 | Beim Start laufen `loadSettings`, `loadRecipes`, `loadFavorites` und der Guard parallel. `getAccessToken()` liefert bei Ablauf `null` → 401 → `signinSilent()` je Anfrage, dazu Guard und `automaticSilentRenew`. Ob oidc-client-ts parallele Aufrufe zusammenfasst: unbestätigt. | Code |
| T3 | Ist in Keycloak „Revoke Refresh Token“ (Rotation) aktiv, scheitern parallele Refreshes mit `invalid_grant` → wirkt wie Logout oder Ladefehler. | hängt vom IdP ab |
| T4 | `addUserSignedOut` leitet zum Login um, auch wenn der Offline-Token noch gilt. Ob das Ereignis feuert (Session-Monitoring): unbestätigt. | Code |
| T5 | „Kein Netz“ und „Anmeldung abgelehnt“ werden gleich behandelt (still IndexedDB). | Code |

### Richtung
- Eine gemeinsame Refresh-Funktion (Single-Flight). `getAccessToken()` erneuert vor der Anfrage, statt `null` zu liefern.
- Erst laden, wenn `ensureAuthenticated()` fertig ist. Nach Login und Token-Erneuerung neu laden (oidc-client-ts-Events).
- IndexedDB nur bei echtem Offline oder API-Ausfall, in der Oberfläche als „Offline-Daten“ markiert, Nachladen sobald möglich.
- Ohne Netz: IndexedDB. Anmeldung abgelehnt: Login.
- Verhalten von oidc-client-ts (`signinSilent` mit Refresh-Token, parallele Aufrufe, `monitorSession`) gegen dessen Doku prüfen.

### Checkpoint
Vor der Entscheidung zu T4 braucht es die Keycloak-Werte (liefert der Nutzer nach): Access Token Lifespan, Revoke Refresh Token, SSO Session Idle/Max, Offline Session Idle/Max. T1–T3 und T5 hängen nicht davon ab. Fehlen die Werte bis zum Merge, wird T4 als eigener Punkt abgespalten.

### Nicht-Scope
Refresh-Token in `localStorage` und fehlende CSP (XSS-Risiko): zur Kenntnis, eigener Punkt bei Bedarf.

## W.12 AI-Import robust

| # | Befund | Stand |
|---|---|---|
| A1 | `prod.conf` setzt kein `proxy_read_timeout` (nginx-Standard 60 s). Ein URL-Import mit Websuche kann länger dauern → 504. Das Timeout des äußeren Reverse-Proxys ist unbekannt. | Konfiguration |
| A2 | `api/ai.ts` nutzt eigenes `fetch` ohne 401-Retry/Refresh aus `api/client.ts`. | Code |
| A3 | Das Backend fängt OpenAI-Fehler (Rate-Limit, Timeout, Modell) nicht ab → generisches 500. | Code |
| A4 | Die Regex für Codeblöcke erwartet exakt ```` ```yaml\n ````. Varianten (`YAML`, `\r\n`, Text davor) lassen `jsyaml.load` scheitern. | plausibel |
| A5 | nginx erlaubt 10 MB, das Backend 20 MB. Große Fotos scheitern mit 413 an nginx; die Grenze des äußeren Proxys ist unbekannt. | Konfiguration |
| A6 | Modell-IDs (`gpt-4o`, `gpt-4o-mini`) und das Tool `web_search_preview` könnten veraltet sein. | unbestätigt, gegen OpenAI-Doku prüfen |

Belege aus dem Betrieb (vom Nutzer, nur lesend):
```bash
docker compose logs backend --since 72h | grep -i -E "error|exception|openai|timeout"
docker compose logs frontend --since 72h | grep -E '" (413|499|502|504) '
```
