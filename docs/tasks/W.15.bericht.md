# Bericht W.15: Frontend-Majors anheben

> Branch `worktree-W.15-frontend-majors` · Basis `9233908` · Stand `2e7dd85` · 2026-11-17 · Dauer: 00:47 – 01:39 (52 min, davon Warten an Checkpoints 3 min) · Status: fertig

## Ergebnis
Alle acht Pakete stehen auf der Version, die `npm view` am 2026-11-17 geliefert hat: lint-staged 17.6.1, eslint 10.15.0 (jetzt direkt), js-yaml 5.5.0, @vueuse/core 15.0.0, pinia 4.1.0, vite-plugin-pwa 2.0.0, bootstrap-vue-next 1.2.4 und TypeScript 6.0.3. Je Major gibt es einen grünen Commit. Beide Overrides sind entfernt, `npm ci` läuft ohne Peer-Warnungen.

Zwei Brüche in bootstrap-vue-next fallen weder dem Typecheck noch den Tests auf und sind behoben:
- **Toasts erschienen nicht mehr.** Der Wrapper in `useToast.ts` ist angepasst und hat jetzt eine Spec.
- **Der Schalter „Nur lesen“ ließ sich nicht mehr abschalten.** Grund: `BFormCheckbox` liefert abgewählt `undefined` statt `false`. Gelöst mit `:unchecked-value="false"`.

Die Sichtprüfung im Browser ist bis auf die Versionszeile pixelgleich zur Baseline.

## Commits
- `bcba97a` build(frontend): lint-staged auf 17 anheben
- `3b0d310` build(frontend): eslint als direkte devDependency aufnehmen
- `6a42f93` build(frontend): js-yaml auf 5 anheben
- `c7ca2e6` build(frontend): @vueuse/core auf 15 anheben
- `1809661` build(frontend): pinia auf 4 anheben
- `1f3504c` build(frontend): vite-plugin-pwa auf 2 anheben, Overrides entfernen
- `f3f4e88` build(frontend): bootstrap-vue-next auf 1.2 anheben
- `dcbe72c` build(frontend): TypeScript auf 6.0 anheben, target/lib ES2022
- `5744655` docs(plan): Stand nach W.15 Frontend-Majors nachtragen
- `2e7dd85` docs(frontend): Fallen von bootstrap-vue-next 1.x in die Regeln

## Verifikation
**Pro Commit:** `npm run lint:check && npm run typecheck && npm test && npm run build`, jedes Mal grün.

**Schlussverifikation:**
- lint ok
- typecheck ok, keine Veraltet-Warnungen von TS 6 und keine Versionswarnung von typescript-eslint
- Tests: 27 Dateien, 247 Tests grün. Vorher waren es 246; dazu kam `useToast.spec.ts`.
- Build: 59 Precache-Einträge, 1215 KiB. Vorher 57 Einträge, 1247 KiB.

**Tests:** Am Inhalt bestehender Tests habe ich nichts geändert. Neu ist `composables/useToast.spec.ts` mit echtem `BApp`. Die Spec prüft, dass der Toast sichtbar erscheint und nach 5 s aus dem DOM entfernt ist. Ich habe zwei Mutanten dagegen laufen lassen, ohne `modelValue` und ohne `destroy()`; beide werden rot.

**`npm ci`:**
- Keine Peer-Warnungen.
- Übrig bleibt die Deprecation-Meldung zu `glob@11.1.0`. Sie kommt aus `workbox-build` 7.4.1, ist also Upstream.
- `npm audit` meldet 13 × moderate (glob/minimatch über workbox-build). Das ist unverändert gegenüber vorher.

**`sw.js` vorher/nachher:**
- Bis auf Revisionen und Asset-Hashes gleich.
- `workbox-*.js` ist byte-identisch.
- Das Client-Modul `register.js` von vite-plugin-pwa ist in 1.3.0 und 2.0.0 byte-identisch.
- `workbox-window` steht beidseits auf 7.4.1.

**Container:**
- Frontend-Image gebaut (`docker build`) und mit `--add-host backend:127.0.0.1` auf Port 18080 gestartet.
- `/`, `/sw.js` und `/config.js` antworten mit 200; `config.js` ist per envsubst befüllt. Der SPA-Fallback greift.
- Danach Container und Image entfernt.
- `docker compose … up` habe ich bewusst nicht ausgeführt. Der lokal laufende Stack nutzt feste Containernamen `my-cookbook-*` und wäre ersetzt worden. Das Backend ist unverändert.

**Sichtprüfung:**
- Aufbau: Baseline-Build (`5cb0f92`, per `git archive`) und neuer Build liefen jeweils gegen denselben Node-Server mit Mock-IdP und Mock-API, in Edge headless über `playwright-core`. Die Sitzung war per localStorage gesetzt.
- Beide Builds 12/12, ohne Browserfehler:
  - Galerie
  - Profil: Schalter „Nur lesen“ aus → `PUT /me/settings` mit `read_only:false`, Toast erscheint und ist nach 5 s weg
  - Rezeptansicht
  - Bearbeitung: Vorschau-Modal auf und zu, Speichern → PUT und Toast
  - Import-Dialog: Tabs. Der gewählte Tab bleibt nach Schließen und erneutem Öffnen erhalten, der Inhalt wird also nicht abgebaut.
  - Verwaltung
- Pixelvergleich der 11 Screenshots: identisch bis auf die Versionszeile und 4 px im Fortschrittsbalken des Toasts.

**Service Worker im Browser:**
- In beiden Ständen gleich: Das Update wartet (`registerType: prompt`), es gibt kein sofortiges Neuladen.
- Die Aktivierung bei Navigation konnte ich in diesem Aufbau nicht auslösen, und zwar **auch nicht mit der Baseline**. Die Ursache liegt im Testaufbau, nicht in W.15. Ich habe nicht weiter danach gesucht.
- Gleiches Verhalten belegen der byte-identische Client-Code (oben), `swUpdate.spec.ts` und die Prüfung aus W.22.

**Prüfzeit:**
- Gemessen: lint 80 s, typecheck 7 s, Tests 31 s, Build 51 s, Image-Build 85 s.
- Größter Posten war die Sichtprüfung: Baseline- und Doppel-Build, je Lauf etwa 1 min, mehrere Durchläufe.

**Prüfskripte**, nur im Scratchpad `C:\Users\ce\AppData\Local\Temp\claude\beb48852c7fd70f3\07cc7c95-93a5-47b3-935f-ae1c0a11d4bd\scratchpad\`:
- `e2e.mjs` und `imgcmp.mjs` für Sichtprüfung und Pixelvergleich
- `yamlcmp.mjs` für js-yaml 4 gegen 5
- `swcmp.sh` für den sw.js-Vergleich
- `playwright-core` wie in W.23 aus dem Scratchpad von W.25

## Struktur und Doku
- Neu ist `src/composables/useToast.spec.ts`. Gewachsene Dateien oder Duplikate gibt es keine.
- `.claude/rules/frontend.md`: Der Override-Hinweis bei `npm ci` ist korrigiert. Neu ist ein Punkt zu den Fallen von bootstrap-vue-next 1.x: Toast, Checkbox, `no-footer`.

## Mitgenommen
- nichts

## Abweichungen vom Auftrag
- **Neue direkte Abhängigkeit `@vue/devtools-api` ^8.2.1.** pinia 4 verlangt sie als Pflicht-Peer. Freigegeben am Checkpoint.
- **`vue`-Bereich von ^3.4.15 auf ^3.5.13 angehoben**, weil bootstrap-vue-next das als Peer verlangt. Installiert bleibt 3.5.45.
- **`@vueuse/core` liegt dreifach im Baum:** 15.0.0 für die App, 14.2.1 für bootstrap-vue-next (gepinnt `~14.2.1`), 14.4.0 für reka-ui. Das ist am Checkpoint als Dublette akzeptiert. `npm dedupe` löst es nicht auf.
- **Sichtprüfung des SW-Updates nur teilweise**, siehe Verifikation.

## Nachgetragen in Specs/Plänen
- `docs/plans/abhaengigkeiten.md`:
  - Stand nach W.15 mit den gesetzten Versionen und Anpassungen
  - abweichende Lock-Stände vorher
  - Ausnahme TS 7 mit Stand (latest 7.0.2) und Bedingung: Die Peers von typescript-eslint **und** vue-tsc schließen 7.x ein
  - Lieferkette: `@trickfilm400/rollup-plugin-off-main-thread` ist seit 2026-10-06 als 4.0.0 stabil. workbox-build 7.4.1 ist aber weiter die neueste Version und löst `^3.0.0-pre1` auf 3.0.0-pre1 auf.

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- **BModal `hide-footer` → `no-footer`** (XS):
  - Die Prop existiert in bootstrap-vue-next nicht, weder in 0.44 noch in 1.x. Vorschau in `Edit.vue` und AI-Import in `HomeView.vue` zeigen deshalb eine Standard-Fußzeile.
  - Im Browser bestätigt: eine `.modal-footer` je Modal, alt wie neu.
  - Behebung ist eine sichtbare Änderung; laut Entscheidung am Checkpoint als Folgepunkt.
- **`views/Settings.vue` ist toter Code** (XS): Die Route `/settings` rendert `ProfileView.vue`, `Settings.vue` wird nirgends importiert. Entfernen.
- **`manifest.webmanifest` kommt mit `application/octet-stream`** (XS):
  - Gilt im nginx-Image und im laufenden Stack, war also schon vorher so.
  - Lösung: Typ `application/manifest+json` in `.docker/nginx/prod.conf` ergänzen.
- **`@vueuse/core`-Dublette:** prüfen, sobald bootstrap-vue-next auf vueuse 15 zieht. Kein eigener Punkt nötig, steht im Plan.
- **TS 7:** eigener Auftrag, sobald typescript-eslint und vue-tsc es unterstützen.

## Status je Roadmap-Punkt
- `W.15` fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.15 Frontend-Majors anheben · 2026-11-17 · 2e7dd85`
