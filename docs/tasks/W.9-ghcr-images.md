# Auftrag W.9: Images in der CI bauen und nach ghcr.io pushen, Deploy per Pull

> Erstellt 2026-11-16 vom Master · Roadmap: `ROADMAP.md` Punkt W.9 · Basis: `main@3b1e5e2` · Aufwand: M · Modell: Opus

## Ziel
Nach jedem grünen CI-Lauf auf `main` liegen Frontend- und Backend-Image in `ghcr.io` (Tags: kurzer Commit-SHA und `main`). Der Server baut nicht mehr selbst, sondern zieht die Images: `docker compose pull && docker compose up -d`. Ein Rollback auf einen älteren Stand geht über `IMAGE_TAG=<sha>`. `scripts/deploy.sh` entfällt. Majors von PostgreSQL bleiben ein eigener Schritt (W.21).

## Erst lesen
1. `.github/workflows/ci.yml` – Jobs, `permissions`, `concurrency`, Job `images`; Actions sind per Commit-SHA gepinnt
2. `docker-compose.yml.example`, `scripts/deploy.sh`, `frontend/Dockerfile` (`COMMIT_HASH`), `backend/Dockerfile`
3. `README.md` – Abschnitte „Starten“, „Upgrade-Hinweise“, Verzeichnisbaum; `CLAUDE.md` (Befehle), `.claude/rules/frontend.md` (`__COMMIT_HASH__`)
4. `frontend/.docker/nginx/` – Laufzeitkonfiguration über `config.js.template` (Images sind instanzneutral)

## Auftrag
1. **CI:** Neuer Job (z. B. `publish`) nur bei `push` auf `main`, `needs` auf alle Prüf-Jobs inkl. DB-Tests und Image-Build. Rechte `packages: write` nur in diesem Job, global bleibt `contents: read`.
   - Login an `ghcr.io` mit `GITHUB_TOKEN`; Images `ghcr.io/<owner>/my-cookbook-frontend` und `…-backend` (Owner kleingeschrieben).
   - Tags: kurzer SHA (gleiche Länge wie `git rev-parse --short`, 7 Zeichen) und `main`. Frontend mit Build-Arg `COMMIT_HASH` = kurzer SHA.
   - Label `org.opencontainers.image.source` auf das Repo, damit das Paket mit dem Repo verknüpft ist.
   - Plattform `linux/amd64`.
   - Bei Pull Requests bleibt es beim Bauen ohne Push (heutiger Job `images`); doppeltes Bauen auf `main` vermeiden, wo es ohne Aufwand geht.
2. **Compose:** `docker-compose.yml.example` nutzt `image: ghcr.io/<owner>/my-cookbook-<dienst>:${IMAGE_TAG:-main}` für Frontend und Backend. Lokales Bauen aus dem Quellcode bleibt möglich (z. B. `docker-compose.build.yml` als Override mit `build:` und `COMMIT_HASH`); der Weg steht in der README.
3. **`scripts/deploy.sh` entfernen.** Deploy, Rollback und lokales Bauen in der README beschreiben; `CLAUDE.md` (Befehle, Verifikation „Container bauen“) und `.claude/rules/frontend.md` nachziehen.
4. **README, Upgrade-Hinweise:** Umstieg des Servers von Build auf Pull (Compose-Datei angleichen, erster `pull`, alte lokal gebaute Images aufräumen), einmalig das Paket auf öffentlich stellen (siehe Fallstricke), Rollback mit `IMAGE_TAG`. Hinweis: Majors von PostgreSQL gehen nicht per Pull (W.21).
5. **Workflow prüfen**, ohne ihn auszuführen: YAML parsen (z. B. mit Python `yaml` aus der uv-Umgebung des Backends) und die Bedingungen (`if`, `needs`, Rechte) im Bericht begründen. Lokal den Ablauf nachstellen: beide Images mit den Tags bauen, die Compose-Datei mit `IMAGE_TAG` auf diese lokalen Tags zeigen lassen, `docker compose up -d` ohne `build`, `GET /api/health`, Commit-Hash im Profil bzw. `__COMMIT_HASH__` im Bundle.

## Ablage
- Geändert: `.github/workflows/ci.yml`, `docker-compose.yml.example`, `README.md`, `CLAUDE.md`, `.claude/rules/frontend.md`
- Neu: ggf. `docker-compose.build.yml` (Override für lokales Bauen)
- Entfernt: `scripts/deploy.sh`

## Nicht in diesem Auftrag
- Deploy-Automatik auf den Server (Webhook, SSH aus der CI, Watchtower)
- Multi-Arch-Images (arm64)
- Signieren, SBOM, Attestations
- PostgreSQL-Upgrade (W.21), Versionspflege der Images (W.15)
- Änderungen an der lokalen `docker-compose.yml` des Masters oder am Server

## Entscheidungen, die ich treffe
- keine (öffentliche Images, Tags SHA + `main` und Wegfall von `deploy.sh` sind entschieden)

## Fallstricke
- **Neue Actions sind neue Abhängigkeiten:** Login, Build und Push gehen mit `docker login`/`docker build`/`docker push` auf dem Runner ohne zusätzliche Actions. Wer `docker/login-action`, `docker/build-push-action` o. Ä. nutzen will, legt das am Checkpoint vor (per Commit-SHA gepinnt wie die übrigen).
- **Sichtbarkeit:** Ein erstes Push nach `ghcr.io` legt das Paket privat an; öffentlich stellen geht nur einmalig von Hand in den Paket-Einstellungen auf GitHub. Gehört in die Upgrade-Hinweise, nicht in die CI.
- **Inhalt der öffentlichen Images:** Die CI baut aus dem Checkout, also nur aus versionierten Dateien. `backend/` hat keine `.dockerignore`, das `Dockerfile` kopiert aber nur `app/`, `alembic/`, `alembic.ini`, `prompts/`; `frontend/.dockerignore` schließt `.env` selbst nicht aus. Im Bericht bestätigen, dass kein Geheimnis, keine `.env` und keine Instanzkonfiguration (OIDC, Domains) im Image landet; Instanzwerte kommen zur Laufzeit über `config.js.template` bzw. `.env`.
- **`pull` vs. `up`:** `docker compose up -d` zieht ein vorhandenes Tag (`main`) nicht neu (Standard `pull_policy: missing`). Der dokumentierte Befehl muss `pull` enthalten (`docker compose pull && docker compose up -d` oder `up -d --pull always`); mit neuem Image erzeugt Compose die Container selbst neu.
- **`image:` und `build:` in einer Datei:** Steht beides im selben Dienst, versucht Compose bei `up` zu ziehen und baut nur bei Bedarf, und `docker compose build` überschreibt das gezogene Tag lokal. Deshalb `build:` in einen Override auslagern.
- **`concurrency` mit `cancel-in-progress`:** Ein abgebrochener älterer Lauf darf `main` nicht nach einem neueren taggen. Push erst als letzten Schritt nach allen Prüfungen.
- **Owner kleinschreiben:** ghcr verlangt kleingeschriebene Namen; `github.repository_owner` kann Großbuchstaben enthalten.

## Checkpoints
- Nur falls zusätzliche Actions nötig erscheinen: vorlegen, dann anhalten. Sonst keine: ohne Halt bis zum Bericht.

## Abnahme
- `ci.yml`: `publish` läuft nur bei Push auf `main` nach allen Prüf-Jobs, Rechte nur dort; PRs bauen ohne Push; YAML gültig
- Lokal nachgestellt: Images mit SHA-Tag gebaut, Stack per `image:` ohne `build:` gestartet, `/api/health` ok, Commit-Hash im Frontend korrekt
- `deploy.sh` entfernt, keine Verweise mehr (README, `CLAUDE.md`, Rules); README beschreibt Deploy, Rollback, lokales Bauen und den Umstieg des Servers
- Bestätigung im Bericht: keine Geheimnisse oder Instanzwerte in den Images
- Verifikation gemäß Projekt-CLAUDE.md (Container bauen und starten)
- Nach dem Merge (meine Aufgabe): erster CI-Lauf auf `main` pusht beide Images, Paket öffentlich gestellt, Server zieht per Pull

## Nacharbeit (2026-11-16, nach Prüfung)

Ausgangsstand: `e8d44b6`. Vorher `git merge main` im Worktree.

- **N1 Kein Abbruch auf `main`:** `concurrency.cancel-in-progress` nur für Pull Requests (z. B. `${{ github.event_name == 'pull_request' }}`). Grund: Ein Abbruch mitten im Push der `:main`-Tags hinterlässt ein gemischtes Paar (`frontend:main` neu, `backend:main` alt); scheitert der neuere Lauf danach, zieht der Server ein inkonsistentes Paar. Läufe auf `main` warten stattdessen aufeinander.
- **N2 `:main` nur vom aktuellen Stand:** Vor dem Push der `:main`-Tags prüfen, ob `GITHUB_SHA` noch der Kopf von `main` ist (z. B. `git ls-remote` gegen `origin`; Authentifizierung prüfen, der Checkout läuft mit `persist-credentials: false`). Sonst nur die SHA-Tags pushen und das im Log melden. Grund: Ein manueller Re-run eines älteren Laufs setzt `:main` sonst zurück.
- **N3 README:** Befehl für lokales Bauen (`README.md` ~Zeile 111) mit korrektem Zeilenumbruch; beim Öffentlichstellen der Pakete Hinweis, dass öffentlich nicht wieder privat gestellt werden kann; Hinweis zum PostgreSQL-Major nennt W.21 bzw. verweist auf die kommende Anleitung.

### Abnahme Nacharbeit
- YAML gültig; N1/N2 im Bericht begründet (Bedingungen, Verhalten bei Re-run und parallelen Läufen); N2-Prüfung lokal als Shell-Schritt nachgestellt (aktueller und veralteter SHA)
- Bericht um Abschnitt „Nacharbeit“ fortschreiben
