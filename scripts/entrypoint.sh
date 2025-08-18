#!/usr/bin/env bash
set -euo pipefail

# Parametry połączenia do Postgresa (superuser)
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_SUPERUSER="${DB_SUPERUSER:-postgres}"
DB_SUPERPASS="${DB_SUPERPASS:-}"

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
psql -v ON_ERROR_STOP=1 -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_SUPERUSER}" -d postgres -f /app/scripts/db-init.sql || {
  echo "ERROR: db-init.sql failed" >&2
  exit 1
}

# (Opcjonalnie) migracje – jeśli chcesz wykonywać tutaj:
# npx prisma migrate deploy || {
#   echo "ERROR: prisma migrate failed" >&2
#   exit 1
# }

# Czyścimy hasło z env i startujemy aplikację
unset PGPASSWORD
echo "Starting application..."
exec "$@"
