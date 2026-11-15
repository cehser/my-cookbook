# Auftrag W.22: Service-Worker-Update steuern

> Erstellt 2026-11-15 vom Master · Roadmap: `ROADMAP.md` Punkt W.22 · Basis: `main@af486fb` · Aufwand: S · Modell: Sonnet

## Ziel
Eine neue App-Version lädt nicht mehr mitten in der Benutzung neu, sondern beim nächsten Seitenwechsel oder wenn die App in den Hintergrund geht. Eine fortgesetzte iOS-PWA erkennt neue Versionen beim Wechsel in den Vordergrund, statt lange mit altem JS weiterzulaufen.

## Erst lesen
1. `docs/tasks/W.11.bericht.md` – Befund C2 und Folgepunkt „Service-Worker-Update steuern“
2. `frontend/src/main.ts` – heutiger, toter `onNeedRefresh`-Hook
3. `frontend/vite.config.js` – `VitePWA({ registerType: "autoUpdate" })`
4. `frontend/src/App.vue` – vorhandener `visibilitychange`-Handler (Sitzungsprüfung)

## Auftrag
1. `registerType` auf `"prompt"` umstellen; die erzeugte Workbox-Konfiguration prüfen (`skipWaiting`/`clientsClaim`), damit ein neuer SW wartet, bis die App ihn aktiviert.
2. Neues Modul `src/js/swUpdate.ts` (statt Logik in `main.ts`/`App.vue`):
   - `registerSW({ onNeedRefresh })` merkt sich die Funktion `updateSW`.
   - Ist ein Update bereit, wird es aktiviert (`updateSW(true)`, lädt neu) bei der **nächsten Navigation** (`router.afterEach`, nicht auf `/callback` und nicht beim ersten Laden) **oder** wenn die App in den Hintergrund geht (`visibilitychange` → `hidden`).
   - Beim Wechsel in den Vordergrund (`visible`) und beim Start `registration.update()` aufrufen, höchstens einmal je 30 min (gedrosselt), nur online.
3. `main.ts`: toten Hook entfernen, Modul einbinden.
4. `.claude/rules/frontend.md`: Satz zu `autoUpdate` durch das neue Verhalten ersetzen.

## Ablage
- Neu: `frontend/src/js/swUpdate.ts`
- Geändert: `frontend/src/main.ts`, `frontend/vite.config.js`, `.claude/rules/frontend.md`

## Nicht in diesem Auftrag
- Sichtbarer Hinweis „Neue Version verfügbar“ (Toast/Banner)
- Cache-Regeln für Bilder und API, `silent-renew.html` (W.23)
- Änderungen an `App.vue` und an der Sitzungslogik

## Entscheidungen, die ich treffe
- keine. Festgelegt: stilles Update bei Navigation oder Hintergrund, kein Hinweis-Dialog; Prüfung beim Vordergrund gedrosselt auf 30 min.

## Fallstricke
- Mit `prompt` aktiviert sich ein wartender SW erst, wenn alle Clients geschlossen sind. Eine iOS-PWA wird selten geschlossen; ohne `updateSW(true)` bliebe sie auf der alten Version.
- `router.afterEach` feuert auch bei der ersten Navigation nach dem Laden und beim OIDC-Callback. Ein Neuladen dort unterbricht den Login (`/callback` verarbeitet den Code nur einmal).
- Entwürfe sichert `useDraft`; ein Neuladen beim Verlassen von `Edit` ist unkritisch. Ein Neuladen im Hintergrund während einer laufenden Speicheranfrage nicht: `updateSW` erst auslösen, wenn keine schreibende Anfrage läuft, oder begründen, warum das Risiko vernachlässigbar ist.
- Der SW läuft nur im Build (`npm run build` + `vite preview` oder Docker-Stack), nicht im Dev-Server.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- Szenario im Build nachgewiesen und im Bericht beschrieben: Version A geladen → Version B gebaut und ausgeliefert → Tab bleibt offen ohne Neuladen → Seitenwechsel lädt B (Commit-Hash im Profil) → Tab in Hintergrund/Vordergrund mit wartendem Update lädt B
- Kein Neuladen auf `/callback` und beim ersten Laden
- `registration.update()` beim Vordergrundwechsel gedrosselt (Log oder Netzwerkmitschnitt)
- Verifikation gemäß Projekt-CLAUDE.md (Frontend)

## Nacharbeit (2026-11-15, nach Prüfung)

Ausgangsstand: `cca25c0`. Befunde aus der Abnahme; N2 korrigiert eine Vorgabe dieses Auftrags (Auslöser `hidden`).

- **N1 Navigationsfehler:** `router.afterEach((to, from, failure) => …)` ignoriert abgebrochene, gecancelte und doppelte Navigationen (`failure` gesetzt). `firstNavigation` erst nach einer **erfolgreichen** Navigation zurücksetzen. Hintergrund: `App.vue` cancelt beim Kaltstart die Initialnavigation per `router.replace(savedPath)`; `requireAuth` bricht mit `false` ab und leitet zum IdP.
- **N2 Kein Neuladen bei `hidden`:** Das Öffnen von Kamera oder Fotoauswahl (`<input type=file>`) setzt die Seite auf Mobilgeräten auf `hidden` (Android bekannt, iOS unbestätigt); ein Neuladen dort verwirft Auswahl und Import-Zustand. Stattdessen:
  - bei `hidden` nur den Zeitpunkt merken;
  - bei `visible`: war die App mindestens 10 min im Hintergrund, ein Update bereit und `pendingWrites === 0`, sofort aktivieren; sonst wie bisher gedrosselt `registration.update()`.
  - Aktivierung bei erfolgreicher Navigation bleibt.
  - Damit entfällt auch das Neuladen im Hintergrund mitten in einer Request-Kette (z. B. `setRecipePicture`: DELETE, dann POST).
- **N3 Andere Tabs:** `onNeedReload` in `registerSW` setzen, damit ein Tab, dessen Controller ein anderer Tab gewechselt hat, nicht sofort neu lädt, sondern wie in N1/N2 erst bei erfolgreicher Navigation oder bei Rückkehr nach langer Pause. Verhalten von `register.js` (vite-plugin-pwa) im Quellcode prüfen und im Bericht mit Stelle nennen.
- **Rule** `.claude/rules/frontend.md` an das geänderte Verhalten anpassen.

### Abnahme Nacharbeit
- Browserszenarien aus dem Bericht erneut, angepasst an N2 (statt „Hintergrund lädt“: „Rückkehr nach ≥ 10 min lädt“, Zeit simuliert)
- Kaltstart mit gespeicherter Route (gecancelte Initialnavigation) und wartendem Update: kein Neuladen
- Kurze `hidden`/`visible`-Folge (< 10 min) mit wartendem Update: kein Neuladen
- Zwei Tabs: Aktivierung in Tab A, Tab B lädt erst bei Navigation bzw. Rückkehr nach langer Pause
- Bericht um Abschnitt „Nacharbeit“ fortschreiben; Verifikation gemäß Projekt-CLAUDE.md (Frontend)
