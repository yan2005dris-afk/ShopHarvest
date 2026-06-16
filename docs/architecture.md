# Arquitectura del Sistema

## Visión General

Plataforma ETL semi-automatizada para extracción visual de datos en sitios de e-commerce (Temu, Shein y afines). El sistema permite al usuario mapear visualmente los selectores CSS de una página web, guardar esas reglas por dominio, y luego ejecutar extracciones batch automatizadas.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Angular    │ ──▶ │   NestJS     │ ──▶ │   RabbitMQ   │ ──▶ │   Worker     │
│  (Frontend)  │     │  (Backend)   │     │   (Cola)     │     │  (Crawlee)   │
└──────┬───────┘     └──────┬───────┘     └──────────────┘     └──────┬───────┘
       │                    │                                         │
       │    Render DOM      │         ┌──────────────┐               │
       │    + Selector      │         │  PostgreSQL  │               │
       └────────────────────┼────────▶│   (Prisma)   │◀──────────────┘
                            │         └──────────────┘
                            │                                  (Guarda datos
                            ▼                                   extraídos)
                     ┌──────────────┐
                     │   Grafana /  │
                     │  Superset    │
                     │  (Futuro)    │
                     └──────────────┘
```

## Capas del Sistema

### 1. Capa de Presentación — Angular 22
Interfaz de usuario donde el usuario pega URLs de e-commerce, visualiza el DOM renderizado de la página objetivo, y selecciona visualmente los elementos que quiere extraer (precio, título, imagen). Genera reglas CSS/XPath que se envían al backend.

### 2. Capa de Orquestación — NestJS 11
API REST que recibe las reglas del frontend, las persiste en PostgreSQL, y encola trabajos de extracción en RabbitMQ. No hace scraping directo — delega esa responsabilidad al worker para no bloquear el hilo principal.

### 3. Capa de Mensajería — RabbitMQ
Cola de mensajes que desacopla el backend del worker. NestJS publica mensajes en la cola `scraping-jobs` y el worker los consume cuando tiene capacidad. Esto permite:
- Procesamiento asíncrono
- Escalado horizontal del worker
- Tolerancia a fallos (los mensajes no se pierden)

### 4. Capa de Ejecución — Worker Crawlee + Playwright
Microservicio Node.js que escucha la cola de RabbitMQ. Cuando recibe un trabajo, levanta un navegador headless con Playwright, navega a la URL objetivo, aplica los selectores CSS definidos en la regla, y extrae los datos estructurados.

### 5. Capa de Persistencia — PostgreSQL + Prisma ORM
Base de datos relacional con dos dominios de datos:
- **Configuración**: Reglas de extracción por dominio (selectores CSS/XPath)
- **Negocio**: Catálogo de productos normalizados e historial de precios

### 6. Capa de Analítica — Grafana/Superset (Futuro)
Conexión directa de lectura a PostgreSQL para dashboards de precios, comparativas entre plataformas y alertas.

## Principios de Diseño

1. **Separación de responsabilidades**: Cada capa hace una cosa y la hace bien.
2. **Desacoplamiento por cola**: El backend nunca espera por el worker.
3. **Reglas dinámicas**: Los selectores no están hardcodeados — se guardan por dominio y pueden modificarse sin desplegar código.
4. **Datos normalizados**: Sin importar de qué sitio vengan, todos los productos tienen la misma estructura.
