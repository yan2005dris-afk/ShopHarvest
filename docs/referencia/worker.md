# Scraper — Extensión Chrome (content script)

> ⚠️ El worker Crawlee + Playwright headless fue **eliminado**. Reemplazado por la extensión Chrome que ejecuta scraping en el navegador real del usuario, evitando CAPTCHAs.

## Tecnología

**Chrome Extension MV3** — content script (`mapper.ts`) que se inyecta en `<all_urls>` y ejecuta tanto el mapeo visual como la extracción de datos directamente en la página real.

**Por qué extensión en vez de headless:**
- Los sitios de e-commerce (Temu, Shein) bloquean navegadores headless con Cloudflare/CAPTCHA
- La extensión corre en la sesión autenticada del usuario — cero bloqueos
- El usuario puede navegar, hacer login, y seleccionar elementos visualmente
- No requiere proxies residenciales ni fingerprinting

## Estructura

```
extension/src/
├── types.ts                # Tipos compartidos
├── background/
│   └── service-worker.ts   # Service Worker MV3 — sesiones + storage
├── content/
│   └── mapper.ts           # Content script — overlay + extracción
└── popup/
    ├── popup.html          # Interfaz del popup
    ├── popup.css           # Estilos
    └── popup.ts            # Lógica del popup
```

## Componentes

### mapper.ts (content script)
Se inyecta automáticamente en todas las páginas (`<all_urls>`).

#### Modo mapeo (START_MAPPING)
1. Escucha mensajes `chrome.runtime.onMessage`
2. Activa overlay de selección visual:
   - **Highlight**: rectángulo azul semi-transparente que sigue al mouse
   - **Menú flotante**: al hacer clic, muestra opciones para asignar el elemento a un campo (Title, Price, Image, SKU, Currency, Description, Container)
   - **Panel de estado** (modo frontend): muestra campos asignados y botón Finish
3. Genera selectores CSS automáticamente (por ID o ruta `tag:nth-child(n)`)
4. Envía asignaciones al service worker via `chrome.runtime.sendMessage`

#### Modo extracción (EXTRACT)
```typescript
function extractProducts(rule: DomainRule): ExtractedProduct[] {
  const containers = document.querySelectorAll(rule.containerSelector);
  for (const container of containers) {
    for (const mapping of rule.fieldMappings) {
      const el = container.querySelector(mapping.selector);
      // Extrae según type: text | attribute | html
    }
  }
}
```

#### Handshake con Angular
```typescript
window.postMessage({ type: '__VS_READY__', extensionId: chrome.runtime.id }, '*');
```

### service-worker.ts (background)
Gestiona:
- **Sesiones de mapeo**: Una a la vez. Abre la URL target en nueva pestaña, relay de mensajes entre content script y Angular via `onConnectExternal`
- **Almacenamiento**: Reglas y productos en `chrome.storage.local`
- **Mensajes IPC**: Relay de `FIELD_ASSIGNED`, `MAPPING_COMPLETE`, `MAPPING_CANCELLED`

### popup.ts
Interfaz rápida con tres vistas:
| Vista | Acción |
|-------|--------|
| **Home** | Iniciar mapeo, extraer datos, ver datos guardados |
| **Mapping** | Campos asignados (container, title, price...) con estado en vivo |
| **Data** | Tabla de productos extraídos, exportar CSV, limpiar |

## Flujo de Extracción

```
Popup (Extract Data)
  │
  ▼
contentMessage('EXTRACT', currentRule)
  │
  ▼
mapper.ts — querySelectorAll(containerSelector)
  │               │
  ▼               ▼
Por cada contenedor → Por cada fieldMapping → Extraer valor
  │
  ▼
POST /products/ingest → Backend NestJS → PostgreSQL
  │
  ▼
Popup muestra tabla con datos extraídos
```

## Comunicación

| Origen → Destino | Método | Propósito |
|------------------|--------|-----------|
| Popup → SW | `chrome.runtime.sendMessage` | CRUD de reglas/productos |
| Popup → Content | `chrome.tabs.sendMessage` | Iniciar/detener mapeo, extraer |
| Content → SW | `chrome.runtime.sendMessage` | FIELD_ASSIGNED, MAPPING_COMPLETE |
| SW → Angular | `chrome.runtime.connectExternal` | Sesión de mapeo desde frontend |
| Content → Angular | `window.postMessage` | Handshake (`__VS_READY__`) |
