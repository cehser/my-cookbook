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

docker compose exec -T db pg_dump -U cookbook cookbook | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "Backup saved: ${BACKUP_DIR}/${FILENAME}"

# Keep only the last 30 backups
ls -t "${BACKUP_DIR}"/cookbook_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm --
echo "Cleanup done (keeping last 30 backups)"
