# Auftrag W.6: DB-Zugangsdaten aus Variablen, YAML-Altlasten entfernen

> Erstellt 2026-11-14 vom Master · Roadmap: `ROADMAP.md` Punkte W.6, W.8 · Basis: `main@d101f5f` · Aufwand: S · Modell: Sonnet

## Ziel
Backup, Restore und Healthcheck funktionieren auch mit anderen Werten für `DB_USER` oder `DB_NAME` als `cookbook`. Die Reste der einmaligen YAML-Migration sind aus dem Repo entfernt.

## Erst lesen
1. `scripts/backup.sh` – fest verdrahtetes `-U cookbook cookbook`
2. `docker-compose.yml.example` – Service `db`: `POSTGRES_USER`/`POSTGRES_DB` aus `DB_*`, Healthcheck mit festem User
3. `README.md` – Abschnitt „Backup einspielen“

## Auftrag

### W.6 DB-Zugangsdaten aus Variablen
1. Die Werte nicht aus `.env` lesen, sondern aus der Umgebung des `db`-Containers: Dort sind `POSTGRES_USER` und `POSTGRES_DB` bereits gesetzt.
   - `backup.sh`: `docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"'`
2. Healthcheck in `docker-compose.yml.example`: `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}`
3. README-Restore analog über `sh -c` mit `psql -U "$POSTGRES_USER" "$POSTGRES_DB"`.
4. Dateinamen und Rotation in `backup.sh` unverändert lassen (läuft per Cron auf dem Server).

### W.8 YAML-Altlasten entfernen
1. Löschen: `backend/cookbook.yaml` und `backend/scripts/` komplett (`__init__.py`, `migrate_yaml.py`, `restore_empty.py`).
2. `.gitignore`: Zeile `backup_pre_d1.sql` entfernen. `cookbook.dump` und `*.dump` bleiben.
3. Prüfen, dass nichts mehr auf die gelöschten Dateien verweist (Dockerfile kopiert `scripts/` heute nicht).

## Ablage
- Geändert: `scripts/backup.sh`, `docker-compose.yml.example`, `README.md`, `.gitignore`; Löschungen wie oben.

## Nicht in diesem Auftrag
- `PyYAML` aus den Abhängigkeiten entfernen: W.4 baut parallel die Abhängigkeitsverwaltung um (`requirements.txt` → `pyproject.toml`). Im Bericht vermerken, der Master übernimmt es danach.
- Backup der Bilder oder Volumes, Offsite-Kopien (ausdrücklich nicht gewünscht)
- Image-Tags in der Compose-Datei (W.7)

## Entscheidungen, die ich treffe
- keine

## Fallstricke
- In Compose-Dateien wird `$` als Variable der Compose-Datei ausgewertet. Für die Auswertung im Container braucht es `$$`; im Shell-Skript genügen einfache Anführungszeichen um den `sh -c`-Befehl.
- Die laufende `docker-compose.yml` auf dem Server ist eine Kopie der Vorlage und übernimmt die Änderung nicht. Im Bericht die Zeile nennen, die ich dort von Hand nachziehe.
- Merge mit W.4: W.4 formatiert `backend/scripts/*.py` mit ruff. Konflikt beim Merge = Datei gelöscht gegen Datei geändert; die Löschung gilt.
- `.env` nicht lesen (globale Vorgabe); es wird auch nicht gebraucht.

## Checkpoints
- keine: ohne Halt bis zum Bericht

## Abnahme
- `grep -rn "\-U cookbook"` findet nichts mehr
- `sh -n scripts/backup.sh` fehlerfrei
- Falls Docker verfügbar: `docker compose config` mit der Vorlage fehlerfrei; Healthcheck wird `healthy`; `backup.sh` erzeugt ein nicht leeres `.sql.gz`
- Gelöschte Dateien weg, keine Verweise mehr
- Bericht enthält die Zeile, die ich auf dem Server in `docker-compose.yml` ändere
