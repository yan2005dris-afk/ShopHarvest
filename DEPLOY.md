# Despliegue en VPS (producción)

Guía para llevar la plataforma completa a un VPS Ubuntu con Docker. Cubre
el primer despliegue y el ciclo de actualizaciones vía GitHub Actions.

> **TL;DR**: configurar DNS en Cloudflare → crear tunnel en tu máquina local →
> `ssh vps "bash deploy/vps-init.sh"` → listo.

---

## Prerrequisitos

| Componente | Mínimo |
|---|---|
| SO | Ubuntu 22.04 LTS o 24.04 LTS |
| CPU / RAM | 2 vCPU / 4 GB |
| Disco | 40 GB SSD |
| Docker | 24.x + compose v2 (lo instala `vps-init.sh` si falta) |
| Dominio en Cloudflare | DNS gestionado por Cloudflare (free tier alcanza) |

---

## Arquitectura

```
                Internet
                   │
                   ▼
            ┌──────────────┐
            │  Cloudflare  │  ← TLS, DDoS, CDN (gratis)
            │     Edge     │     + ingress rules (dashboard)
            └──────┬───────┘
                   │  Tunnel cifrado (sin puertos abiertos en el VPS)
                   ▼
            ┌──────────────┐
            │  cloudflared │  ← perfil "tunnel" (opcional)
            │              │     solo necesita TUNNEL_TOKEN,
            │              │     descarga ingress del edge
            └──────┬───────┘
                   │  red interna Docker
                   ▼
            ┌──────────────┐
            │   frontend   │  ← nginx sirviendo el SPA + proxy /api/*
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │   backend    │  ← NestJS (no expone puerto al host)
            └─┬──────────┬─┘
              │          │
              ▼          ▼
         ┌─────────┐ ┌──────────┐
         │postgres │ │postgres-dw│
         └─────────┘ └──────────┘
```

**Diferencias con un deploy tradicional con nginx + certbot:**

| | nginx + certbot (viejo) | Cloudflare Tunnel (actual) |
|---|---|---|
| Puertos abiertos en el VPS | 80, 443 | **ninguno** |
| Gestión de certificados | certbot + cron | automática por Cloudflare |
| DDoS protection | manual (fail2ban, etc.) | incluido gratis |
| CDN de estáticos | no | incluido |
| HTTPS automático | requiere config | por default |
| Coste mensual | solo el VPS | solo el VPS |

---

## Paso 1 — DNS en Cloudflare

1. Crear cuenta gratuita en [dash.cloudflare.com](https://dash.cloudflare.com).
2. Agregar tu dominio (cambiar los nameservers en el registrador a los de Cloudflare).
3. Esperar la propagación (puede tomar hasta 24 h, usualmente minutos).

---

## Paso 2 — Crear el Tunnel (en tu máquina local)

```bash
# 1. Instalar cloudflared
# Linux:
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared focal main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

# macOS: brew install cloudflared
# Windows: choco install cloudflared

# 2. Login (abre el navegador)
cloudflared tunnel login

# 3. Crear el tunnel
cloudflared tunnel create scraper-bi
#   → Imprime: "Created tunnel scraper-bi with id a1b2c3d4-..."
#   → Genera ~/.cloudflared/<UUID>.json con las credenciales

# 4. Obtener el TUNNEL_TOKEN
# El cloudflared de Docker acepta cualquiera de estos formatos en TUNNEL_TOKEN:
#   (a) Token corto: pega el <UUID> que imprimió el paso anterior
TUNNEL_TOKEN="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
#   (b) O el JSON completo serializado en una línea:
TUNNEL_TOKEN=$(cat ~/.cloudflared/<UUID>.json | jq -c .)

# 5. Configurar el routing (modo remoto via dashboard, RECOMENDADO)
# En vez de mantener un config.yml en el contenedor, configurás el
# routing directamente en Cloudflare y el cloudflared lo descarga del edge:
#   - Ir a https://one.dash.cloudflare.com → Networks → Tunnels
#   - Click en "scraper-bi"
#   - Pestaña "Public Hostname" → Add a public hostname:
#       Subdomain: bi
#       Domain:    example.com
#       Service:   http://frontend:80
#   - Save

# 5'. (Alternativa) Modo local con config.yml
# Si preferís tener el routing en un archivo (más control, más boilerplate):
#   cloudflared tunnel route dns scraper-bi bi.example.com
# Y montar un config.yml en el contenedor (no incluido por defecto).
```

> **TUNNEL_TOKEN**: en modo dashboard (recomendado) alcanza con el `<UUID>`
> del paso 3. En modo local hace falta el JSON completo.
> **Ingress rules**: en modo dashboard se configuran en la UI; en modo
> local se configuran en `~/.cloudflared/config.yml` montado en el contenedor.

---

## Paso 3 — Clonar el repo en el VPS

```bash
ssh deploy@bi.example.com
sudo mkdir -p /opt/scraper
sudo chown deploy:deploy /opt/scraper
git clone https://github.com/yan2005dris-afk/WebScrapingDinamico-Automatico.git /opt/scraper
cd /opt/scraper
```

> Usuario `deploy` no necesita sudo. Docker se opera desde el grupo `docker`
> (lo agrega `vps-init.sh` si corres con root).

---

## Paso 4 — Bootstrap (`vps-init.sh`)

```bash
bash deploy/vps-init.sh
```

El script hace TODO: instala Docker si falta, genera un `.env` con
contraseñas aleatorias, construye las imágenes, levanta Postgres + backend +
frontend.

**Sobre el tunnel:** si pegaste el JSON de credenciales en `TUNNEL_TOKEN=` antes
de correr el script, también levanta `cloudflared`. Si lo dejás vacío,
arranca todo lo demás y la app queda accesible en `http://<vps-ip>:8080` para
que puedas validar antes de configurar el tunnel.

Tarda entre 5 y 15 minutos. Al final imprime:

```
═══════════════════════════════════════════════════════════════
  Stack is up.

  Local access:    http://localhost:8080    (o http://<vps-ip>:8080)
  Public access:   https://bi.example.com   (vía Cloudflare Tunnel)
  Backup env:      /root/.env.backup
═══════════════════════════════════════════════════════════════
```

---

## Paso 5 — Configurar el TUNNEL_TOKEN (si lo dejaste vacío)

Si arrancaste sin tunnel y querés agregarlo después:

```bash
ssh deploy@bi.example.com
cd /opt/scraper

# Editar .env y pegar el token (ver Paso 2 para obtenerlo)
nano .env

# Levantar solo el servicio cloudflared
docker compose up -d cloudflared

# Ver logs del tunnel
docker compose logs -f cloudflared
# Deberías ver "Connection established" en 10-30 segundos.
```

---

## Paso 6 — Verificación post-deploy

```bash
# Estado de los contenedores
docker compose ps

# Logs del backend (si algo no responde)
docker compose logs --tail=50 backend

# Probar el endpoint de salud
curl -fsS http://localhost:8080/api/health          # vía nginx local
curl -fsS https://bi.example.com/api/health         # vía Cloudflare Tunnel
```

Abrí `https://bi.example.com` en el navegador. Deberías ver el dashboard con
los datos del DW.

---

## Operación

```bash
# Arrancar todo el stack (5 servicios, incluido cloudflared):
docker compose up -d

# Si TUNNEL_TOKEN está vacío, cloudflared mantiene un restart loop
# hasta que lo configures. El resto del stack funciona normal.
```

---

## Actualizaciones (CI/CD vía GitHub Actions)

Configurá 4 secrets en `Settings → Secrets and variables → Actions`:

| Secret | Ejemplo | Descripción |
|---|---|---|
| `VPS_SSH_KEY` | `-----BEGIN OPENSSH...` | Llave SSH **privada** autorizada en el VPS (sin passphrase) |
| `VPS_HOST` | `203.0.113.42` | IP del VPS (no el hostname, para evitar dependencia del DNS) |
| `VPS_USER` | `deploy` | Usuario SSH (miembro del grupo `docker`) |
| `VPS_DEPLOY_PATH` | `/opt/scraper` | Carpeta donde está clonado el repo |

**Generar el par de llaves** (en tu máquina local):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/scraper_deploy -N ""
ssh-copy-id -i ~/.ssh/scraper_deploy.pub deploy@<vps-ip>
# Pegar el contenido de la privada en el secret VPS_SSH_KEY:
cat ~/.ssh/scraper_deploy
```

**Ciclo automático**:

1. Pusheás un commit a `main`.
2. GitHub Actions se conecta al VPS por SSH.
3. Hace `git pull --ff-only`, `docker compose build`, `docker compose up -d`.
4. Zero-downtime para servicios no tocados.

---

## Rollback manual

```bash
ssh deploy@<vps-ip>
cd /opt/scraper
git log --oneline -5
git checkout <commit-anterior>
docker compose up -d --build
```

---

## Troubleshooting

### "tunnel: connection error" en logs de cloudflared

- `TUNNEL_TOKEN` mal copiado. Pegalo completo, sin saltos de línea.
- DNS no apuntando al tunnel: verificá en Cloudflare dashboard que el CNAME `bi.example.com → <UUID>.cfargotunnel.com` existe.
- Firewall del VPS bloqueando conexiones salientes a Cloudflare:
  ```bash
  sudo ufw allow out 7844/tcp  # tunnel protocol
  sudo ufw allow out 443/tcp   # HTTPS for tunnel metadata
  ```

### "404 Not Found" en https://bi.example.com

El tunnel está conectado pero cloudflared no sabe qué servir. Verificá que
el servicio `frontend` está corriendo:

```bash
docker compose ps frontend
docker compose logs frontend
```

### "502 Bad Gateway" al abrir el dashboard

Frontend arrancó antes que backend. Reintentá en 30 s; si persiste:

```bash
docker compose restart backend
docker compose restart cloudflared
```

### "CORS error" en la consola del navegador

`CORS_ORIGIN` no coincide con el dominio actual. Editá `.env`:

```bash
CORS_ORIGIN=https://bi.example.com   # sin slash final, https incluido
docker compose up -d --no-deps backend
```

### "PrismaClientInitializationError"

Backend arrancó antes que Postgres. Esperá al healthcheck o reiniciá:

```bash
docker compose restart backend
```

### Disco lleno (logs de Docker)

```bash
docker system prune -af --volumes    # ⚠ borra imágenes sin usar, NO volúmenes nombrados
docker volume ls                      # postgres_data + postgres_dw_data están safe
```

---

## Backup de los datos

Los volúmenes Docker `postgres_data` y `postgres_dw_data` viven en
`/var/lib/docker/volumes/`. Para un backup lógico diario:

```bash
docker compose exec postgres \
  pg_dump -U scraper scraperdb | gzip > backup-op-$(date +%F).sql.gz

docker compose exec postgres-dw \
  pg_dump -U scraper scraperdw | gzip > backup-dw-$(date +%F).sql.gz
```

Automatizá con cron + rclone a S3, B2, etc.

---

## Variables de entorno — referencia rápida

| Var | Requerida | Default | Propósito |
|---|---|---|---|
| `POSTGRES_PASSWORD` | sí | — | DB operacional (auto-gen por vps-init) |
| `POSTGRES_DW_PASSWORD` | sí | — | DB DW (auto-gen por vps-init) |
| `JWT_SECRET` | sí | `change-me-...` | Firma de JWT (rotar antes de prod) |
| `TUNNEL_TOKEN` | sí para tunnel | vacío | Credenciales del tunnel (modo remoto, ingress rules en dashboard) |
| `CORS_ORIGIN` | opcional | — | Origins CORS permitidos (vacío = permissive en backend) |
| `API_BASE_URL` | opcional | `/api` | URL de la API baked en el bundle JS |
| `NODE_ENV` | — | `production` | Auto-set por el compose |
| `ETL_CRON_SCHEDULE` | opcional | `0 2 * * *` | Cuándo corre el ETL automático |