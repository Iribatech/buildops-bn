#!/bin/sh
set -e

# Apply pending migrations before the API starts. Set RUN_MIGRATIONS=false to
# skip (for example when migrations are run by a separate release step).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  node ./node_modules/typeorm/cli.js \
    -d dist/database/data-source.js \
    migration:run
fi

exec "$@"
