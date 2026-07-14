# Despliegue en VPS (producción)

Guía paso a paso para llevar la plataforma completa a un VPS Ubuntu con
Docker. Cubre el primer despliegue y el ciclo de actualizaciones vía
GitHub Actions.

> **TL;DR**: configurar DNS → `ssh vps "bash deploy/vps-init.sh"` → listo.

---

## Prerrequisitos

| Componente | Mínimo | Recomendado |
|---|---|---|
| SO | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disco | 40 GB SSD | 80 GB SSD |
| Ancho de banda | 100 Mbps | 1 Gbps |
| Docker | 24.x + compose v2 | igual |
| Dominio apuntando al VPS | A record | A + AAAA |

El VPS debe tener **Docker Engine** y **docker compose plugin** instalados
(lo hace `vps-init.sh` si faltan).

---

## Paso 1 — DNS

Apuntá un dominio (o subdominio) al VPS. Ejemplo con Cloudflare:

```
Tipo  Nombre  Contenido         Proxy
A     bi      203.0.113.42      DNS only   (gris, NO naranja — sino ACME falla)
```

> **Importante**: si usás Cloudflare, dejá el proxy **desactivado** (gris)
> durante el `certbot` inicial. Después podés activarlo si querés, pero el
> modo "Full (strict)" es el único compatible.

Verificá la propagación antes de continuar:

```bash
dig +short bi.example.com   # debe devolver 203.0.113.42
```

---

## Paso 2 — Clonar el repo en el VPS

```bash
ssh deploy@bi.example.com
sudo mkdir -p /opt/scraper
sudo chown deploy:deploy /opt/scraper
git clone https://github.com/yan2005dris-afk/WebScrapingDinamico-Automatico.git /opt/scraper
cd /opt/scraper
```

> Usuario `deploy` no debe tener sudo. Docker se opera desde el grupo
> `docker` (lo agrega `vps-init.sh` si corres con root).

---

## Paso 3 — Bootstrap (`vps-init.sh`)

El script hace TODO: instala Docker si falta, genera un `.env` con
contraseñas aleatorias, construye las imágenes, emite el primer
certificado Let's Encrypt, y arranca la stack.

```bash
DOMAIN=bi.example.com EMAIL=admin@example.com bash deploy/vps-init.sh
```

Tarda entre 5 y 15 minutos (la build de Angular + NestJS es lo más
lento en una VPS pequeña). Al final imprime:

```
═══════════════════════════════════════════════════════════════
  Stack is up.
  Dashboard:  https://bi.example.com
  API:        https://bi.example.com/api
  Backup env: /root/.env.backup
═══════════════════════════════════════════════════════════════
```

### Backup del `.env`

El `.env` contiene contraseñas de Postgres y la API key de Let's Encrypt.
**Copialo a un gestor de secretos** (1Password, Bitwarden, etc.) apenas
termine el bootstrap. El script deja una copia en `/root/.env.backup`
que NO se sincroniza con git (es `.gitignored`).

---

## Paso 4 — Verificación post-deploy

```bash
# Estado de los contenedores
docker compose -f docker-compose.prod.yml ps

# Logs del backend (si algo no responde)
docker compose -f docker-compose.prod.yml logs --tail=50 backend

# Probar el endpoint de salud
curl -fsS https://bi.example.com/api/health
```

Abrí `https://bi.example.com` en el navegador. Deberías ver el dashboard
con los datos del DW. Si la página carga pero el dashboard dice "Sin
datos", corré el ETL desde la UI o vía:

```bash
docker compose -f docker-compose.prod.yml exec backend \
  npx ts-node -P tsconfig.json src/scripts/trigger-etl.ts
```

---

## Actualizaciones (CI/CD vía GitHub Actions)

Configurá 4 secrets en `Settings → Secrets and variables → Actions`:

| Secret | Ejemplo | Descripción |
|---|---|---|
| `VPS_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----\n...` | Llave SSH **privada** que está autorizada en el VPS (sin passphrase) |
| `VPS_HOST` | `bi.example.com` | Hostname o IP del VPS |
| `VPS_USER` | `deploy` | Usuario SSH (miembro del grupo `docker`) |
| `VPS_DEPLOY_PATH` | `/opt/scraper` | Carpeta donde está clonado el repo |

**Generar el par de llaves** (en tu máquina local, NO en el VPS):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/scraper_deploy -N ""
# Subí la pública al VPS:
ssh-copy-id -i ~/.ssh/scraper_deploy.pub deploy@bi.example.com
# Pegá el contenido de la privada en el secret VPS_SSH_KEY:
cat ~/.ssh/scraper_deploy
```

**Ciclo**:

1. Pusheás un commit a `main`.
2. GitHub Actions se conecta al VPS por SSH.
3. Hace `git pull --ff-only`, `docker compose build`, `docker compose up -d`.
4. Renueva el cert automáticamente (el contenedor `certbot` corre un
   loop cada 12h).

---

## Rollback manual

Si una actualización rompe algo:

```bash
ssh deploy@bi.example.com
cd /opt/scraper
# Volver al commit anterior
git log --oneline -5
git checkout <commit-anterior>
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Troubleshooting

### "certbot: connection refused" en el primer deploy

- DNS no apunta al VPS. Verificá con `dig +short bi.example.com`.
- Cloudflare proxy (naranja) está activo. Ponelo en **DNS only** (gris).
- Puerto 80 bloqueado por firewall. Abrilo:
  ```bash
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw reload
  ```

### "502 Bad Gateway" al abrir el dashboard

El proxy arrancó antes que el backend. Reintentá en 30 s; si persiste:

```bash
docker compose -f docker-compose.prod.yml logs backend
docker compose -f docker-compose.prod.yml restart proxy
```

### "CORS error" en la consola del navegador

`CORS_ORIGIN` no coincide con el dominio actual. Editá `.env` en el VPS:

```bash
CORS_ORIGIN=https://bi.example.com   # sin slash final, https incluido
docker compose -f docker-compose.prod.yml up -d --no-deps backend
```

### "PrismaClientInitializationError: Can't reach database server"

El backend arrancó antes que Postgres. Esperá al healthcheck o reiniciá:

```bash
docker compose -f docker-compose.prod.yml restart backend
```

### Disco lleno (logs de Docker)

```bash
docker system prune -af --volumes    # ⚠ borra imágenes sin usar, no volúmenes nombrados
docker volume ls                      # postgres_data + postgres_dw_data están safe
```

---

## Backup de los datos

Los volúmenes Docker `postgres_data` y `postgres_dw_data` viven en
`/var/lib/docker/volumes/`. Para un backup lógico diario:

```bash
# Backup operacional
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U scraper scraperdb | gzip > backup-op-$(date +%F).sql.gz

# Backup DW
docker compose -f docker-compose.prod.yml exec postgres-dw \
  pg_dump -U scraper scraperdw | gzip > backup-dw-$(date +%F).sql.gz
```

Automatizá con un cron del VPS que mueva los `.sql.gz` a S3, B2 o
cualquier object storage (cron + rclone es la receta más simple).

---

## Variables de entorno — referencia rápida

| Var | Requerida | Default | Propósito |
|---|---|---|---|
| `DOMAIN` | sí (prod) | — | FQDN para nginx + certbot |
| `EMAIL` | sí (prod) | — | Contacto Let's Encrypt |
| `POSTGRES_PASSWORD` | sí | — | DB operacional (auto-generada por vps-init) |
| `POSTGRES_DW_PASSWORD` | sí | — | DB DW (auto-generada por vps-init) |
| `JWT_SECRET` | sí | `change-me-...` | Firma de JWT (rotar antes de prod) |
| `CORS_ORIGIN` | recomendado | `https://${DOMAIN}` | Origins permitidos |
| `API_BASE_URL` | opcional | `/api` | URL de la API baked en el bundle JS |
| `NODE_ENV` | — | `development` | Auto-set a `production` por el compose |
| `ETL_CRON_SCHEDULE` | opcional | `0 2 * * *` | Cuándo corre el ETL automático |