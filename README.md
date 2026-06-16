# WebScrapingDinámico-Automático

Plataforma ETL semi-automatizada para extracción visual de datos en e-commerce (Temu, Shein y afines).

## Stack

| Capa           | Tecnología                          |
|----------------|--------------------------------------|
| Frontend       | Angular (visor HTML + selector CSS) |
| Backend        | NestJS (API REST/GraphQL)           |
| Worker         | Node.js + Crawlee (Playwright)      |
| Base de datos  | PostgreSQL + Prisma                 |
| Analítica      | Grafana / Apache Superset           |

## Arquitectura

Servicios independientes contenerizados (Podman/Docker) que se comunican por API y cola de tareas. El usuario selecciona visualmente elementos en una página renderizada, se guardan reglas dinámicas por dominio, y un worker batch extrae los datos con proxies evadiendo bloqueos.

## Flujo

1. **Mapeo visual** — el usuario ingresa una URL, el frontend renderiza el DOM, selecciona precio/título y se guarda la regla.
2. **Extracción batch** — un cron encola URLs, el worker las procesa con las reglas guardadas y proxies, los datos se insertan en PostgreSQL.

## Estado

🚧 En desarrollo — primer commit.
