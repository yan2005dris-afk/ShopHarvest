#!/usr/bin/env bash
#
# VPS bootstrap script — runs ONCE on a fresh Ubuntu 22.04/24.04 VPS to set up
# the entire stack: clone the repo, install Docker, render the production
# .env, build images, and bring the stack up via `compose.yaml`.
#
# Usage (from the VPS):
#   git clone https://github.com/<owner>/WebScrapingDinamico-Automatico.git /opt/scraper
#   cd /opt/scraper
#   bash deploy/vps-init.sh
#
# The script does NOT generate a Cloudflare tunnel token — that step requires
# a browser login to Cloudflare and must be done on your LOCAL machine first.
# See DEPLOY.md for the full tunnel setup walkthrough.
#
# Idempotent: re-running after a partial failure picks up where it left off.
# Safe to re-run after the initial deploy to refresh secrets.

set -euo pipefail

REPO_DIR="/opt/scraper"
GITHUB_REPO="${GITHUB_REPO:-$(git -C . config --get remote.origin.url 2>/dev/null || echo '')}"

log() { printf "\033[1;34m[vps-init]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[vps-init]\033[0m %s\n" "$*" >&2; }
fatal() { printf "\033[1;31m[vps-init]\033[0m %s\n" "$*" >&2; exit 1; }

# ─── 1. Install Docker if missing ──────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker (official apt repo)..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  log "Docker installed."
else
  log "Docker already present: $(docker --version)"
fi

if ! docker compose version >/dev/null 2>&1; then
  fatal "docker compose v2 not available. Install docker-compose-plugin."
fi

# ─── 2. Clone the repo if we are not already inside it ─────────────────────
if [ ! -f compose.yaml ]; then
  if [ -z "${GITHUB_REPO}" ]; then
    fatal "Not inside a clone and GITHUB_REPO is not set. Pass GITHUB_REPO=https://github.com/<owner>/repo.git"
  fi
  log "Cloning ${GITHUB_REPO} to ${REPO_DIR}..."
  mkdir -p "${REPO_DIR}"
  git clone "${GITHUB_REPO}" "${REPO_DIR}"
  cd "${REPO_DIR}"
fi

# ─── 3. Generate .env if missing ───────────────────────────────────────────
if [ ! -f .env ]; then
  log "Generating .env from .env.example with fresh secrets..."
  cp .env.example .env

  # Generate two 32-byte hex passwords and bake them into .env.
  OP_PASS=$(openssl rand -hex 24)
  DW_PASS=$(openssl rand -hex 24)

  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${OP_PASS}|" .env
  sed -i "s|^POSTGRES_DW_PASSWORD=.*|POSTGRES_DW_PASSWORD=${DW_PASS}|" .env
  sed -i "s|^ANALYTICS_DATABASE_URL=.*|ANALYTICS_DATABASE_URL=postgresql://scraper:${DW_PASS}@localhost:5434/scraperdw|" .env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://scraper:${OP_PASS}@localhost:5433/scraperdb|" .env

  # Append / update the prod-only variables (CORS_ORIGIN defaults to empty
  # since the SPA is served same-origin via the tunnel).
  sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=|" .env

  chmod 600 .env
  log ".env written. Backing up to /root/.env.backup (1Password/Bitwarden recommended)."
  cp .env /root/.env.backup
else
  log ".env already exists — leaving untouched."
fi

# ─── 4. Pre-flight: warn if TUNNEL_TOKEN is empty ──────────────────────────
if ! grep -q "^TUNNEL_TOKEN=.\+" .env 2>/dev/null; then
  warn "TUNNEL_TOKEN is empty in .env."
  warn "cloudflared will keep restarting until you set it. The rest of"
  warn "the stack still comes up so you can verify locally on :8080."
  warn ""
  warn "To enable public access later:"
  warn "  1. On your LOCAL machine: cloudflared tunnel login"
  warn "  2. Then: cloudflared tunnel create scraper-bi"
  warn "  3. Copy the UUID or credentials JSON to .env as TUNNEL_TOKEN=<token>"
  warn "  4. In Cloudflare dashboard → Zero Trust → Networks → Tunnels:"
  warn "       add a Public Hostname for your domain pointing to http://frontend:80"
  warn "  5. On the VPS: docker compose up -d cloudflared"
fi

# ─── 5. Bring the stack up ─────────────────────────────────────────────────
log "Building images (5-10 minutes on a small VPS)..."
docker compose pull --ignore-pull-failures || true
docker compose build --pull

log "Starting postgres + backend + frontend..."
docker compose up -d postgres postgres-dw

# Wait for both DBs to be healthy before starting the backend (which runs migrations).
for i in {1..30}; do
  if docker compose ps postgres | grep -q "(healthy)" \
     && docker compose ps postgres-dw | grep -q "(healthy)"; then
    log "Both Postgres instances healthy."
    break
  fi
  sleep 2
done

docker compose up -d backend frontend

# Wait for backend healthcheck to pass.
log "Waiting for backend to be ready..."
for i in {1..60}; do
  if docker compose exec -T backend wget -q -O- http://localhost:3000/health 2>/dev/null | grep -q "ok\|OK"; then
    log "Backend is up."
    break
  fi
  if [ "$i" -eq 60 ]; then
    warn "Backend health check did not pass in 120s. Continuing anyway; check 'docker compose logs backend'."
  fi
  sleep 2
done

# ─── 6. Start cloudflared (always) ─────────────────────────────────────────
log "Starting cloudflared..."
docker compose up -d cloudflared
if grep -q "^TUNNEL_TOKEN=.\+" .env 2>/dev/null; then
  log "Cloudflare Tunnel connecting to Cloudflare's edge..."
  log "Public URL will be the hostname you configured in the Cloudflare dashboard."
else
  warn "TUNNEL_TOKEN not set — cloudflared will keep restarting."
  warn "Set TUNNEL_TOKEN in .env and run 'docker compose up -d cloudflared' to retry."
fi

# ─── 7. Final summary ──────────────────────────────────────────────────────
log "═══════════════════════════════════════════════════════════════"
log "  Stack is up."
log ""
log "  Local access:    http://localhost:8080    (or http://<vps-ip>:8080)"
if grep -q "^TUNNEL_TOKEN=.\+" .env 2>/dev/null; then
  log "  Public access:   https://<your-hostname>  (configure in Cloudflare dashboard)"
fi
log "  Backup env:      /root/.env.backup"
log ""
log "  Useful commands:"
log "    docker compose ps                          # status de todo el stack"
log "    docker compose logs -f backend             # tail backend logs"
log "    docker compose logs -f cloudflared         # tail tunnel logs"
log "═══════════════════════════════════════════════════════════════"