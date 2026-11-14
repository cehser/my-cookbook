# Auftrag W.3: Instanz-Defaults entfernen, erster Admin, Login-Race, Touch-Icon

> Erstellt 2026-11-15 vom Master · Roadmap: `ROADMAP.md` Punkte W.3, W.19 · Basis: `main@14247dc` · Aufwand: S–M · Modell: Sonnet

## Ziel
Das Repo enthält keine Werte der eigenen Instanz mehr; eine neue Instanz läuft allein über `.env`. Der erste Admin wird per `ADMIN_EMAIL` bestimmt statt per SQL. Der erste Login eines Users erzeugt keine 500er mehr. iOS zeigt auf dem Homescreen das richtige Icon.

## Erst lesen
1. `backend/app/config.py`, `frontend/public/config.js`, `frontend/.docker/nginx/config.js.template` und `docker-entrypoint.sh`, `frontend/src/auth/oidc.ts` (Fallback auf `VITE_OIDC_*`)
2. `frontend/index.html`, `frontend/public/img/`
3. `backend/app/auth/dependencies.py` (`get_or_create_user`), `backend/app/auth/oidc.py`
4. `README.md` – Abschnitte Konfiguration, Umgebungsvariablen, OIDC; `.claude/rules/backend-db.md`

## Auftrag

### W.3 Instanz-Defaults, erster Admin, Login-Race
1. **Backend-Defaults:** `oidc_authority` und `oidc_client_id` in `config.py` ohne Instanzwerte. Fehlen sie, startet das Backend nicht (Pflichtfeld) oder bricht mit klarer Meldung ab. Smoke-Tests setzen Testwerte in `conftest.py` vor dem App-Import.
2. **Frontend-Dev-Config:** `frontend/public/config.js` mit Instanzwerten aus dem Repo entfernen. Lokaler Dev-Server nutzt `VITE_OIDC_AUTHORITY`/`VITE_OIDC_CLIENT_ID` aus `frontend/.env.local` (per `.gitignore` ausgeschlossen); eine `frontend/.env.example` mit Platzhaltern beilegen. Der Container erzeugt `config.js` weiter per `envsubst`. Prüfen, dass ein fehlendes `/config.js` im Dev-Server nur einen 404 ohne Folgefehler erzeugt, sonst eine leere Datei ausliefern.
3. **`index.html`:** `msapplication-starturl` mit absoluter Instanz-URL entfernen (Manifest hat `start_url`).
4. **Erster Admin:** neue Einstellung `admin_email` (`ADMIN_EMAIL`, optional). In `get_or_create_user`: Stimmt die E-Mail aus dem Token (ohne Groß-/Kleinschreibung) überein **und** ist `email_verified` wahr, erhält der User die Rolle `admin`, auch wenn er schon existiert. Nur heraufstufen, nie herabstufen. Mit Log-Zeile.
5. **Login-Race:** Neuanlage in `get_or_create_user` per PostgreSQL `INSERT … ON CONFLICT (oidc_sub) DO NOTHING`, danach lesen. Parallele erste Requests dürfen keinen `UniqueViolation` mehr auslösen.
6. **Doku:**
   - README: Umgebungsvariablen (`OIDC_*` jetzt ohne Default, `ADMIN_EMAIL`), neuer Abschnitt „Erster Admin“, lokale Entwicklung mit `frontend/.env.local`.
   - `.claude/rules/frontend.md`: Satz zu `public/config.js` anpassen.

### W.19 Apple-Touch-Icon
1. In `index.html`: `apple-touch-icon` auf `/img/icon-180x180.png`, PNG-Favicons 32×32 und 16×16 zusätzlich zum SVG.
2. Im Build prüfen, dass die Links in `dist/index.html` stehen und die Dateien unter `dist/img/` liegen.

## Ablage
- Geändert: `backend/app/config.py`, `backend/app/auth/dependencies.py`, `backend/tests/conftest.py` (+ Tests), `frontend/index.html`, `README.md`, `.claude/rules/frontend.md`
- Neu: `frontend/.env.example`; gelöscht: `frontend/public/config.js`

## Nicht in diesem Auftrag
- `silent-renew.html` und `silent_redirect_uri` (W.23)
- `docker-compose.yml.example`, außer ein neuer Wert muss dort an das Backend durchgereicht werden (heute per `env_file`, also nicht nötig)
- Alles in W.12 (AI-Routen, `me.py`, `admin.py`, Admin-Oberfläche)

## Entscheidungen, die ich treffe
- keine. Festgelegt: `ADMIN_EMAIL` nur mit `email_verified`, nur Heraufstufung.

## Fallstricke
- **Server:** Die laufende Instanz könnte sich auf die Code-Defaults verlassen. Im Bericht die Variablen nennen, die in der Server-`.env` stehen müssen (`OIDC_AUTHORITY`, `OIDC_CLIENT_ID`, optional `ADMIN_EMAIL`); ich prüfe sie vor dem Deploy. `.env` nicht lesen.
- `email_verified` im **Access-Token** (das Backend prüft den Access-Token, nicht das ID-Token): bei Keycloak über den Client-Scope `email` üblich, für diese Instanz unbestätigt. Lässt es sich nicht belegen, Verhalten bei fehlendem Claim = keine Heraufstufung, und im Bericht vermerken.
- Smoke-Tests importieren die App ohne `.env`: Pflichtfelder ohne Default brechen den Import, wenn `conftest.py` sie nicht vorher setzt.
- `ON CONFLICT` braucht `sqlalchemy.dialects.postgresql.insert`; die Tests laufen ohne DB, den Race-Fix daher im Container mit parallelen Requests eines neuen Users nachweisen oder mit Begründung im Bericht als nicht prüfbar vermerken.
- W.12 läuft parallel und könnte `config.py` (OpenAI-Timeout) und `README.md` ebenfalls ändern. Konflikte beim Merge sind dort möglich, inhaltlich unabhängig.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `grep -rn "cehser" frontend backend --include=*.py --include=*.ts --include=*.js --include=*.html` findet nichts (außer `node_modules`, `dist`)
- Backend startet ohne `OIDC_*` nicht bzw. mit klarer Meldung; mit Werten normal
- Tests: `ADMIN_EMAIL` + `email_verified` → admin (neu und bestehend); ohne `email_verified` oder andere E-Mail → keine Änderung; bestehender Admin wird nie herabgestuft
- Race-Fix nachgewiesen oder begründet
- `dist/index.html` enthält `apple-touch-icon` und PNG-Favicons, kein `msapplication-starturl`
- Bericht nennt die nötigen Variablen der Server-`.env`
- Verifikation gemäß Projekt-CLAUDE.md (Frontend und Backend)
