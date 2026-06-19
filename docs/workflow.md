# Flujo de Trabajo

> ⚠️ El worker Crawlee + RabbitMQ fueron eliminados. La extracción ahora la realiza la **extensión Chrome** directamente en el navegador del usuario.

Este documento explica el recorrido completo de los datos a través del sistema, desde que el usuario mapea los campos hasta que los datos extraídos están disponibles en la base de datos.

## Fase 1: Mapeo Visual (vía frontend Angular)

El usuario define las reglas de extracción desde la interfaz web de Angular, que se comunica con la extensión Chrome.

```
Usuario            Frontend Angular          Extensión (SW)        Página Target
  │                     │                        │                    │
  │  1. Pega URL        │                        │                    │
  │────────────────────▶│                        │                    │
  │                     │  2. connectExternal    │                    │
  │                     │  OPEN_MAPPER {url}     │                    │
  │                     │───────────────────────▶│                    │
  │                     │                        │  3. Crea tab      │
  │                     │                        │  con la URL        │
  │                     │                        │───────────────────▶│
  │                     │                        │                    │
  │                     │                        │  4. START_MAPPING  │
  │                     │                        │  (content script)  │
  │                     │                        │◀───────────────────│
  │                     │                        │                    │
  │                     │                        │                    │
  │  5. Usuario hace    │                        │                    │
  │     clic en         │◀── FIELD_ASSIGNED ─────│◀── FIELD_ASSIGNED  │
  │     elementos       │    (tiempo real)       │    (tiempo real)   │
  │                     │                        │                    │
  │  6. Confirma regla  │                        │                    │
  │────────────────────▶│                        │                    │
  │                     │  7. POST /api/domains  │                    │
  │                     │───────────────────────▶│                    │
  │                     │       (Backend)        │                    │
  │                     │                        │                    │
  │                     │  8. Guarda DomainRule  │                    │
  │                     │  (fieldMappings +      │                    │
  │                     │   containerSelector)   │                    │
```

## Fase 2: Mapeo Visual (vía popup de la extensión)

Flujo alternativo — el usuario trabaja directamente desde el popup de la extensión sin abrir Angular.

```
Usuario            Popup Extensión          Service Worker       Página Target
  │                     │                        │                    │
  │  1. Abre popup      │                        │                    │
  │     en la página    │                        │                    │
  │────────────────────▶│                        │                    │
  │                     │  2. START_MAPPING      │                    │
  │                     │───────────────────────────────────────────▶│
  │                     │                        │                    │
  │  3. Clic en         │◀── FIELD_ASSIGNED ─────│◀── FIELD_ASSIGNED  │
  │     elementos       │                        │                    │
  │                     │                        │                    │
  │  4. Save Rule       │                        │                    │
  │────────────────────▶│  5. SAVE_RULE          │                    │
  │                     │───────────────────────▶│                    │
  │                     │                        │  6. chrome.storage │
  │                     │                        │     .local.set()   │
```

## Fase 3: Extracción de Datos

El usuario extrae productos de la página actual usando una regla ya guardada.

```
Usuario            Popup Extensión          Service Worker       Página Target     Backend NestJS
  │                     │                        │                    │                │
  │  1. Extract Data    │                        │                    │                │
  │────────────────────▶│                        │                    │                │
  │                     │  2. EXTRACT {rule}     │                    │                │
  │                     │───────────────────────────────────────────▶│                │
  │                     │                        │                    │                │
  │                     │                        │                    │  3. Recorre     │
  │                     │                        │                    │     containers  │
  │                     │                        │                    │     y extrae    │
  │                     │                        │                    │     campos      │
  │                     │                        │                    │                │
  │                     │  4. Productos          │                    │                │
  │                     │◀───────────────────────────────────────────│                │
  │                     │                        │                    │                │
  │                     │  5. POST /products/    │                    │                │
  │                     │     ingest             │                    │                │
  │                     │─────────────────────────────────────────────────────────────▶│
  │                     │                        │                    │                │
  │                     │                        │                    │  6. Persiste    │
  │                     │                        │                    │     Product +   │
  │                     │                        │                    │     PriceHistory│
  │                     │                        │                    │                │
  │  7. Tabla con       │                        │                    │                │
  │     datos           │                        │                    │                │
  │◀────────────────────│                        │                    │                │
```

## Fase 4: Consulta y Analítica

Los datos extraídos están disponibles para consumo desde el frontend Angular o API.

```
Dashboard / API            Backend NestJS            PostgreSQL
  │                              │                      │
  │  1. GET /api/products        │                      │
  │─────────────────────────────▶│                      │
  │                              │  2. SELECT *         │
  │                              │─────────────────────▶│
  │                              │                      │
  │  3. Productos normalizados   │                      │
  │◀─────────────────────────────│                      │
  │                              │                      │
  │  4. GET /api/products/:id/history                   │
  │─────────────────────────────▶│                      │
  │                              │  5. SELECT * FROM    │
  │                              │  price_history       │
  │                              │─────────────────────▶│
```

## Formatos de Datos

### DomainRule (guardada en API y chrome.storage.local)

```json
{
  "domain": "www.temu.com",
  "containerSelector": "div.product-card",
  "fieldMappings": [
    { "canonicalField": "title", "selector": "h2.title", "type": "text" },
    { "canonicalField": "price", "selector": "span.price-now", "type": "text" },
    { "canonicalField": "imageUrl", "selector": "img.main-img", "type": "attribute", "attribute": "src" }
  ]
}
```

### Producto extraído

```json
{
  "title": "Auriculares Bluetooth Pro",
  "price": 29.99,
  "imageUrl": "https://img.temu.com/product.jpg",
  "sku": "TM-12345"
}
```

## Escenarios de Error

| Problema | Comportamiento |
|----------|----------------|
| Extensión no instalada | El frontend muestra mensaje "Extension not found" y link para instalar |
| Service worker dormido (MV3) | La conexión puede fallar — reintentar con timeout |
| Selector no encontrado | El campo se omite en el resultado (producto parcial) |
| Backend caído | La extensión sigue funcionando offline (chrome.storage.local). Los datos se sincronizan cuando el backend vuelve |
| Página no carga | El content script no se inyecta — mostrar error en el popup |
