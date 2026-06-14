#!/bin/sh
set -e

UPLOAD_DIR="${UPLOAD_DIR:-/app/data/uploads}"
MAX_DB_RETRIES="${MAX_DB_RETRIES:-60}"

resolve_database_connection() {
  PGHOST="${POSTGRES_HOST:-dashboard-postgres}"
  PGPORT="${POSTGRES_PORT:-5432}"
  PGUSER="${POSTGRES_USER:-dashboard}"
  PGDATABASE="${POSTGRES_DB:-dashboard}"

  if [ -n "$POSTGRES_PASSWORD" ]; then
    PGPASSWORD="$POSTGRES_PASSWORD"
    export PGPASSWORD
  fi

  export PGHOST PGPORT PGUSER PGDATABASE

  if [ -n "$PGPASSWORD" ]; then
    DATABASE_URL="postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}"
    export DATABASE_URL
  fi
}

wait_for_database() {
  if [ -z "$PGPASSWORD" ] && [ -z "$DATABASE_URL" ]; then
    echo "WARNING: No database credentials configured. Skipping DB setup."
    return 0
  fi

  echo "Waiting for database at ${PGHOST:-dashboard-postgres}..."
  attempt=0

  while [ "$attempt" -lt "$MAX_DB_RETRIES" ]; do
    error_output=$(psql -c "SELECT 1" 2>&1) && {
      echo "Database connection OK."
      return 0
    }

    attempt=$((attempt + 1))

    if echo "$error_output" | grep -qi "password authentication failed"; then
      echo ""
      echo "ERROR: PostgreSQL password authentication failed for user '${PGUSER}'."
      echo "The database volume was likely created with a different POSTGRES_PASSWORD."
      echo ""
      echo "Fix options:"
      echo "  1. Set POSTGRES_PASSWORD in Coolify to the ORIGINAL password used on first deploy."
      echo "  2. Or reset the volume 'dashboard_postgres_data' in Coolify and redeploy (data loss)."
      echo "  3. Or run inside postgres container:"
      echo "     psql -U postgres -c \"ALTER USER ${PGUSER} PASSWORD 'your-new-password';\""
      echo ""
      exit 1
    fi

    if echo "$error_output" | grep -qi "could not translate host name\|connection refused\|no route to host"; then
      echo "Database not reachable yet (attempt ${attempt}/${MAX_DB_RETRIES}), retrying in 2s..."
    else
      echo "Database not ready (attempt ${attempt}/${MAX_DB_RETRIES}): ${error_output}"
    fi

    sleep 2
  done

  echo "ERROR: Database not ready after ${MAX_DB_RETRIES} attempts."
  exit 1
}

apply_database_schema() {
  if [ -z "$PGPASSWORD" ] && [ -z "$DATABASE_URL" ]; then
    return 0
  fi

  echo "Applying database schema..."
  psql -v ON_ERROR_STOP=1 -f database/schema.sql
  echo "Database schema ready."

  echo "Seeding database if empty..."
  COUNT=$(psql -tAc "SELECT COUNT(*) FROM campaign_settings")
  if [ "$COUNT" = "0" ]; then
    psql -v ON_ERROR_STOP=1 -f database/seed.sql
    echo "Demo data seeded."
  else
    echo "Database already has campaigns, skipping seed."
  fi
}

resolve_database_connection
wait_for_database
apply_database_schema

mkdir -p "$UPLOAD_DIR"
chown -R nextjs:nodejs "$UPLOAD_DIR" 2>/dev/null || true

exec su-exec nextjs:nodejs node server.js
