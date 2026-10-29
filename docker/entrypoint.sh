#!/bin/sh
# Apply pending migrations, optionally seed an empty database, then start Next.
set -e
pnpm prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  # Seed only when the Lead table is empty, so a restart never wipes real data.
  COUNT=$(node -e '
    const { Client } = require("pg");
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    c.connect().then(() => c.query("select count(*)::int as n from \"Lead\""))
      .then(r => { console.log(r.rows[0].n); return c.end(); })
      .catch(() => { console.log("0"); process.exit(0); });
  ')
  if [ "$COUNT" = "0" ]; then
    echo "Database is empty; loading demo data (admin@sc.studio / admin1234)."
    pnpm db:seed --force
  else
    echo "Database already has $COUNT leads; skipping seed."
  fi
fi

exec pnpm start -p "${PORT:-3000}"
