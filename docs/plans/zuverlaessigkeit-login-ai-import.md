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
| C2 | Korrigiert (W.11): Bei `registerType: autoUpdate` ruft `registerSW` `onNeedRefresh` nie auf, der Hook in `main.ts` ist toter Code. Das Plugin lädt die Seite **sofort** neu, sobald ein neuer Service Worker aktiv wird, auch mitten in einer Sitzung. Nach Updates sucht der Browser nur bei Navigation/Registrierung; eine fortgesetzte iOS-PWA kann lange mit altem JS laufen. | Code (vite-plugin-pwa 1.2.0) |
| C3 | Die Liste in IndexedDB enthält nur Kopfdaten, die Details kommen per Prefetch. Bricht das Prefetch ab, fehlen sie offline. | Code, nur offline |
| T2 | Beim Start laufen `loadSettings`, `loadRecipes`, `loadFavorites` und der Guard parallel. `getAccessToken()` liefert bei Ablauf `null` → 401 → `signinSilent()` je Anfrage, dazu Guard und `automaticSilentRenew`. oidc-client-ts 3.5 fasst parallele `signinSilent()` nicht zusammen. Behoben in W.11 (Single-Flight). | Code |
| T3 | Ist in Keycloak „Revoke Refresh Token“ (Rotation) aktiv, scheitern parallele Refreshes mit `invalid_grant` → wirkt wie Logout oder Ladefehler. | hängt vom IdP ab |
| T4 | `addUserSignedOut` feuerte nie: `monitorSession` ist standardmäßig aus. Entscheidung (2026-11-14): Session-Monitoring bleibt aus (nicht IdP-agnostisch, iOS-Cookies), Handler entfernt. Das Sitzungsende greift über die abgelehnte Erneuerung; Laufzeiten sind IdP-Einstellung. | erledigt (W.11) |
| T5 | „Kein Netz“ und „Anmeldung abgelehnt“ werden gleich behandelt (still IndexedDB). | Code |

### Richtung
- Eine gemeinsame Refresh-Funktion (Single-Flight). `getAccessToken()` erneuert vor der Anfrage, statt `null` zu liefern.
- Erst laden, wenn `ensureAuthenticated()` fertig ist. Nach Login und Token-Erneuerung neu laden (oidc-client-ts-Events).
- IndexedDB nur bei echtem Offline oder API-Ausfall, in der Oberfläche als „Offline-Daten“ markiert, Nachladen sobald möglich.
- Ohne Netz: IndexedDB. Anmeldung abgelehnt: Login.
- Verhalten von oidc-client-ts (`signinSilent` mit Refresh-Token, parallele Aufrufe, `monitorSession`) gegen dessen Doku prüfen.
- Datenzugriff (API und IndexedDB) in einer Zugriffsschicht bündeln statt verstreuter `get`/`set`-Aufrufe, damit die spätere Offline-Bearbeitung (Roadmap 12) andocken kann. Offline-Schreiben selbst ist nicht Teil von W.11.

### Checkpoint
Erledigt (2026-11-14): Die Lösung hängt nicht von den Keycloak-Werten ab (IdP-agnostisch), Laufzeiten sind eine Security-Einstellung im IdP. T4 siehe Tabelle.

### Nicht-Scope
Refresh-Token in `localStorage` und fehlende CSP (XSS-Risiko): zur Kenntnis, eigener Punkt bei Bedarf.

## W.12 AI-Import robust

**Stand 2026-11-15: umgesetzt (W.12, `e9d2689`).** A1–A8 erledigt. Bericht: [W.12.bericht.md](../tasks/W.12.bericht.md), Regeln: `.claude/rules/ai-import.md`.

| # | Befund | Stand |
|---|---|---|
| A1 | `prod.conf` setzt kein `proxy_read_timeout` (nginx-Standard 60 s). Ein URL-Import mit Websuche kann länger dauern → 504. Das Timeout des äußeren Reverse-Proxys ist unbekannt. | Konfiguration |
| A2 | `api/ai.ts` nutzt eigenes `fetch` ohne 401-Retry/Refresh aus `api/client.ts`. | Code |
| A3 | Das Backend fängt OpenAI-Fehler (Rate-Limit, Timeout, Modell) nicht ab → generisches 500. | Code |
| A4 | Die Regex für Codeblöcke erwartet exakt ```` ```yaml\n ````. Varianten (`YAML`, `\r\n`, Text davor) lassen `jsyaml.load` scheitern. | plausibel |
| A5 | nginx erlaubt 10 MB, das Backend 20 MB. Große Fotos scheitern mit 413 an nginx; die Grenze des äußeren Proxys ist unbekannt. | Konfiguration |
| A6 | Modell-IDs (`gpt-4o`, `gpt-4o-mini`) und das Tool `web_search_preview` könnten veraltet sein. | unbestätigt, gegen OpenAI-Doku prüfen |
| A7 | Das Modell wählt jeder Nutzer in seinen Settings (`gpt_model`), der Client schickt es mit, das Backend übernimmt den String ungeprüft (`AITextRequest.model`, Query `model`). Jeder Editor kann so beliebige, auch teure Modelle aufrufen. | Code |
| A8 | Foto-Upload sendet keinen Request: `@change` an `BFormFile` liest `event.target.files`, bootstrap-vue-next 0.44 emittiert nach dem Dateidialog aber ein nicht dispatchtes `CustomEvent` (`target` = `null`) → `TypeError` nur in der Konsole, keine Vorschau, kein Button, keine Meldung. Fix: per `watch` auf das `v-model` `uploadedFile` reagieren. Als erster Schritt in W.12. | bestätigt 2026-11-15 (Konsole: `Cannot read properties of null (reading 'files')`) |

Belege aus dem Betrieb (vom Nutzer, nur lesend):
```bash
docker compose logs backend --since 72h | grep -i -E "error|exception|openai|timeout"
docker compose logs frontend --since 72h | grep -E '" (413|499|502|504) '
```

### Entschieden (2026-11-14): Modell, Key, Endpunkt
- **Modell** ist eine Admin-Einstellung in `site_settings` (JSONB, keine Migration), optional getrennt für Text/URL und Foto. Das Backend wählt das Modell; der Client schickt keins mehr. Beim Speichern prüft das Backend, ob das Modell mit dem Key erreichbar ist.
- Die persönliche Einstellung `gpt_model` und der `model`-Parameter der AI-Routen entfallen (Frontend und Backend).
- **API-Key** bleibt in der Umgebung (`OPENAI_API_KEY`), nicht in der DB: sonst stünde er in jedem `pg_dump`-Backup und im ZIP-Export (11.1). Die Admin-Seite zeigt nur „Key konfiguriert: ja/nein“ und bietet einen Verbindungstest.
- **Endpunkt** wird nicht konfigurierbar: URL-Import nutzt die Responses API mit Websuche (OpenAI-spezifisch); andere Anbieter unterstützen Vision und Structured Outputs unterschiedlich. Bei echtem Bedarf (z. B. Azure OpenAI) später als Umgebungsvariable.

### Entschieden (2026-11-15, Checkpoint W.12)
- **Structured Outputs** über die Responses API (`responses.parse`, Schema `AIRecipe`) für Text, URL (mit `web_search`) und Foto. Kein YAML mehr im AI-Pfad; `js-yaml` bleibt für YAML-Import/-Export.
- **Default-Modell** `gpt-6-luna` (Text/URL und Foto getrennt einstellbar). `gpt-4o`/`gpt-4o-mini` laut OpenAI-Doku ab 2027-01-14 deprecated.
- **System-Prompt** liegt nur noch im Image (`backend/prompts/system_prompt.md`), kein Volume `recipe_prompts`; Änderung per Deploy. Fehlt die Datei, startet das Backend nicht.
- Zeitbudget: Backend 120 s < Frontend 135 s < nginx 150 s; Upload-Grenze 10 MB überall.

### Entscheidung im Auftrag: Structured Outputs statt YAML
Heute verlangt der Prompt YAML in einem Markdown-Block, das Frontend sucht es per Regex heraus (A4). Alternative: OpenAI Structured Outputs mit JSON-Schema des Rezepts; das Backend validiert und liefert JSON. Prüfen: Verfügbarkeit zusammen mit der Websuche (Responses API) und mit den eingesetzten Modellen (unbestätigt), Anpassung von `system_prompt.md`. Ergebnis als Checkpoint vorlegen, bevor umgebaut wird. `js-yaml` bleibt für YAML-Import/-Export.

## W.13 Foto-Aufnahme im AI-Import

Meldung: „Die Kamera-Komponente zickt manchmal.“ Hauptnutzung: PWA auf iOS/iPadOS.

| # | Befund (`AIRecipeImport.vue`) | Stand |
|---|---|---|
| K1 | Stream wird nur in `onBeforeUnmount` gestoppt. Bleibt der Inhalt des geschlossenen `BModal` gemountet, läuft die Kamera weiter → beim nächsten Öffnen `NotReadableError` oder schwarzes Bild. | Code; Mount-Verhalten von `BModal` unbestätigt |
| K2 | Tab-Wechsel stoppt die Kamera nicht. | Code |
| K3 | `capturePhoto` prüft nicht, ob das Video läuft; bei `videoWidth` 0 entsteht ein leeres Bild (`data:,`). | Code |
| K4 | Keine Auflösung angefordert → oft 640×480, Rezepttext schlecht lesbar. | plausibel |
| K5 | Kein `play()`, kein `muted`; Startverhalten in der iOS-PWA nicht gesichert. | unbestätigt |
| K6 | Kamera und Upload teilen `capturedImage`; „Neu“ startet die Kamera nicht; alte Fehlermeldung bleibt stehen. | Code |
| K7 | Keine Verkleinerung vor dem Upload; Handyfotos stoßen an die nginx-Grenze (A5). | Code |

### Entscheidung (2026-11-14)
Native Kamera statt `getUserMedia`: ein Tab „Foto aufnehmen oder wählen“ mit `<input type="file" accept="image/*">`. Live-Vorschau, Video, Canvas-Aufnahme und Stream-Verwaltung entfallen (K1–K6).

### Richtung
- Ob `capture="environment"` gesetzt wird, im Auftrag an iOS prüfen: mit dem Attribut öffnet iOS direkt die Kamera, ohne bietet es Kamera und Mediathek zur Wahl. Für einen gemeinsamen Tab ist „ohne“ naheliegend.
- Vor dem Upload per Canvas verkleinern (z. B. lange Kante 2000 px, JPEG ~0,85), ohne neue Abhängigkeit. Das wandelt auch HEIC in JPEG.
- Unbestätigt, im Auftrag prüfen: EXIF-Ausrichtung beim Zeichnen in den Canvas (Safari), HEIC-Lieferung durch iOS an `<input type="file">`.
- Abgrenzung zu W.12: W.12 regelt Server-Grenzen (nginx/Backend) und den API-Client, W.13 nur die Bildaufnahme im Frontend.

### Entschieden (2026-11-15): mehrseitige Vorlagen
Anlass: Rezepte über mehrere Seiten (Kochbuch, Zeitschrift) ließen sich nur mit einem Bild importieren.
- **1–10 Seiten je Import.** Auswahl mit `multiple` und Button „Seite hinzufügen“ (die Kamera liefert auf iOS je Aufnahme ein Bild). Vorschau aller Seiten, einzelne entfernen; Reihenfolge = Aufnahmereihenfolge.
- **Ein Modellaufruf** mit allen Seiten als `input_image` in Reihenfolge; der Prompt bekommt den Hinweis, dass es Seiten eines Rezepts sind.
- **`detail: "high"` ausdrücklich setzen**, statt sich auf `auto` zu verlassen. Laut [OpenAI-Doku](https://developers.openai.com/api/docs/guides/images-vision) skaliert `high` bei den meisten aktuellen Modellen auf 2048×2048; bei `gpt-6-astra` entspricht `auto` dagegen `original`. Für `gpt-6-luna` ist das Verhalten nicht dokumentiert.
- **Verkleinern** auf lange Kante ~2000 px, JPEG ~0,85: entspricht dem, was das Modell bei `high` nutzt; mehr Auflösung kostet nur Tokens, Zeit und Upload.
- **Grenzen:** Die 10 MB aus W.12 galten für ein unverkleinertes Foto, OpenAI erlaubt 512 MB je Anfrage. Bei 10 Seiten à 0,5–1 MB (Annahme) reicht 10 MB je Anfrage nicht sicher. Daher für `/api/v1/ai/` 20 MB je Anfrage (nginx und Backend), je Bild weiter höchstens 10 MB. Der äußere Reverse-Proxy auf dem Server muss mitziehen.
- **Messen** im Auftrag: Dateigröße je Seite, Gesamtgröße und Dauer bei 10 Seiten gegen das Zeitbudget 120/135/150 s; Lesbarkeit kleiner Schrift. Liest das Modell bei 2000 px zu schlecht, ist `detail: "original"` mit größerer Kante der Hebel, dann Grenzen neu bemessen.

### Abnahme
Auf iPhone und iPad als installierte PWA: Foto aufnehmen und aus der Mediathek wählen, jeweils Rezept erkennen; ein Rezept mit mehreren Seiten (auch 10) erkennen; Modal mehrfach öffnen und schließen ohne Fehler.

## W.28 Vorlage am Rezept speichern

Anlass: Das Foto des Imports wird nicht gespeichert; das KI-Ergebnis lässt sich später nicht mit der Vorlage vergleichen. Der URL-Import speichert seine Quelle schon in `source_url`.

### Ausgangslage
- `recipe_images` hält mehrere Bilder je Rezept (`sort_order`), die Oberfläche kennt aber nur ein Rezeptbild: `setRecipePicture` (`recipeStore.ts`) löscht vor dem Hochladen alle Bilder, Kachel und Detail zeigen `first_image_id`.
- Als normales Bild gespeichert, würde die Vorlage das Gerichtfoto ersetzen oder zum Titelbild werden.

### Entschieden (2026-11-15)
- **Eigene Bildart:** `recipe_images.kind` (`photo` | `source`), Default `photo`, Check-Constraint; Migration.
- `photo`-Logik berücksichtigt nur `photo`: `_get_first_image_id`, Listenabfrage (`distinct`/`distinct_on`, daher nach W.26), `setRecipePicture` (löscht nur `photo`), Admin-Aufräumfunktion.
- Nach dem Import lädt das Frontend die verkleinerten Seiten mit `kind=source` und `sort_order` = Seitenreihenfolge zum neuen Rezept hoch.
- **Anzeige:** aufklappbarer Abschnitt „Vorlage“ mit Vorschaubildern, antippen öffnet das Bild groß; in Detailansicht und Bearbeitung.
- **Nach dem Import** öffnet die App direkt die Bearbeitung des neuen Rezepts (statt nur Toast), damit man das Ergebnis gleich mit der Vorlage prüft.
- Export/Import (11.1/11.2) nimmt die Vorlagen samt `kind` mit.

## W.23 Auth-Feinschliff

Stand nach W.11 (2026-11-14): `session.ts` (Erneuerung, Auth-Zustand) und `oidc.ts` (Setup, Redirects, Logout) sind sauber getrennt; der Redirect läuft nur über `requestLogin`.

### Ursache der Restlücken
Die **Entscheidung**, ob ein Login ausgelöst wird, ist verteilt: `requireAuth` (2×), `requireRole`, `onSessionRejected` im Router, `checkSessionOnResume`, `Callback.vue`, `handleCallback`. Jede Stelle prüft „online“ etwas anders, das `online`-Ereignis löst gar nichts aus. Daraus folgen:
- kein Login bei offline → online ohne Sitzung
- `requireRole` ohne Cache-Kurzschluss, anderer Ablauf als `requireAuth`
- doppelte Erneuerung beim Resume
- leerer Bildschirm ohne Cache bei hängendem IdP

Der Import-Zyklus `oidc.ts` ⇄ `session.ts` entsteht nur, weil `session.ts` `userManager`, `isLogoutInProgress` und `requestLoginForCurrentRoute` braucht.

### Richtung
1. `userManager` in ein eigenes Modul (`auth/userManager.ts`), damit löst sich der Zyklus.
2. Login-Entscheidung zentral in `session.ts`: ein Einstieg je Auslöser (Navigation, Resume, online, rejected, Callback); Guards, Router und App rufen nur diesen auf. „online“ wird an genau einer Stelle geprüft.
3. Der Auftrag enthält die Zustandstabelle (Auth-Zustand × Auslöser × Cache vorhanden → Verhalten); die Unit-Tests für `session.ts` prüfen sie.
4. Dazu: Web Locks für mehrere Tabs und Backoff, `silent-renew.html`/`silent_redirect_uri` entfernen, Kompatibilitäts-Export `getAccessToken` aus `oidc.ts` entfernen.

### Nicht-Scope
- `recipeStore.ts`-Mapper (W.10), `App.vue` ohne Bezug zum Login
