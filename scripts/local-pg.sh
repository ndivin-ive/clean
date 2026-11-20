#!/usr/bin/env bash
# Start a throwaway PostgreSQL 16 cluster WITHOUT Docker (e.g. in CI sandboxes
# or cloud dev containers where the Docker daemon is unavailable).
# Mirrors docker-compose.yml: same roles, databases and port.
set -euo pipefail

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="${PGDATA_DIR:-${TMPDIR:-/tmp}/clean-pg}"
PORT="${PGPORT:-5432}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  id postgres >/dev/null 2>&1 || useradd -r postgres
  RUN_AS=(sudo -u postgres)
  command -v sudo >/dev/null || RUN_AS=(su postgres -c)
fi

run() {
  if [ "${RUN_AS[0]:-}" = "su" ]; then su postgres -c "$*"; elif [ ${#RUN_AS[@]} -gt 0 ]; then "${RUN_AS[@]}" "$@"; else "$@"; fi
}

if [ ! -s "$DATA/PG_VERSION" ]; then
  mkdir -p "$DATA"
  [ ${#RUN_AS[@]} -gt 0 ] && chown postgres "$DATA"
  run "$PGBIN/initdb" -D "$DATA" -U clean_owner --auth=trust >/dev/null
fi

if ! run "$PGBIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  run "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/server.log" -w start >/dev/null
fi

PSQL=(psql -h localhost -p "$PORT" -U clean_owner -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='clean'" | grep -q 1 \
  || "${PSQL[@]}" -d postgres -c "CREATE DATABASE clean"
"${PSQL[@]}" -d postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='clean_app'" | grep -q 1 \
  || "${PSQL[@]}" -d clean -f docker/postgres/init.sql
for db in clean_test clean_e2e; do
  "${PSQL[@]}" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 \
    || { "${PSQL[@]}" -d postgres -c "CREATE DATABASE $db" && "${PSQL[@]}" -d postgres -c "GRANT CONNECT ON DATABASE $db TO clean_app"; }
done
echo "PostgreSQL ready on localhost:$PORT (data: $DATA)"
