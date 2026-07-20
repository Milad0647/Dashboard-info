#!/bin/sh
set -e

UPLOAD_DIR="${UPLOAD_DIR:-/app/data/uploads}"
BACKUP_DIR="${BACKUP_DIR:-/app/data/backups}"

if [ -n "$DATABASE_URL" ]; then
  echo "Waiting for database..."
  until psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; do
    echo "Database not ready, retrying in 2s..."
    sleep 2
  done

  echo "Applying database schema..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
  echo "Database schema ready."

  echo "Seeding database if empty..."
  COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM campaign_settings")
  if [ "$COUNT" = "0" ]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seed.sql
    echo "Demo data seeded."
  else
    echo "Database already has campaigns, skipping seed."
  fi
fi

mkdir -p "$UPLOAD_DIR" "$BACKUP_DIR"
chown -R nextjs:nodejs "$UPLOAD_DIR" "$BACKUP_DIR" 2>/dev/null || true

# In-container midnight backup trigger (Asia/Tehran) — complements in-app instrumentation scheduler.
if [ "${DISABLE_DAILY_BACKUP_SCHEDULER:-}" != "1" ]; then
  echo "Starting daily backup poller (Tehran 00:00 midnight)..."
  su-exec nextjs:nodejs node ./scripts/daily-backup-poller.mjs &
fi

exec su-exec nextjs:nodejs node server.js
