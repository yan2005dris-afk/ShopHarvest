# Arquitectura del Sistema

## Visión General

Plataforma ETL semi-automatizada para extracción visual de datos en sitios de e-commerce (Temu, Shein y afines). El usuario mapea visualmente los selectores CSS de una página web mediante una **extensión de Chrome**, guarda esas reglas por dominio, y ejecuta extracciones desde el popup de la extensión directamente en la página real del navegador.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                          │
│  ┌──────────┐  chrome.runtime.sendMessage  ┌──────────────────┐  │
│  │  Popup   │◀────────────────────────────▶│  Service Worker   │  │
│  │  (UI)    │                              │  (background.js)  │  │
│  └────┬─────┘                              └────────┬─────────┘  │
│       │                                            │             │
│       │ chrome.tabs.sendMessage                     │ chrome.runtime.sendMessage
│       ▼                                            ▼             │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                  Content Script (mapper.ts)                   │  │
│  │  Se inyecta en <all_urls>, overlay de selección visual       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
        ↕ chrome.runtime.connectExternal      ↕ fetch API
┌────────────────┐                      ┌──────────────────────┐
│    Angular     │  chrome.runtime      │   NestJS Backend     │
│   (Frontend)   │  .connectExternal    │   (API REST :3000)   │
│   :8080/4200   │◀────────────────────▶│                      │
│               │                      │   PostgreSQL 16       │
│  Inicia sesión │                      │   + Prisma ORM       │
│  de mapeo vía  │                      │                      │
│  puerto nativo │                      └──────────────────────┘
└────────────────┘
```

## Componentes del Sistema

### 1. Extensión Chrome (MV3) — Visual Scraper
El cerebro del sistema. Se ejecuta en el navegador real del usuario, lo que evita bloqueos por CAPTCHA (Temu, Shein, Cloudflare).

Tres capas internas:
- **Service Worker** (`background/`): Gestiona sesiones de mapeo, almacenamiento en `chrome.storage.local`, y relay de mensajes entre popup, content script y Angular.
- **Content Script** (`content/mapper.ts`): Se inyecta en `<all_urls>`. Proporciona overlay visual para seleccionar elementos (highlight azul, menú flotante para asignar campos). Ejecuta la extracción de datos usando los selectores guardados. Se comunica con Angular via `window.postMessage`.
- **Popup** (`popup/`): Interfaz rápida para iniciar mapeo, guardar reglas, extraer datos, ver resultados y exportar a CSV.

### 2. Angular 22 (Frontend)
Interfaz de usuario principal. Se comunica con la extensión via `chrome.runtime.connectExternal` para iniciar sesiones de mapeo visual. También consume la API REST del backend para CRUD de reglas y productos.

### 3. NestJS 11 (Backend)
API REST que recibe reglas y productos desde el frontend y la extensión, los persiste en PostgreSQL. Ya **no** tiene worker ni RabbitMQ — la extracción la hace la extensión directamente en el navegador del usuario.

### 4. PostgreSQL + Prisma ORM
Base de datos relacional con dos dominios de datos:
- **Configuración**: Reglas de extracción por dominio (`fieldMappings` + `containerSelector`)
- **Negocio**: Productos normalizados e historial de precios

## Principios de Diseño

1. **Extracción en el navegador real**: La extensión ejecuta scraping en la sesión autenticada del usuario, sin CABEZA — cero CAPTCHAs.
2. **Desacoplamiento por API**: El frontend y la extensión se comunican con el backend vía REST, no hay cola de mensajes.
3. **Reglas dinámicas**: Los selectores no están hardcodeados — se guardan como `fieldMappings` (campo canónico + selector + tipo) y pueden modificarse sin desplegar código.
4. **Datos normalizados**: Sin importar de qué sitio vengan, todos los productos tienen la misma estructura.
