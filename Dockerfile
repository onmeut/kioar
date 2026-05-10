# ---------- Shared base -----------------------------------------------------
FROM hub.hamdocker.ir/library/node:22-alpine AS base
RUN ALPINE_VER=$(cat /etc/alpine-release | cut -d. -f1,2) \
 && printf 'https://repo.hmirror.ir/apk/v%s/main\nhttps://repo.hmirror.ir/apk/v%s/community\n' \
    "$ALPINE_VER" "$ALPINE_VER" > /etc/apk/repositories \
 && apk add --no-cache libc6-compat

# ---------- Stage 1: dependencies --------------------------------------------
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --loglevel=error --no-fund --legacy-peer-deps \
      --registry=https://repo.hmirror.ir/npm

# ---------- Stage 2: migrator ------------------------------------------------
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
# Use ENTRYPOINT with -c so any CMD override from the platform is ignored
ENTRYPOINT ["/bin/sh", "-c", "exec node /app/server.js"]