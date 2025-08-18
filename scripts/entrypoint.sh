#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_SUPERUSER="${DB_SUPERUSER:-postgres}"
DB_SUPERPASS="${DB_SUPERPASS:-}"

if [[ -z "${DB_SUPERPASS}" ]]; then
  echo "ERROR: DB_SUPERPASS is not set (superuser password for ${DB_SUPERUSER})." >&2
  echo "Set DB_SUPERPASS in the app container (e.g. via docker-compose) to match POSTGRES_PASSWORD from the postgres container." >&2
  exit 1
fi

export PGPASSWORD="${DB_SUPERPASS}"

echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
for i in {1..60}; do
  if nc -z "${DB_HOST}" "${DB_PORT}" 2>/dev/null; then
    echo "Postgres is up."
    break
  fi
  sleep 1
done
if ! nc -z "${DB_HOST}" "${DB_PORT}" 2>/dev/null; then
  echo "ERROR: Postgres not reachable at ${DB_HOST}:${DB_PORT}" >&2
  exit 1
fi

echo "Running database init SQL..."
# -w: nie pytaj o hasło (fail fast jeśli brak PGPASSWORD)
psql -w -v ON_ERROR_STOP=1 -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_SUPERUSER}" -d postgres -f /app/scripts/db-init.sql

unset PGPASSWORD
echo "Starting application..."
exec "$@"
