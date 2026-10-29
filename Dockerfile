# syntax=docker/dockerfile:1
# Sales OS production image. Works on Railway, Render, Fly.io or plain Docker.
#
# Runtime env (set on the host, never baked in):
#   DATABASE_URL, SESSION_SECRET, ENCRYPTION_KEY  (required)
#   APP_URL, META_*                               (optional, see .env.example)
#   SEED_ON_START=true                            (loads demo data into an EMPTY database)
#   PORT                                          (defaults to 3000; Railway sets it)

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# ---- dependencies -------------------------------------------------------------
FROM base AS deps
# prisma generate runs on postinstall and needs the schema + config present.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
# postinstall -> prisma generate; the config loads .env if present, but none is needed here.
RUN pnpm install --frozen-lockfile

# ---- build --------------------------------------------------------------------
FROM base AS build
COPY . .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
# The env schema is validated at import time during `next build`; these placeholder values
# satisfy it and are never used at runtime (real values come from the host environment).
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    SESSION_SECRET=build-time-placeholder-secret-0000000000 \
    ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
RUN pnpm build

# ---- runtime ------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
RUN chmod +x docker/entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 3000
ENTRYPOINT ["./docker/entrypoint.sh"]
