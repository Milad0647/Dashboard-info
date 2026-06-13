#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Waiting for database..."
  until psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; do
    echo "Database not ready, retrying in 2s..."
    sleep 2
  done

  echo "Applying database schema..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
  echo "Database schema ready."
fi

exec node server.js
