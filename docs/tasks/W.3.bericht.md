# Bericht W.3: Instanz-Defaults entfernen, erster Admin, Login-Race, Touch-Icon

> Branch `worktree-W.3-instanz-defaults` · Basis `14247dc` (HEAD bei Start `4d35115`, nur docs) · Stand `1606d60` · 2026-11-15 · Dauer: 00:16 – 00:25 (9 min, davon Warten an Checkpoints 0 min) · Status: fertig

## Ergebnis
Das Repo enthält keine Instanzwerte mehr (`grep cehser` leer). `OIDC_AUTHORITY`/`OIDC_CLIENT_ID` sind Backend-Pflicht. `ADMIN_EMAIL` stuft per verifizierter Token-E-Mail zum Admin herauf (neu und bestehend, nie herab). Die Neuanlage läuft per `ON CONFLICT DO NOTHING`; der Race ist gegen PostgreSQL nachgewiesen. iOS bekommt `apple-touch-icon` und PNG-Favicons.

## Commits
- `e0ce16f` feat(backend): OIDC ohne Code-Defaults, ADMIN_EMAIL und Login ohne Race
- `1606d60` feat(frontend): Instanzwerte aus Dev-Config und index.html entfernen, Touch-Icon

## Verifikation
- `npm run lint:check && npm run typecheck && npm run build` → 0 Fehler, 1 Warnung (prettier in `AIRecipeImport.vue:375`, Datei unberührt, vorbestehend); Build ok
- `uv sync --frozen && ruff check && ruff format --check && pytest` → sauber, 82 Tests grün (neu: `tests/test_user_provisioning.py`, 30 Fälle)
- `dist/index.html`: `apple-touch-icon`, PNG-Favicons 32/16, kein `msapplication-starturl`; `dist/img/icon-{16x16,32x32,180x180}.png` vorhanden
- Backend ohne `OIDC_*` (Container): bricht beim Start mit pydantic-`Field required` für beide Felder ab; mit Werten: Migrationen ok, `GET /api/health` → 200
- Race-Nachweis (PostgreSQL 17 im Wegwerf-Container, 20 parallele Erstlogins, getrennte Sessions): alter Code (`4d35115`) 13 von 20 `IntegrityError`; neuer Code 3 Läufe, 0 Fehler, alle 20 → `admin`
- Sichtprüfung: Dev-Server liefert `/config.js` als `text/javascript` (leere Datei), nicht mehr HTML
- Prüfzeit: ~5 min; größter Posten: Frontend-Build/Lint/Typecheck (44 s) und Docker-Build
- Prüfskripte: nur Scratchpad (`race.py`)

## Struktur und Doku
- Gewachsene Dateien: keine; neu `backend/tests/test_user_provisioning.py` (~150 Zeilen)
- Doku: README (Variablen, „Erster Admin“, `.env.local`), `.env.example`, `frontend/.env.example`, `.claude/rules/frontend.md` nachgetragen

## Abweichungen vom Auftrag
- `frontend/public/config.js` nicht gelöscht, sondern leer (nur Kommentar) belassen: Der Dev-Server antwortet bei fehlender Datei per SPA-Fallback mit 200/`text/html`, das ergäbe einen Syntaxfehler im Script (vom Auftrag als Alternative vorgesehen).
- Zusätzlich `ADMIN_EMAIL` (auskommentiert) in die Root-`.env.example` aufgenommen.
- `conftest.py` setzt die OIDC-Testwerte per `os.environ.setdefault` vor dem App-Import, daher `# noqa: E402` an den Folge-Imports.
- Fehlermeldung bei fehlenden `OIDC_*`: unveränderte pydantic-Validierungsfehler (nennt die Felder, aber Großschreibung der Env-Namen nicht explizit).

## Nachgetragen in Specs/Plänen
- nichts

## Befunde für andere Projekte
- keine

## Offen und Folgepunkte
- `email_verified` im Access-Token der Instanz ist **unbestätigt**. Fehlt das Claim, gibt es keine Heraufstufung (so umgesetzt). Vor Nutzung im Keycloak prüfen (Client-Scope `email`, Mapper „email verified“ im Access-Token). Das Setzen des ersten Admins per SQL bleibt als Fallback.
- Der Race-Test ist nur manuell (Scratchpad); DB-Integrationstests sind Roadmap W.5.

## Server-`.env` (vor Deploy)
- Pflicht, sonst startet das Backend nicht: `OIDC_AUTHORITY` (altes Default: Realm-URL der Instanz), `OIDC_CLIENT_ID` (altes Default: Client-ID der Instanz). Das Frontend braucht dieselben Variablen schon bisher.
- Optional: `ADMIN_EMAIL`.

## Status je Roadmap-Punkt
- `W.3` fertig
- `W.19` fertig

## Vorschlag Roadmap-Zeilen
`- [x] W.3 Instanz-Defaults, erster Admin, Login-Race · 2026-11-15 · 1606d60`
`- [x] W.19 Apple-Touch-Icon · 2026-11-15 · 1606d60`
