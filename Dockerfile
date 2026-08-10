# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
# Stable Server Action encryption across rebuilds/instances (base64 AES-16/24/32).
# Must be set at build time so action IDs decrypt consistently after deploy.
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
# DATABASE_URL is injected at runtime by Compose; db host is unavailable during image build
RUN DATABASE_URL= npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3030
ENV HOSTNAME=0.0.0.0
ENV UPLOAD_DIR=/app/data/uploads
ENV BACKUP_DIR=/app/data/backups

RUN apk add --no-cache postgresql-client su-exec
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/database ./database
COPY --from=builder /app/scripts ./scripts
RUN mkdir -p /app/data/uploads /app/data/backups && chown -R nextjs:nodejs /app/data/uploads /app/data/backups /app/public
RUN chmod +x ./scripts/docker-entrypoint.sh

EXPOSE 3030

# Coolify / Traefik / Compose use this so traffic waits until the app is ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3030/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./scripts/docker-entrypoint.sh"]
