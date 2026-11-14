# Plan: Abhängigkeiten

Stand: 2026-11-14 · Roadmap: W.14, W.15, W.16 (Backend: W.4)

Versionen per `npm view` bzw. PyPI am 2026-11-14 ermittelt.

## W.15 Frontend-Majors

| Paket | Lock → aktuell | Hinweis |
|---|---|---|
| `bootstrap-vue-next` | 0.44.1 → 1.2.4 | erste stabile Major-Version; Breaking Changes aus dem Changelog prüfen (u. a. `BModal`, `BTabs`) |
| `vite-plugin-pwa` | 1.2.0 → 2.0.0 | 1.2 erlaubt als Peer nur Vite ≤ 7, 2.0 auch Vite 8. Danach `overrides.vite-plugin-pwa` in `package.json` und `--legacy-peer-deps` im Dockerfile entfernen (berührt W.7) |
| `pinia` | 3.0.4 → 4.1.0 | Changelog |
| `@vueuse/core` | 14.2.1 → 15.0.0 | Changelog |
| `js-yaml` | 4.1.1 → 5.5.0 | API-Änderungen prüfen (`load`/`dump`) |
| `lint-staged` | 16.4.0 → 17.6.0 | dev |
| `eslint` | nur als Peer im Lock | als direkte devDependency aufnehmen (`lint` und `lint-staged` rufen es direkt auf) |
| `typescript` | 5.9.3 → 6.0.3 | Brücke zu TS 7: Bereich `~6.0.3`, weil `typescript-eslint` `<6.1.0` verlangt. Veraltet-Warnungen von TS 6 beheben. **Ausnahme TS 7** (latest 7.0.2): erst, wenn `vue-tsc` **und** `typescript-eslint` es unterstützen (erwartet ab 7.1, unbestätigt). `tsconfig.json` nutzt keine in TS 6 veralteten Optionen (Stand 2026-11-14) |

Je Major einen eigenen Commit, nach jedem `lint:check`, `typecheck`, `build`.

## W.16 Verzichtbare Abhängigkeiten

| Paket/Code | Nutzung | Ersatz |
|---|---|---|
| `deep-equal`, `@types/deep-equal` | `ProfileView.vue`, `Settings.vue`: Vergleich flacher Settings | eigene Hilfsfunktion; entfernt 58 transitive Pakete |
| `sass` | nur `RecipeGrid.vue`: Mixin `fluid-aspect` (Padding-Hack) | CSS `aspect-ratio: 3 / 2`; `preprocessorOptions.scss` in `vite.config.js` entfernen |
| `deepCopyYaml` (`js/deepCopy.ts`, 11 Aufrufe nach W.11) | Deep Copy per YAML-Dump/-Load | `deepCopyJSON`. Nicht `structuredClone(toRaw(x))`: `toRaw` entfernt nur die oberste Proxy-Ebene, verschachtelte Proxies lösen `DataCloneError` aus; JSON liest durch Proxies hindurch, die Daten sind JSON-sicher |
| `@vueuse/integrations` | kein direkter Import; optionaler Peer von bootstrap-vue-next | entfernen: bootstrap-vue-next 0.44 bündelt `useFocusTrap` im `dist`, nur `.d.ts` referenziert das Paket (`skipLibCheck` aktiv), geprüft 2026-11-14 |
| Cache-Regel `fonts.googleapis.com` in `vite.config.js` | Google Fonts werden nicht verwendet | löschen |

Bleiben: `idb-keyval`, `oidc-client-ts`, `sortablejs`, `js-yaml` (YAML-Import/-Export), `bootstrap`, `bootstrap-icons`, `workbox-window` (Peer von vite-plugin-pwa).

## Backend (gehört zu W.4)

`requirements.txt` hat nur Untergrenzen, jeder Build zieht die neuesten Versionen:

| Paket | Untergrenze | aktuell |
|---|---|---|
| `openai` | 2.29 | 3.51.0 |
| `Pillow` | 12.1 | 13.0.0 |
| `cryptography` | 46.0 | 50.0.2 |
| `sqlalchemy` | 2.0 | 2.1.8 |
| `fastapi` | 0.135 | 0.162.7 |

`PyYAML` wurde nur von den Migrationsskripten genutzt; diese sind mit W.8 entfernt, das Paket entfällt mit W.18.

Entscheidung (2026-11-14): Lock-Basis ist die neueste Version je bisheriger Major-Linie (z. B. `openai<3`, `Pillow<13`, `sqlalchemy<2.1`); die Live-Versionen aus dem Container werden nicht erhoben. Danach je Major ein eigener Commit mit Smoke-Test.

Stand nach W.4 (2026-11-14): `requirements.txt` ist durch `pyproject.toml` + `uv.lock` ersetzt. Alle vier Majors sind gehoben, `ai.py` blieb für openai 3 unverändert. Lock: fastapi 0.162.7, uvicorn 0.54.0, sqlalchemy 2.1.8, asyncpg 0.32.0, alembic 1.20.1, pyjwt 2.15.1, cryptography 50.0.2, pydantic 2.14.3, pydantic-settings 2.16.3, Pillow 13.0.0, openai 3.51.0, PyYAML 6.0.3, python-multipart 0.0.33, httpx 0.28.1; dev: pytest 9.2.0, ruff 0.17.5; uv 0.13.8 im Image.

## Beobachtung Lieferkette (2026-11-14, aus W.14)
`workbox-build` 7.4.1 (Peer von `vite-plugin-pwa`) ersetzt `@surma/rollup-plugin-off-main-thread` durch das Vorab-Release `@trickfilm400/rollup-plugin-off-main-thread@^3.0.0-pre1` (Einzel-Maintainer, wenig verbreitet). Die Abhängigkeit steht im offiziellen Manifest der Workbox-Maintainer, ist also eine Upstream-Entscheidung. Bei W.15 erneut prüfen, ob eine stabile Version vorliegt.
