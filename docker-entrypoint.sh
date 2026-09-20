#!/bin/sh
set -e

# Apply pending migrations on boot (idempotent). Set RUN_MIGRATIONS=false when a
# separate job (deploy/docker-compose.prod.yml "migrate" service, CI) handles it.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] applying database migrations"
  node /app/tools/node_modules/prisma/build/index.js migrate deploy
fi

exec "$@"
