# syntax=docker/dockerfile:1

# atGPT — self-contained server image (Next.js standalone + libsql/SQLite).
FROM node:22-slim AS base
WORKDIR /app

# --- deps: full install (dev deps needed to build) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: produce the standalone server bundle ---
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runner: minimal runtime image ---
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/app/data/atgpt.db

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone server + traced node_modules + static assets.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migration SQL is read from disk at boot (not bundled), so copy it in.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
# Ensure the native libsql binary is present (belt-and-braces over tracing).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/libsql ./node_modules/libsql

# Writable volume mount point for the SQLite database.
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
VOLUME ["/app/data"]

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
