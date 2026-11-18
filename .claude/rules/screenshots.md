---
paths:
  - frontend/scripts/shots/**
---

# Screenshot-Harness (`frontend/scripts/shots/`)

- **Zweck:** Screenshots für Berichte und Sichtprüfungen, wiederholbar. Kein Regressionstest, läuft nicht in CI, nicht Teil des Builds (Vite bündelt nur `src/`).
- **Aufruf** (aus `frontend/`): erst `npm run build` aus einem Pfad mit großem `C:` (sonst Pinia doppelt, siehe `frontend.md`), dann `npm run shots -- <szenario|all> [ausgabeordner]`; `npm run shots -- --list` zeigt die Szenarien. Ausgabeordner relativ zum Repo, Vorgabe `docs/plans/shots/`; für Berichte `docs/plans/<thema>/`. Dateinamen `<gerät>-<thema>-<szenario>.png` (`iphone-hell-…`, `iphone-dunkel-…`).
- **Browser:** `playwright-core` ohne Browser-Download (kein `npx playwright install`, nicht das Paket `playwright`). Genutzt wird ein installierter Browser per `channel` `msedge`, sonst `chrome`; anderer Pfad per `SHOTS_BROWSER=<exe>`.
- **Auswahl:** `SHOTS_DEVICES=iphone,desktop` (iPhone 390 × 844 bei Faktor 3, Desktop 1280 × 800), `SHOTS_THEMES=hell,dunkel`; sonst die Angaben des Szenarios (Vorgabe iPhone, hell und dunkel).
- **Aufbau:**
  - `run.ts`: Node-Server je Szenario auf `127.0.0.1:<frei>`: `dist/` statisch mit SPA-Fallback, eigene `/config.js` (OIDC-Authority `<origin>/oidc`, Client `shots`), Seed-Seite `/__shots/seed`, Mock-API unter `/api/v1`. Service Worker blockiert (`serviceWorkers: "block"`), sonst lieferte der SW alte Stände.
  - `mockApi.ts`: Vorgaben aus dem Seed (`/me`, `/me/settings`, Liste, Detail-GET, POST/PUT als Echo, DELETE 204, `/favorites`, `/tags`); Szenario überschreibt je Schlüssel `"<METHODE> <pfad>"` mit `:platzhalter`, z. B. `"GET /recipes/:id": { status: 503 }`. Unbekannte Endpunkte 404.
  - `seed.ts`: läuft per `page.evaluate` vor dem App-Start; leert localStorage und IndexedDB `keyval-store`, schreibt Sitzung (`oidc.user:<authority>:shots`, `expires_at` + 1 h, damit keine Erneuerung läuft), Rolle (`my-cookbook-role`), `pendingCreates` und freie IDB-Schlüssel. Ohne Importe (wird serialisiert).
  - `scenarios.ts`: Szenarien (Route, Seed, Antworten, Geräte, `waitForText`). Beispiele stellen die W.38-Bilder nach. Neues Szenario hier anhängen.
- **Node führt TypeScript direkt aus** (Type-Stripping, Node ≥ 22.18): nur löschbare Syntax (`erasableSyntaxOnly`), Importe mit `.ts`. Typecheck über `scripts/shots/tsconfig.json`, eingebunden in `npm run typecheck`; ESLint deckt den Ordner mit `eslint .` ab. `@types/node` kommt transitiv (nicht direkt deklariert).
