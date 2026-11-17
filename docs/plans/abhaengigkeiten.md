# Plan: Abhängigkeiten

Stand: 2026-11-14 · Roadmap: W.14, W.15, W.16 (Backend: W.4)

Versionen per `npm view` bzw. PyPI am 2026-11-14 ermittelt.

## W.15 Frontend-Majors

| Paket | Lock → aktuell | Hinweis |
|---|---|---|
| `bootstrap-vue-next` | 0.44.1 → 1.2.4 | erste stabile Major-Version; Breaking Changes aus dem Changelog prüfen (u. a. `BModal`, `BTabs`) |
| `vite-plugin-pwa` | 1.2.0 → 2.0.0 | 1.2 erlaubt als Peer nur Vite ≤ 7, 2.0 auch Vite 8. Danach `overrides.vite-plugin-pwa` in `package.json` entfernen. `--legacy-peer-deps` im Dockerfile ist schon durch den Override überflüssig (geprüft 2026-11-15: `npm ci` ohne Flag in `node:26-alpine` fehlerfrei) und entfällt mit W.5 |
| `pinia` | 3.0.4 → 4.1.0 | Changelog |
| `@vueuse/core` | 14.2.1 → 15.0.0 | Changelog |
| `js-yaml` | 4.1.1 → 5.5.0 | API-Änderungen prüfen (`load`/`dump`) |
| `lint-staged` | 16.4.0 → 17.6.0 | dev |
| `eslint` | nur als Peer im Lock | als direkte devDependency aufnehmen (`lint` und `lint-staged` rufen es direkt auf) |
| `typescript` | 5.9.3 → 6.0.3 | Brücke zu TS 7: Bereich `~6.0.3`, weil `typescript-eslint` `<6.1.0` verlangt. Veraltet-Warnungen von TS 6 beheben. **Ausnahme TS 7** (latest 7.0.2): erst, wenn `vue-tsc` **und** `typescript-eslint` es unterstützen (erwartet ab 7.1, unbestätigt). `tsconfig.json` nutzt keine in TS 6 veralteten Optionen (Stand 2026-11-14) |

Je Major einen eigenen Commit, nach jedem `lint:check`, `typecheck`, `build`.

Stand nach W.15 (2026-11-17, Versionen per `npm view` am selben Tag): umgesetzt. Der Lock stand vorher auf vite-plugin-pwa 1.3.0, js-yaml 4.3.2, @vueuse/core 14.4.0 und bootstrap-vue-next 0.44.7, nicht auf den Werten der Tabelle.

| Paket | gesetzt | Anpassung |
|---|---|---|
| `lint-staged` | 17.6.1 | keine (Node ≥ 22.22.1) |
| `eslint` | 10.15.0, direkt | – |
| `js-yaml` | 5.5.0 | kein Default-Export mehr: `import * as`; `@types/js-yaml` entfällt (eigene Typen). Load-Default CORE_SCHEMA (YAML 1.2, Datumswerte bleiben Strings), Load/Dump der Beispielrezepte gegen 4.3.2 identisch |
| `@vueuse/core` | 15.0.0 | keine. bootstrap-vue-next 1.2.4 pinnt `~14.2.1`, reka-ui `^14.1.0`: zwei weitere 14.x-Kopien im Baum (14.2.1, 14.4.0), `npm dedupe` löst das nicht. Fällt weg, wenn bootstrap-vue-next auf 15 zieht |
| `pinia` | 4.1.0 | keine; `@vue/devtools-api` ^8.2.1 ist Pflicht-Peer und als dependency aufgenommen (Freigabe 2026-11-17), `nostics` kommt transitiv (stand schon über vue-router im Baum) |
| `vite-plugin-pwa` | 2.0.0 | `workbox-window` ^7.4.1. Beide Overrides entfernt: `vite-plugin-pwa.vite` (2.0 erlaubt Vite 8), `serialize-javascript` (`@rollup/plugin-terser` 1.x verlangt selbst ^7.0.3). `sw.js` bis auf Revisionen gleich, Workbox-Runtime und Client-Modul `register` byte-identisch |
| `bootstrap-vue-next` | 1.2.4 | `useToast.create()` zeigt ohne `modelValue` nichts an und kennt `pos`/`props` nicht mehr: Wrapper `composables/useToast.ts` angepasst (Spec). `BFormCheckbox` `uncheckedValue` Default `undefined` statt `false`: `:unchecked-value="false"` an allen Stellen. `vue` auf ^3.5.13 (Peer) |
| `typescript` | ~6.0.3 | keine Veraltet-Warnungen; `target`/`lib` ES2022, `DOM.Iterable` entfällt (in TS 6 Teil von `DOM`) |

**Ausnahme TS 7** (Stand 2026-11-17: latest 7.0.2, beta 7.1.0-beta): bleibt aus, solange `typescript-eslint` (8.73.0: Peer `>=4.8.4 <6.1.0`) und `vue-tsc` (3.3.14) es nicht ausdrücklich unterstützen. Bedingung zum Anheben: beide Peers schließen 7.x ein, dann eigener Auftrag.

**Override-Regel:** keine Overrides mehr in `package.json`; `npm ci` ohne Peer-Warnungen. Verbleibende Meldung: `glob@11.1.0` deprecated über `workbox-build` 7.4.1 (Upstream), `npm audit` 13 × moderate in derselben Kette (glob/minimatch), unverändert gegenüber vorher.

## W.16 Verzichtbare Abhängigkeiten

| Paket/Code | Nutzung | Ersatz |
|---|---|---|
| `deep-equal`, `@types/deep-equal` | `ProfileView.vue`, `Settings.vue`: Vergleich flacher Settings | eigene Hilfsfunktion (die frühere Angabe „58 transitive Pakete“ war falsch) |
| `sass` | nur `RecipeGrid.vue`: Mixin `fluid-aspect` (Padding-Hack) | CSS `aspect-ratio: 3 / 2`; `preprocessorOptions.scss` in `vite.config.js` entfernen |
| `deepCopyYaml` (`js/deepCopy.ts`, 11 Aufrufe nach W.11) | Deep Copy per YAML-Dump/-Load | `deepCopyJSON`. Nicht `structuredClone(toRaw(x))`: `toRaw` entfernt nur die oberste Proxy-Ebene, verschachtelte Proxies lösen `DataCloneError` aus; JSON liest durch Proxies hindurch, die Daten sind JSON-sicher |
| `@vueuse/integrations` | kein direkter Import; optionaler Peer von bootstrap-vue-next | entfernen: bootstrap-vue-next 0.44 bündelt `useFocusTrap` im `dist`, nur `.d.ts` referenziert das Paket (`skipLibCheck` aktiv), geprüft 2026-11-14 |
| Cache-Regel `fonts.googleapis.com` in `vite.config.js` | Google Fonts werden nicht verwendet | löschen |

Bleiben: `idb-keyval`, `oidc-client-ts`, `sortablejs`, `js-yaml` (YAML-Import/-Export), `bootstrap`, `bootstrap-icons`, `workbox-window` (Peer von vite-plugin-pwa).

Stand nach W.16 (2026-11-14): umgesetzt. `isEqualPlain` (`js/isEqualPlain.ts`), `deepCopyJSON` statt `deepCopyYaml`, CSS `aspect-ratio`; alle vier Pakete entfernt, im Lock 22 Einträge weniger (u. a. `sass` mit `@parcel/watcher` und 12 Plattform-Varianten).

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

Stand 2026-11-17 (W.15): `@trickfilm400/rollup-plugin-off-main-thread` 4.0.0 ist seit 2026-10-06 stabil, `workbox-build` 7.4.1 ist aber weiter die neueste Version und verlangt `^3.0.0-pre1`; aufgelöst wird 3.0.0-pre1. Erneut prüfen, wenn `workbox-build` ein neues Release hat.
