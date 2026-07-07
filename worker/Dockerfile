# ─── ETL worker image ────────────────────────────────────────────────────
# Standalone Node.js process that runs Playwright scrapers on a cron schedule
# and persists results to Postgres. Does NOT include NestJS — see backend
# Dockerfile for the API container.
FROM node:20-alpine

# Playwright system deps for headless Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Playwright to use the system chromium (skip browser download)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_OPTIONS=--max-old-space-size=512 \
    PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

WORKDIR /app/worker

# Copy manifest + lockfile first to leverage Docker layer cache
COPY worker/package.json ./
COPY pnpm-lock.yaml /app/

# Install only worker deps (workspace filtered)
COPY pnpm-workspace.yaml /app/
COPY backend/package.json /app/backend/package.json

RUN pnpm install --filter worker --frozen-lockfile

# Now copy the source
COPY worker/ ./

# The Prisma client is generated into backend/node_modules during build (root
# prisma:generate step in CI). Worker reads it via pnpm hoisting.
COPY backend/prisma /app/backend/prisma

CMD ["tsx", "src/main.ts"]