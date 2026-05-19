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

# ---------- Stage 2: migrator (unused by PaaS) --------------------------------
# This stage is kept for manual / local use only:
#   docker build --target migrator -t kioar-migrator .
#   docker run --env DATABASE_URL=... kioar-migrator
# The PaaS builds the final `runner` stage. Migrations in production are
# handled by scripts/server-wrapper.cjs (see Stage 4).
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

# Migration & seed assets
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/src/db ./src/db
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Replace standalone server.js with our migration wrapper.
# The PaaS runs `node server.js` — our wrapper runs migrations FIRST,
# then loads the real Next.js server (_server.js). Unfuckable.
RUN mv server.js _server.js \
 && cp scripts/server-wrapper.cjs server.js

RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000
ENTRYPOINT ["node", "server.js"]