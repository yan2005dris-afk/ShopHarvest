#!/usr/bin/env bash
#
# VPS bootstrap script — runs ONCE on a fresh Ubuntu 22.04/24.04 VPS to set up
# the entire stack: clone the repo, install Docker, render the production
# .env, build images, request the first Let's Encrypt cert, and bring the
# stack up.
#
# Usage (from the VPS):
#   git clone https://github.com/<owner>/WebScrapingDinamico-Automatico.git /opt/scraper
#   cd /opt/scraper
#   DOMAIN=bi.example.com EMAIL=admin@example.com bash deploy/vps-init.sh
#
# Idempotent: re-running after a partial failure picks up where it left off.
# Safe to re-run after the initial deploy to refresh secrets.

set -euo pipefail

REPO_DIR="/opt/scraper"
GITHUB_REPO="${GITHUB_REPO:-$(git -C . config --get remote.origin.url 2>/dev/null || echo '')}"
DOMAIN="${DOMAIN:?Usage: DOMAIN=bi.example.com EMAIL=admin@example.com bash deploy/vps-init.sh}"
EMAIL="${EMAIL:?Usage: DOMAIN=bi.example.com EMAIL=admin@example.com bash deploy/vps-init.sh}"

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

# docker compose v2 is bundled with the docker-compose-plugin package above.
if ! docker compose version >/dev/null 2>&1; then
  fatal "docker compose v2 not available. Install docker-compose-plugin."
fi

# ─── 2. Clone the repo if we are not already inside it ─────────────────────
if [ ! -f docker-compose.prod.yml ]; then
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

  # Append the new prod-only variables (DOMAIN, EMAIL for certbot, CORS).
  cat >> .env <<EOF

# ─── Production (added by vps-init.sh) ──────────────────────────────────
DOMAIN=${DOMAIN}
EMAIL=${EMAIL}
CORS_ORIGIN=https://${DOMAIN}
API_BASE_URL=/api
EOF
  chmod 600 .env
  log ".env written. Backing up to /root/.env.backup (1Password/Bitwarden recommended)."
  cp .env /root/.env.backup
else
  log ".env already exists — leaving untouched."
  # Make sure DOMAIN is present (idempotent re-runs may need to refresh it).
  if ! grep -q "^DOMAIN=" .env; then
    echo "DOMAIN=${DOMAIN}" >> .env
  fi
fi

# ─── 4. Pre-flight DNS check ──────────────────────────────────────────────
RESOLVED_IP=$(dig +short "${DOMAIN}" | head -n1)
PUBLIC_IP=$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me || echo "")
if [ -z "${RESOLVED_IP}" ]; then
  warn "DNS lookup for ${DOMAIN} returned no A record."
  warn "Certbot will fail until the domain points at this VPS."
  warn "Current public IP: ${PUBLIC_IP:-unknown}"
elif [ -n "${PUBLIC_IP}" ] && [ "${RESOLVED_IP}" != "${PUBLIC_IP}" ]; then
  warn "DNS for ${DOMAIN} resolves to ${RESOLVED_IP}, but this VPS is ${PUBLIC_IP}."
  warn "Let's Encrypt will refuse to issue a cert until they match."
else
  log "DNS OK: ${DOMAIN} → ${RESOLVED_IP}"
fi

# ─── 5. Bring the stack up ─────────────────────────────────────────────────
log "Building images (this can take 5-10 minutes on a small VPS)..."
docker compose -f docker-compose.prod.yml pull --ignore-pull-failures || true
docker compose -f docker-compose.prod.yml build --pull

log "Starting postgres + backend + frontend (without the proxy)..."
docker compose -f docker-compose.prod.yml up -d postgres postgres-dw
# Wait for both DBs to be healthy before starting the backend (which runs migrations).
for i in {1..30}; do
  if docker compose -f docker-compose.prod.yml ps postgres | grep -q "(healthy)" \
     && docker compose -f docker-compose.prod.yml ps postgres-dw | grep -q "(healthy)"; then
    log "Both Postgres instances healthy."
    break
  fi
  sleep 2
done

docker compose -f docker-compose.prod.yml up -d backend frontend

# Wait for backend healthcheck to pass (the API endpoint is the cheapest probe).
log "Waiting for backend to be ready..."
for i in {1..60}; do
  if docker compose -f docker-compose.prod.yml exec -T backend wget -q -O- http://localhost:3000/health 2>/dev/null | grep -q "ok\|OK"; then
    log "Backend is up."
    break
  fi
  if [ "$i" -eq 60 ]; then
    warn "Backend health check did not pass in 120s. Continuing anyway; check 'docker compose logs backend'."
  fi
  sleep 2
done

# ─── 6. Issue the first Let's Encrypt certificate ─────────────────────────
log "Requesting Let's Encrypt certificate for ${DOMAIN}..."

# The proxy MUST be running so certbot can hit /.well-known/acme-challenge/
docker compose -f docker-compose.prod.yml up -d proxy

# Give nginx a moment to bind :80.
sleep 5

docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot --webroot-path=/var/www/certbot \
  --email "${EMAIL}" --agree-tos --no-eff-email \
  -d "${DOMAIN}"

# Restart proxy so it picks up the new cert files.
log "Restarting proxy with the new certificate..."
docker compose -f docker-compose.prod.yml restart proxy

# ─── 7. Final summary ──────────────────────────────────────────────────────
log "═══════════════════════════════════════════════════════════════"
log "  Stack is up."
log ""
log "  Dashboard:  https://${DOMAIN}"
log "  API:        https://${DOMAIN}/api"
log "  Backup env: /root/.env.backup"
log ""
log "  Useful commands:"
log "    docker compose -f docker-compose.prod.yml ps"
log "    docker compose -f docker-compose.prod.yml logs -f backend"
log "    docker compose -f docker-compose.prod.yml restart proxy"
log "═══════════════════════════════════════════════════════════════"