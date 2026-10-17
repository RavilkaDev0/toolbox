# syntax=docker/dockerfile:1

FROM node:24.21.0-bookworm-slim AS builder

WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable pnpm && corepack prepare pnpm@12.11.2 --activate
COPY . .
RUN --mount=type=cache,id=toolbox-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

ARG SITE_URL
ENV SITE_URL=${SITE_URL}
RUN test -n "$SITE_URL" || (echo "Set SITE_URL to the public HTTPS origin before building." >&2 && exit 1)
RUN pnpm run build:packages && pnpm --filter @toolbox/web run build

FROM node:24.21.0-bookworm-slim AS runner

ARG SITE_URL
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV SITE_URL=${SITE_URL}

COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public ./apps/web/public

WORKDIR /app/apps/web
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
