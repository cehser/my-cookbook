#!/bin/sh
# pg_dump backup for my-cookbook database
# Usage: ./scripts/backup.sh [backup_dir]
#
# Runs pg_dump inside the db container and saves a timestamped .sql.gz file.
# Default backup directory: ./backups/

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="cookbook_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Kein "set -o pipefail" (in dash nicht überall verfügbar): erst in eine Temp-Datei dumpen,
# damit der Exit-Code von pg_dump direkt auswertbar ist, dann komprimieren.
TMP_SQL="${BACKUP_DIR}/.${FILENAME}.sql.tmp"
TMP_GZ="${BACKUP_DIR}/.${FILENAME}.tmp"
trap 'rm -f "$TMP_SQL" "$TMP_GZ"' EXIT

if ! docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$TMP_SQL"; then
    echo "Backup fehlgeschlagen: pg_dump meldet einen Fehler." >&2
    exit 1
fi

if [ ! -s "$TMP_SQL" ]; then
    echo "Backup fehlgeschlagen: Dump ist leer." >&2
    exit 1
fi

gzip -c "$TMP_SQL" > "$TMP_GZ"
mv "$TMP_GZ" "${BACKUP_DIR}/${FILENAME}"

echo "Backup saved: ${BACKUP_DIR}/${FILENAME}"

# Keep only the last 30 backups
ls -t "${BACKUP_DIR}"/cookbook_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm --
echo "Cleanup done (keeping last 30 backups)"
