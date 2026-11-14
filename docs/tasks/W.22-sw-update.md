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
