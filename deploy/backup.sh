#!/bin/sh
# Daily MongoDB backup. Run from anywhere on the VPS:  ./deploy/backup.sh
# Keeps the last 14 archives in ./backups. Copy that folder off the VPS too (a backup on the same disk is not a backup).
set -eu
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
mkdir -p backups
FILE="backups/anaa-$(date +%Y%m%d-%H%M%S).archive.gz"
docker compose exec -T mongodb \
  mongodump --username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --db anaa_nutricare --archive --gzip > "$FILE"
[ -s "$FILE" ] || { echo "backup is empty, something failed" >&2; rm -f "$FILE"; exit 1; }
ls -1t backups/anaa-*.archive.gz | tail -n +15 | xargs -r rm -f
echo "saved $FILE ($(du -h "$FILE" | cut -f1))"
# Restore (careful: replaces data):
#   docker compose exec -T mongodb mongorestore --username USER --password PASS --authenticationDatabase admin --archive --gzip --drop < backups/FILE.archive.gz
