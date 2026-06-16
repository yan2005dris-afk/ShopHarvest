# Flujo de Trabajo

Este documento explica el recorrido completo de los datos a través del sistema, desde que el usuario pega una URL hasta que los datos extraídos están disponibles en la base de datos.

## Fase 1: Mapeo Visual

El usuario define las reglas de extracción para un dominio nuevo.

```
Usuario                  Frontend                  Backend                Worker
  │                         │                         │                    │
  │  1. Pega URL            │                         │                    │
  │────────────────────────▶│                         │                    │
  │                         │  2. GET /api/preview     │                    │
  │                         │────────────────────────▶│                    │
  │                         │                         │  3. Encola preview │
  │                         │                         │───────────────────▶│
  │                         │                         │                    │ 4. Descarga HTML
  │                         │                         │                    │ 5. Devuelve HTML
  │                         │  6. HTML estático       │                    │
  │                         │◀────────────────────────│                    │
  │  7. Renderiza DOM       │                         │                    │
  │     en iframe           │                         │                    │
  │                         │                         │                    │
  │  8. Usuario hace clic   │                         │                    │
  │     en precio, título   │                         │                    │
  │     y imagen            │                         │                    │
  │                         │                         │                    │
  │  9. Confirma regla      │                         │                    │
  │────────────────────────▶│                         │                    │
  │                         │ 10. POST /api/domains   │                    │
  │                         │────────────────────────▶│                    │
  │                         │                         │                    │
  │                         │       11. Guarda        │                    │
  │                         │    DomainRule en DB      │                    │
  │                         │◀────────────────────────│                    │
  │  12. Regla guardada     │                         │                    │
  │◀────────────────────────│                         │                    │
```

## Fase 2: Extracción Batch

El sistema procesa URLs en lote usando las reglas ya definidas.

```
Usuario / Cron            Backend                   RabbitMQ                Worker              PostgreSQL
  │                         │                         │                    │                    │
  │  1. POST /api/jobs      │                         │                    │                    │
  │  { url, domainRuleId }  │                         │                    │                    │
  │────────────────────────▶│                         │                    │                    │
  │                         │  2. Publica mensaje     │                    │                    │
  │                         │  a cola scraping-jobs   │                    │                    │
  │                         │────────────────────────▶│                    │                    │
  │                         │                         │  3. Entrega msg    │                    │
  │                         │                         │───────────────────▶│                    │
  │                         │                         │                    │  4. scrapeUrl()    │
  │                         │                         │                    │  - Navega a URL    │
  │                         │                         │                    │  - Aplica selector │
  │                         │                         │                    │  - Extrae datos    │
  │                         │                         │                    │                    │
  │                         │                         │                    │  5. Guarda Product │
  │                         │                         │                    │  + PriceHistory    │
  │                         │                         │                    │───────────────────▶│
  │                         │                         │                    │                    │
  │                         │                         │  6. ACK mensaje    │                    │
  │                         │                         │◀───────────────────│                    │
  │  7. Job completado      │                         │                    │                    │
  │◀────────────────────────│                         │                    │                    │
```

## Fase 3: Consulta y Analítica

Los datos extraídos están disponibles para consumo.

```
Dashboard / API                Backend                      PostgreSQL
  │                              │                            │
  │  1. GET /api/products        │                            │
  │─────────────────────────────▶│                            │
  │                              │  2. SELECT * FROM products │
  │                              │───────────────────────────▶│
  │                              │                            │
  │  3. Productos normalizados   │                            │
  │◀─────────────────────────────│                            │
  │                              │                            │
  │  4. GET /api/products/:id/history  │                      │
  │─────────────────────────────▶│                            │
  │                              │  5. SELECT * FROM          │
  │                              │  price_history             │
  │                              │───────────────────────────▶│
  │                              │                            │
  │  6. Historial de precios     │                            │
  │◀─────────────────────────────│                            │
```

## Tipos de Datos

### Mensaje en RabbitMQ (ScrapingJob)

```json
{
  "jobId": "uuid-del-trabajo",
  "url": "https://www.temu.com/product-123",
  "domainRuleId": "uuid-de-la-regla",
  "selectors": {
    "title": ".product-title",
    "price": ".price-now",
    "image": ".main-image img",
    "sku": ".sku-code"
  },
  "selectorType": "css"
}
```

### Resultado del Scraping (ScrapedData)

```json
{
  "success": true,
  "title": "Auriculares Bluetooth Pro",
  "price": 29.99,
  "currency": "USD",
  "imageUrl": "https://img.temu.com/product.jpg",
  "sku": "TM-12345",
  "rawHtml": "<html>... (opcional, para debug)"
}
```

## Escenarios de Error

| Problema | Comportamiento |
|----------|----------------|
| Worker caído | Los mensajes se acumulan en RabbitMQ. Al reconectarse, procesa el backlog |
| Página no carga | Crawlee reintenta 3 veces con backoff exponencial |
| Selector no encontrado | El worker reporta `success: false` y NACK el mensaje |
| RabbitMQ caído | Backend lanza excepción al encolar. Worker intenta reconectar cada 5s |
| PostgreSQL caído | Worker no puede guardar. NACK el mensaje para re-procesar después |
