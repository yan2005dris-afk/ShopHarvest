#!/bin/sh
#
# Entrypoint for the public nginx proxy.
#
# Why this exists: nginx does not natively understand Docker-style ${VAR}
# substitutions in its config files, so we run `envsubst` over the template
# before starting nginx. The variables we substitute are whitelisted via the
# explicit `-e` flags so unrelated env vars from the host (which would
# contain $ signs in PostgreSQL connection strings, for example) do NOT
# accidentally replace tokens in the nginx config.

set -eu

# Required: DOMAIN must be set in the env (docker-compose.prod.yml reads it
# from .env). Fail loudly rather than rendering a broken config.
if [ -z "${DOMAIN:-}" ]; then
  echo "[proxy] FATAL: DOMAIN environment variable is required." >&2
  echo "[proxy] Set DOMAIN in .env to the FQDN pointing at this VPS." >&2
  exit 1
fi

echo "[proxy] Rendering nginx config for domain: ${DOMAIN}"

# Substitute ONLY the whitelisted variable (${DOMAIN}). Everything else is
# left alone, so $host, $remote_addr, $scheme (nginx built-ins) stay intact.
# Source template lives at /etc/nginx/templates/default.conf.template
# (mounted from docker/nginx.prod.conf); render to /etc/nginx/conf.d/default.conf
# which is the location nginx actually loads at startup.
envsubst '${DOMAIN}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# Test the rendered config so we don't ship a syntax error.
nginx -t

echo "[proxy] Starting nginx..."
exec nginx -g "daemon off;"