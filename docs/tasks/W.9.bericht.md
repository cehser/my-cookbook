# Bericht W.9: Images in der CI bauen und nach ghcr.io pushen, Deploy per Pull

> Branch `worktree-W.9-ghcr-images` · Basis `df7b1e4` · Stand siehe letzter Commit des Branches · 2026-11-16 · Dauer: 18:24 – 18:40, 18:43 – 18:45, Nacharbeit 23:10 – 23:18 (26 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Nach jedem grünen Push auf `main` baut der neue CI-Job `publish` beide Images (`linux/amd64`, `COMMIT_HASH` = kurzer SHA, OCI-Labels `source`/`revision`) und pusht sie als `ghcr.io/<owner kleingeschrieben>/my-cookbook-{frontend,backend}` mit den Tags `<sha7>` und `main`. `docker-compose.yml.example` zieht die Images per `image:` mit `${IMAGE_TAG:-main}`; lokales Bauen geht über den Override `docker-compose.build.yml`. `scripts/deploy.sh` ist entfernt, README beschreibt Deploy, Update, Rollback, lokales Bauen und den Umstieg des Servers.

## Commits
- `f3a71b3` ci(ci): Images auf main nach ghcr.io pushen
- `89e7853` build(deploy): Images aus ghcr.io ziehen, deploy.sh entfällt
- `995d4df` docs(deploy): Deploy per Pull, Rollback und Umstieg beschreiben
- `9fba9e9` docs(deploy): Bericht W.9
- `19264ea` build(frontend): .env und .env.production aus dem Build-Kontext
- `f373056` build(backend): .dockerignore anlegen
- `e8d44b6` docs(deploy): Bericht W.9 um Mitnahmen ergänzen
- Nacharbeit: siehe Abschnitt „Nacharbeit“

## Verifikation
- Workflow per PyYAML (Backend-uv-Umgebung) geparst, ebenso beide Compose-Dateien → gültig. Ausgewertet:
  - `on`: `push` (nur `main`) und `pull_request`; global `permissions: contents: read`.
  - `images`: `if: github.event_name != 'push'` → läuft bei PRs, baut ohne Push; auf `main` entfällt er, weil `publish` baut (kein Doppelbau, ohne Artefakt-Actions).
  - `publish`: `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `needs: [frontend, backend, backend-db]`, `permissions: contents: read, packages: write` nur hier. Ablauf: beide Builds → Login (`GITHUB_TOKEN` per `--password-stdin`) → Push aller SHA-Tags → Push der `main`-Tags → Logout (`if: always()`). Scheitert ein Build, wird nichts gepusht.
  - ~~`concurrency` mit `cancel-in-progress`: Ein neuerer Lauf bricht den älteren ab …~~ Überholt durch Nacharbeit N1/N2 (Abbruch konnte ein gemischtes `:main`-Paar hinterlassen; Re-run war nicht abgedeckt).
  - Owner-Kleinschreibung (`${GITHUB_REPOSITORY_OWNER,,}`) und `${GITHUB_SHA::7}` in Bash nachgerechnet: `CEhser`/`0123456789abcdef` → `ghcr.io/cehser/my-cookbook`, `0123456`.
- Lokal nachgestellt (Skript wie CI-Schritt, nativ arm64 statt amd64): beide Images mit Tags `995d4df` und `main` gebaut (~1:30 min). Scratch-Kopie von `docker-compose.yml.example` (nur `container_name` entfernt und Port 18080, damit der laufende Stack des Masters unberührt bleibt), Dummy-`.env` mit `IMAGE_TAG=995d4df`, `docker compose up -d` ohne `build` → Container laufen auf `ghcr.io/cehser/my-cookbook-*:995d4df`, Migrationen 001–007 im Log, `GET /api/health` → `{"status":"ok","database":"connected"}`, `/config.js` mit den Laufzeitwerten aus der `.env`, `995d4df` im Chunk `ProfileView-*.js` („Version: …“).
- Override: `COMMIT_HASH=ovr1234 docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build` → Images `my-cookbook-*:local`, Hash `ovr1234` im Bundle, `/api/health` ok, gezogene `ghcr.io`-Tags unverändert (gleiche IDs). Danach `up -d` ohne Override → zurück auf die ghcr-Tags. Teststack, Volumes und Test-Images danach entfernt.
- Geheimnisse/Instanzwerte in den Images:
  - Backend: `/app` enthält nur `.python-version`, `.venv`, `alembic`, `alembic.ini`, `app`, `prompts`, `pyproject.toml`, `uv.lock`; keine `.env*`. Image-`Env` nur Python/uv-Variablen.
  - Frontend: keine `.env*` im Image; `config.js` im Image ist der leere Platzhalter, OIDC kommt erst beim Start; `import.meta.env.VITE_OIDC_*` sind im Bundle zu `void 0` aufgelöst; kein `realms/`, kein `sk-…`. `COMMIT_HASH` steht nur in der Build-Stage, nicht im Laufzeit-`Env`.
  - In der CI baut der Checkout nur versionierte Dateien; versioniert ist in `frontend/` nur `.env.example`, das Vite nicht lädt.
- Frontend: `npm run lint:check && npm run typecheck && npm test && npm run build` → grün, 23 Testdateien / 201 Tests.
- Backend: `uv sync --frozen && uv run ruff check && uv run ruff format --check && uv run pytest -q` → grün, 128 passed, 8 skipped (DB-Tests ohne `DB_HOST`).
- Mitnahme `.dockerignore`: Wegwerf-`frontend/.env` und `.env.production` mit Markerwert angelegt, Frontend gebaut → Build vollständig aus dem Cache (Dateien nicht im Kontext), kein Marker im Bundle; Dateien danach gelöscht. Backend-Image mit neuer `.dockerignore` gebaut, `/app` unverändert.
- Sichtprüfung: keine (Hash per Bundle-Inhalt geprüft, nicht im Browser).
- Prüfzeit: ~6 min; größter Posten: zwei Image-Builds (je ~1:30 min) und Frontend-Verifikation (2:25 min).
- Prüfskripte: nur Scratchpad.
- Nicht geprüft: echter CI-Lauf, Push nach ghcr.io, `--platform linux/amd64` (lokal arm64).

## Struktur und Doku
- Gewachsene Dateien, neue Module, bewusste Duplikate: neu `docker-compose.build.yml` (19 Zeilen) und `backend/.dockerignore`; `ci.yml` +46 Zeilen.
- Berührte Aussagen: nachgetragen in `CLAUDE.md` (Befehle Betrieb, Verifikation „Container bauen“, CI-Beschreibung), `.claude/rules/frontend.md` (`__COMMIT_HASH__`), `README.md` (Starten, Update, Rollback, lokal bauen, Verzeichnisbaum, Tech-Stack, Upgrade-Hinweise). Keine Verweise auf `deploy.sh` mehr außer in `ROADMAP.md` und historischen Aufträgen/Berichten.

## Mitgenommen
- `19264ea` `frontend/.dockerignore` schließt `.env` und `.env.production` aus · XS (nach Rückfrage, Datei nicht in der Ablage)
- `f373056` `backend/.dockerignore` neu (`.venv`, Caches, `tests/`, `.env*`) · XS (dito)

## Abweichungen vom Auftrag
- `publish` hat kein `needs` auf `images`, sondern baut selbst; `images` läuft nur noch außerhalb von Push. So entfällt der Doppelbau auf `main` ohne zusätzliche Actions (Weitergabe der Images zwischen Jobs bräuchte `actions/upload-artifact`). Der Build bleibt Voraussetzung für den Push, weil beide Builds vor dem ersten Push im selben Job laufen.
- Lokaler Nachbau nativ arm64 statt `linux/amd64` (Entwicklungsrechner ist arm64, Emulation langsam).
- Backend bekommt in der CI das Build-Arg `COMMIT_HASH` mit, das sein Dockerfile nicht nutzt → nur eine Warnung im Build-Log, bewusst für eine einfache Schleife.

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- ~~README-Pfad zur Sichtbarkeit unbestätigt~~ In der Nacharbeit gegen die GitHub-Doku geprüft, stimmt.
- Nach dem Merge (Master): erster CI-Lauf auf `main` pusht beide Images, Pakete öffentlich stellen, Server nach README umstellen.

## Nacharbeit (2026-11-16, N1–N3)

Ausgangsstand `e8d44b6`, vorher `git merge main` → `5d4de58` (konfliktfrei).

### Commits
- `5d4de58` Merge branch 'main' into worktree-W.9-ghcr-images
- `1122850` ci(ci): Läufe auf main nicht abbrechen, :main nur vom Kopf
- `2578a47` docs(deploy): README-Nacharbeit zu lokalem Bauen, Sichtbarkeit, PG-Major
- (dieser Nachtrag) docs(deploy): Bericht W.9 um Nacharbeit ergänzen

### N1 Kein Abbruch auf `main`
- `concurrency.cancel-in-progress: ${{ github.event_name == 'pull_request' }}`, Gruppe unverändert `ci-${{ github.ref }}`.
- Verhalten laut GitHub-Doku (Concurrency, geprüft): Ausdrücke sind erlaubt; ohne Abbruch wartet ein neuer Lauf, solange einer derselben Gruppe läuft. Mit dem Standard `queue: single` wird ein bereits wartender älterer Lauf vom neueren ersetzt.
- Folge auf `main`: Ein laufendes `publish` läuft immer zu Ende, kein gemischtes `:main`-Paar durch Abbruch mehr. Bei schnellen Pushes A, B, C läuft A zu Ende, B wird von C ersetzt, C baut den neuesten Stand; B bekommt keine SHA-Tags (vertretbar, B ist in C enthalten). PRs brechen weiter ab (eigene Gruppe je `refs/pull/<n>/merge`).
- Restrisiko: Scheitert der Push des zweiten `:main`-Tags selbst (Netz, Registry), bleibt das Paar gemischt, bis der nächste Lauf durchläuft. Ohne Registry-seitige Atomarität nicht vermeidbar; der Server-Pull holt dann ein inkonsistentes Paar. Abhilfe dann Rollback per `IMAGE_TAG=<sha>` (SHA-Tags sind vollständig, weil sie vor `:main` gepusht werden).

### N2 `:main` nur vom aktuellen Stand
- Im Schritt „Images pushen“: erst beide SHA-Tags, dann `gh api repos/${GITHUB_REPOSITORY}/git/ref/heads/main --jq .object.sha` mit `GH_TOKEN: ${{ github.token }}` (`contents: read` genügt, funktioniert auch bei privatem Repo; `git ls-remote` bräuchte wegen `persist-credentials: false` eigene Authentifizierung). Weicht der Kopf von `GITHUB_SHA` ab: `::warning::`, nur SHA-Tags, Schritt erfolgreich. Scheitert die Abfrage: Schritt schlägt fehl (`bash -e`), `:main` bleibt unverändert, SHA-Tags sind schon da.
- `gh` ist auf GitHub-gehosteten Runnern vorinstalliert, keine neue Action.
- Re-run eines älteren Laufs: Kopf ≠ `GITHUB_SHA` → `:main` bleibt. Re-run des aktuellen Kopfs: pusht `:main` erneut (gleicher Inhalt).
- Parallel: Durch N1 kann zwischen Prüfung und Push kein anderer `publish` auf `main` laufen; rückt `main` in diesem Fenster vor, wartet der neue Lauf und setzt `:main` danach selbst.
- Antwortformat der API (`object.sha`) an einem öffentlichen Fremd-Repo geprüft.
- Lokal nachgestellt: `run`-Block per PyYAML aus `ci.yml` extrahiert und mit `bash --noprofile --norc -eo pipefail` (wie der Runner) und Stubs für `docker`/`gh` ausgeführt:
  - aktueller SHA → 2 SHA-Pushes, 2 `:main`-Pushes, Exit 0
  - veralteter SHA → 2 SHA-Pushes, Warnung „main steht auf 2222222, dieser Lauf baut 1111111 …“, Exit 0
  - API-Fehler (401) → 2 SHA-Pushes, kein `:main`, Exit 1

### N3 README
- Befehl für lokales Bauen wieder mit `\` und Zeilenumbruch (war beim ersten Durchgang durch das Ersetzungsskript verloren gegangen).
- Öffentlichstellen: Bestätigung per Paketname und „nicht umkehrbar“ (GitHub-Doku: „Once you make a package public, you cannot make it private again“). Menüpfad gegen die Doku geprüft.
- PostgreSQL-Major verweist auf W.21; bis dahin Major in der Compose-Datei nicht ändern.

### Verifikation Nacharbeit
- YAML gültig (PyYAML), `concurrency` und Schritt-`env` ausgewertet (s. o.).
- Frontend: lint, typecheck, Tests (25 Dateien / 221 Tests), Build → grün (2:12 min).
- Backend: `uv sync --frozen`, ruff check/format, pytest → 133 passed, 12 skipped (0:11 min).
- Kein Container-Lauf: Nacharbeit ändert weder Abhängigkeiten noch Dockerfile noch Migrationen; Lockfiles seit `e8d44b6` unverändert.
- Prüfskripte: nur Scratchpad.

## Status je Roadmap-Punkt
- `W.9` fertig (Abnahme des echten CI-Laufs und des Server-Umstiegs nach dem Merge)

## Vorschlag Roadmap-Zeilen
`- [x] W.9 Images per GitHub Actions bauen und nach ghcr.io pushen, Deploy per Pull · 2026-11-16 · <sha des Merges>`
