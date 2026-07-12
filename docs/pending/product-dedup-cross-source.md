# Product Dedup Cross-Source

## Problema

Hoy no existe deduplicación entre distintos sources (Temu, Shein, ML, etc.) ni entre
distintas URLs del mismo source. Cada item ingerido crea un nuevo `Product` +
`Offer`, aunque sea el mismo producto físico.

Único dedup actual: `@@unique([sourceId, url])` sobre `Offer`. Si el mismo
(source, url) se re-ingiere, se actualiza en lugar de duplicar. Pero la URL es
artificial: `${pageUrl}#${titleSlug}-${index}`, no la URL real del producto.

## Impacto

- El mismo producto scrapeado desde Temu y MercadoLibre aparece como dos
  `Product` separados en la DB
- No se puede responder "¿cuánto varió el precio de este producto entre sitios?"
- Las cards de producto duplican entradas visualmente iguales

## Posibles approaches

### 1. SKU / GTIN / EAN (ideal)

Si el sitio expone un código de producto único (GTIN, SKU, ASIN, ID interno),
usarlo como clave de dedup cross-source. Requiere:

- Identificar el campo en cada source
- Mapearlo a `Offer.sku` (ya existe el campo)
- Agregar un índice unique compuesto: `@@unique([sourceId, sku])` no alcanza
  porque cada source tiene su propio SKU. Se necesita un índice global sobre
  `Product` tipo `externalId` o una tabla de equivalencias.

### 2. Product URL real

En vez de inventar la URL como `${pageUrl}#${titleSlug}-${index}`, usar la URL
real del producto (la del link "Ver producto"). Requiere:

- El mapper debe apuntar al link del producto, no solo al título
- Guardar la URL real en `Offer.url`
- Dedup por URL normalizada (mismo dominio, mismo path)

### 3. Fuzzy matching (título + imagen + precio)

Agrupar candidatos por similitud de título (Levenshtein, cosine similarity),
confirmar con coincidencia de imagen (hash perceptual) y precio cercano.
Requiere:

- Post-procesamiento asíncrono (no en el ingest hot path)
- Un threshold de confianza configurable
- Revisión manual para falsos positivos

### 4. URL del sitio + nombre

Si el source provee URLs únicas por producto (ej: `temu.com/producto/123`),
usar esas para dedup incluso entre distintos listings.

## Próximo paso

Definir prioridad: ¿hace falta ya o alcanza con el estado actual?


---

Fecha: 2026-07-12
