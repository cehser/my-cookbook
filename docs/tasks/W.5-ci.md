# Auftrag W.5: CI mit GitHub Actions, Migrations-Test gegen PostgreSQL

> Erstellt 2026-11-15 vom Master · Roadmap: `ROADMAP.md` Punkt W.5 · Basis: `main@58686bc` · Aufwand: M · Modell: Sonnet

## Ziel
Jeder Push auf `main` und jeder Pull Request prüft Frontend und Backend automatisch, einschließlich der Alembic-Migrationen gegen ein echtes PostgreSQL und des Image-Builds. Der Docker-Build des Frontends nutzt denselben Abhängigkeitsbaum wie lokal (ohne `--legacy-peer-deps`). Kein Push von Images (W.9), keine Vitest-Tests (W.10 hängt sich später ein).

## Erst lesen
1. Projekt-`CLAUDE.md` – Abschnitt „Verifikation“ (die Befehle, die CI ausführt)
2. `.claude/rules/frontend.md` (`npm ci` ohne Flag), `.claude/rules/backend-tooling.md` (Test-Muster), `.claude/rules/backend-db.md`
3. `docs/plans/abhaengigkeiten.md` – Zeile `vite-plugin-pwa` (warum das Flag entfällt)
4. `docs/tasks/W.4.bericht.md` – „Offen und Folgepunkte“: Integrationsprobe als Vorlage für DB-Tests
5. `frontend/Dockerfile`, `backend/Dockerfile`, `backend/tests/conftest.py`

## Auftrag
1. **Workflow** `.github/workflows/ci.yml`, Trigger `push` auf `main` und `pull_request`; parallele Jobs:
   - **frontend:** Node-Major wie im Dockerfile, `npm ci`, `lint:check`, `typecheck`, `build`, `npm audit --audit-level=high`. Cache für npm.
   - **backend:** uv (Version wie im Dockerfile), `uv sync --frozen`, `ruff check`, `ruff format --check`, `pytest`.
   - **backend-db:** PostgreSQL als Service-Container (Major wie in `docker-compose.yml.example`), DB-Tests aus Schritt 2.
   - **images:** `docker build` für `frontend/` und `backend/` ohne Push.
2. **DB-Tests** in `backend/tests/db/` mit eigenem `conftest.py`, Marker `db`:
   - `alembic upgrade head` auf leerer DB läuft durch, danach `alembic downgrade base` und erneut `upgrade head` (falls Downgrades existieren; sonst nur upgrade und begründen).
   - Kleine Probe gegen die echte DB über `ASGITransport` mit überschriebenem `get_current_user`: Rezept anlegen, lesen, listen (Paginierung mit Tie-Breaker), Tags, löschen; `/me` legt einen neuen User an.
   - Ohne `DB_*`/Test-DB werden die Tests übersprungen (`pytest` lokal bleibt ohne DB grün).
3. **Dockerfile Frontend:** `--legacy-peer-deps` entfernen.
4. **Doku:**
   - Projekt-`CLAUDE.md`, „Verifikation“: CI erwähnen; den Satz „Keine DB-Integrationstests“ und „Keine CI“ ersetzen; lokaler Aufruf der DB-Tests.
   - README: Badge oder kurzer Hinweis auf die CI, optional.
   - `.claude/rules/frontend.md`: Satz zum Dockerfile-Flag streichen (erledigt).

## Ablage
- Neu: `.github/workflows/ci.yml`, `backend/tests/db/` (`conftest.py`, Testmodule)
- Geändert: `frontend/Dockerfile`, `backend/pyproject.toml` (Marker), `CLAUDE.md`, `.claude/rules/frontend.md`, ggf. `README.md`

## Nicht in diesem Auftrag
- Images bauen **und** pushen, `ghcr.io`, `deploy.sh` (W.9)
- Vitest (W.10), Dependabot/Renovate
- Branch-Schutzregeln auf GitHub (Einstellung durch mich)

## Entscheidungen, die ich treffe
- keine

## Fallstricke
- **Lieferkette:** Fremde Actions per Commit-SHA pinnen (Kommentar mit Version dahinter), nicht per Tag. Nur offizielle Actions (`actions/*`, `astral-sh/setup-uv`, `docker/*`) verwenden; aktuelle Versionen vor dem Pinnen prüfen.
- **Rechte:** `permissions: contents: read` auf Workflow-Ebene.
- W.3 läuft parallel und macht `OIDC_AUTHORITY`/`OIDC_CLIENT_ID` zu Pflichtfeldern; es setzt Testwerte in `tests/conftest.py`. Deshalb DB-Tests in `tests/db/conftest.py`, nicht im Haupt-`conftest.py`; im Workflow die beiden Variablen trotzdem mit Dummy-Werten setzen.
- Die Engine in `app/database.py` entsteht beim Import aus `settings`; die DB-Variablen müssen vor dem App-Import gesetzt sein.
- `lifespan` startet die Migration; die DB-Tests rufen Alembic gezielt auf und starten den `lifespan` nicht doppelt.
- Ohne `--legacy-peer-deps` muss `npm ci` im Image durchlaufen (lokal in `node:26-alpine` geprüft am 2026-11-15); Image-Build nach der Änderung tatsächlich ausführen.
- `.env` nicht lesen; CI braucht keine Geheimnisse.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- Workflow-Syntax geprüft (z. B. `actionlint`, falls ohne Installation verfügbar, sonst begründet); alle Actions per SHA gepinnt
- Lokal: alle Job-Schritte einzeln ausgeführt und grün; DB-Tests gegen ein lokales PostgreSQL 16 (Container) grün; `pytest` ohne DB grün (DB-Tests übersprungen)
- `docker build` für beide Images grün, Frontend ohne `--legacy-peer-deps`
- Bericht nennt, was erst nach dem Push auf GitHub sichtbar wird (erster CI-Lauf)
- Verifikation gemäß Projekt-CLAUDE.md (Frontend und Backend)
