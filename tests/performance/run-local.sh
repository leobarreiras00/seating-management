#!/usr/bin/env bash
# Clean local environment (API limited to 0.1 CPU / 512 MB) -> seed -> k6 -> docker stats -> tear down.
#   ./run-local.sh stress     or     ./run-local.sh load
# Needs SUPERADMIN_EMAIL/PASS, GESTOR_EMAIL/PASS, USER_EMAIL/PASS exported in the current shell.
set -euo pipefail
cd "$(dirname "$0")"
KIND="${1:?usage: ./run-local.sh stress|load}"
for v in SUPERADMIN_EMAIL SUPERADMIN_PASS GESTOR_EMAIL GESTOR_PASS USER_EMAIL USER_PASS; do : "${!v:?$v is not set}"; done
mkdir -p results
docker compose -f docker-compose.perf.yml down
docker compose -f docker-compose.perf.yml up -d --build
echo "Waiting 120 s for the API to start (0.1 CPU) ..."; sleep 120
docker compose -f docker-compose.perf.yml exec -T db psql -U seatly -d seatly_perf -v ON_ERROR_STOP=1 \
  -v company="Acme Group Test" -v sa_email="$SUPERADMIN_EMAIL" -v sa_pass="$SUPERADMIN_PASS" \
  -v g_email="$GESTOR_EMAIL" -v g_pass="$GESTOR_PASS" -v u_email="$USER_EMAIL" -v u_pass="$USER_PASS" \
  -f - < seed-local.sql
SEATLY_API=http://localhost:8080 node seed.mjs
RUN_NAME="${KIND}-local" ./capture-docker-stats.sh & CAP=$!
set +e
SEATLY_API=http://localhost:8080 WRITES=true RUN_NAME="${KIND}-local" k6 run "${KIND}.js" > "results/${KIND}-local.console.txt" 2>&1
kill "$CAP" 2>/dev/null
docker compose -f docker-compose.perf.yml down
echo "Finished. Results are in tests/performance/results/ (${KIND}-local.*)."
