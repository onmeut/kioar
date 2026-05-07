# ---------- Shared base (mirrors + libc6-compat) -----------------------------
FROM node:22-alpine AS base
RUN echo "https://mirror.arvancloud.ir/alpine/v3.23/main" > /etc/apk/repositories \
 && echo "https://mirror.arvancloud.ir/alpine/v3.23/community" >> /etc/apk/repositories \
 && apk add --no-cache libc6-compat

# ---------- Stage 1: dependencies --------------------------------------------
FROM base AS deps
WORKDIR /app

# Copy only files needed for install — maximizes cache hits
COPY package.json package-lock.json ./

# Use Runflare mirror (Iranian npm proxy) + BuildKit cache mount
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm config set registry https://mirror-npm.runflare.com --global && \
    npm config set strict-ssl false --global && \
    npm ci --loglevel=error --no-fund --legacy-peer-deps

# ---------- Stage 2: migrator ------------------------------------------------
# Lightweight image that runs `drizzle-kit migrate` against the real DB.
# Built from deps (full node_modules including drizzle-kit) — no Next.js build
# needed.  Called via `docker compose run --rm migrator` in deploy.
FROM deps AS migrator
WORKDIR /app

COPY drizzle.config.ts tsconfig.json ./
COPY drizzle/ ./drizzle/
COPY src/db/ ./src/db/

CMD ["npm", "run", "db:migrate"]

# ---------- Stage 3: build ---------------------------------------------------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Cache mount for Next.js build cache — speeds up incremental builds
RUN --mount=type=cache,id=nextjs,target=/app/.next/cache \
    npm run build

# ---------- Stage 4: runtime -------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]