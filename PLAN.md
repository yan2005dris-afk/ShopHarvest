# Plan de mejora — WebScrapingDinamico-Automatico

## Arquitectura actual

```
Usuario → Angular (puerto 8080) → Backend NestJS (puerto 3000) → PostgreSQL
              ↕ (chrome.runtime.connectExternal)
         Extensión Chrome (service-worker → content-script → página target)
```

El worker + RabbitMQ fueron eliminados. La extensión reemplazó `fetch-page`.

---

## Fase 1 — Base de datos

### 1.1 Limpiar campos legacy ❗ Prioridad alta

| Modelo | Campo | Acción |
|--------|-------|--------|
| `DomainRule.selectorTitle` | `String?` | Eliminar (reemplazado por `fieldMappings`) |
| `DomainRule.selectorPrice` | `String?` | Eliminar |
| `DomainRule.selectorImage` | `String?` | Eliminar |
| `DomainRule.selectorSku` | `String?` | Eliminar |
| `DomainRule.selectorType` | `String` | Eliminar (default fijo "css", nunca cambia) |
| `DomainRule.paginationType` | `String` | Mantener por ahora (puede servir para scroll automático) |
| `DomainRule.paginationSelector` | `String?` | Mantener |

### 1.2 Eliminar modelo `ScrapingJob` ❗

Worker eliminado, `ScrapingJob` quedó huérfano. Nadie procesa los jobs. Opciones:
- **Opción A (recomendada)**: Eliminar tabla y todo el módulo
- **Opción B**: Repurposear como "log de scraping" para la extensión

### 1.3 Migraciones

- Generar migración con `prisma migrate dev` para aplicar cambios
- Verificar que los datos existentes no se pierdan

---

## Fase 2 — Backend

### 2.1 Limpiar `DomainsService` y `DomainsController` ❗

- Eliminar `selectorTitle`, `selectorPrice`, `selectorImage`, `selectorSku` de los tipos del `create()` y `update()`
- Eliminar `selectorType` de los tipos
- `fieldMappings` y `containerSelector` pasan a ser los campos principales

### 2.2 Eliminar módulo `ScrapingJobs` ❗

- Eliminar `scraping-jobs/` (service, controller, dto, module)
- Eliminar `ScrapingJobsModule` de `app.module.ts`
- Eliminar líneas de `scrape-listing` (depende de scraping-jobs)

### 2.3 Endpoints faltantes

| Endpoint | Método | Propósito |
|----------|--------|-----------|
| `GET /domains/:id/products` | GET | Productos de una regla específica |
| `DELETE /domains/:id/products` | DELETE | Limpiar productos de una regla |
| `PATCH /products/:id` | PATCH | Editar producto manualmente (sku, precio, título) |

### 2.4 DTOs y validación

- Agregar DTOs con `class-validator` a todos los endpoints (missing en varios)
- Validar que `fieldMappings` sea un array válido

---

## Fase 3 — Frontend

### 3.1 Normalización post-mapeo ❗

**Estado actual**: Mapear campos → Save Rule → Done. Sin revisión de datos.

**Estado deseado**:
```
Mapear campos → Save Rule → Abrir página de la regla → Scrape → Ver resultados → Editar → Aceptar
```

Flujo nuevo en visual-mapper:
1. Guardar regla → no ir a "done" inmediatamente
2. Mostrar opción "Scrape now" que abre la URL target con la extensión
3. La extensión extrae productos usando `EXTRACT` con la regla guardada
4. Mostrar tabla con datos extraídos para revisión/edición
5. Confirmar y persistir productos

### 3.2 Tabla de datos extraídos (nuevo componente) ❗

- Tabla con columnas dinámicas según `fieldMappings`
- Edición inline (click → edit → save)
- Paginación si hay muchos productos
- Checkbox para seleccionar cuáles guardar
- Botón "Re-scrape" si faltan datos

### 3.3 Estados del Visual Mapper

Estado actual: `idle → extension-mapping → mapping → saving → done → error`

Estado deseado: agregar `reviewing` (después de scraping, antes de persistir)

### 3.4 Productos page — mejoras

- Traducir a español o mantener consistencia (mezcla español/inglés actual)
- Filtro por dominio (actualmente solo search)
- Edición inline de productos
- Eliminación individual/múltiple
- Exportar a CSV
- Gráfico de precios (ya existe con chart.js, pulirlo)

### 3.5 Limpiar imports no usados

- `DatePipe`, `NgIf`, `NgFor` en varios componentes (warnings de Angular)
- Eliminar del `imports` array

### 3.6 UI/UX

- Loading skeletons en vez de spinners genéricos
- Notificaciones toast para acciones (guardado, error, scraping completado)
- Responsive: la página de productos no anda bien en mobile
- Estado vacío con ilustración/icono en lugar de solo texto

---

## Fase 4 — Extensión Chrome

### 4.1 Manejo de errores

- `onConnectExternal` → capturar errores de conexión y reintentar
- Timeout si el service worker está dormido (MV3)
- Mostrar "Extension not responding" en el frontend

### 4.2 Host permissions

- `public/manifest.json` ya lista `localhost:8080` y `localhost:4200`
- Agregar opción para que el usuario configure dominios extra

---

## Fase 5 — DevOps

### 5.1 Modo desarrollo

- Script `docker compose -f docker-compose.dev.yml` con hot-reload para Angular + backend
- Actualmente solo modo production con Nginx

### 5.2 Tests

- Backend: agregar tests unitarios a services (actualmente no hay)
- Frontend: tests básicos de componentes

---

## Prioridades

| # | Tarea | Esfuerzo | Impacto |
|---|-------|----------|---------|
| 1 | Eliminar campos legacy de DB + backend | Bajo | Alto — limpia el schema |
| 2 | Eliminar `ScrapingJob` module | Bajo | Alto — remueve código muerto |
| 3 | Normalización post-mapeo | Medio | Alto — flujo completo usable |
| 4 | Edición inline de productos | Medio | Alto — UX completa |
| 5 | Tabla de datos extraídos | Medio | Alto — necesario para validar datos |
| 6 | DTOs + validación en backend | Bajo | Medio — seguridad |
| 7 | UI responsive + skeletons | Medio | Medio — calidad visual |
| 8 | Export CSV | Bajo | Bajo — nice to have |
| 9 | Tests | Alto | Medio — calidad a largo plazo |
| 10 | Modo dev con hot-reload | Bajo | Medio — velocidad de desarrollo |

---

## Notas técnicas

- Angular 19 standalone components (sin NgModules)
- NestJS 11 con Prisma 7.8 + PostgreSQL
- Extensión MV3 con Vite + TypeScript
- `fieldMappings` es `Json?` en Prisma — se parsea como `FieldMapping[]` en el frontend
- La extensión se comunica por `chrome.runtime.connectExternal` → `onConnectExternal`
- Content script se inyecta en `<all_urls>` y usa `window.postMessage` para handshake con Angular
