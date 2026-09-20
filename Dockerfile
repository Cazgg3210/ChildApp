# syntax=docker/dockerfile:1.7
# Multi-stage build → small standalone Next.js image (works on DigitalOcean, EasyPanel, any Docker host).
#
# Targets:
#   runtime (default)  → the web app; applies pending migrations on boot (RUN_MIGRATIONS=false to skip)
#   migrate            → one-off job image: `prisma migrate deploy` and `prisma db seed`

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---- deps -------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts

# ---- migrate (migrations + seed, full toolchain) ------------------------------
FROM deps AS migrate
COPY tsconfig.json ./
COPY src ./src
COPY messages ./messages
RUN npx prisma generate
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- build ------------------------------------------------------------------
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time env only needs to satisfy validation; real values are injected at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="build-time-placeholder-secret-not-used-at-runtime-0000"
RUN npx prisma generate && npm run build

# ---- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs && mkdir -p /data/storage && chown nextjs:nodejs /data/storage
# Prisma CLI in its own tree (outside the standalone bundle) so the container can run `migrate deploy` on boot.
RUN mkdir -p /app/tools && cd /app/tools && npm init -y >/dev/null     && npm install --no-audit --no-fund --omit=dev prisma@7.10.0     && npm cache clean --force
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
ENV NODE_PATH=/app/tools/node_modules
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
