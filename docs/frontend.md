# Frontend — Angular 22

## Tecnología

**Angular 22** con **standalone components** (sin NgModules). Usa el nuevo `@angular/build` (basado en Vite) y TypeScript 6.0.

**Por qué Angular:**
- Estructura opinada y consistente para proyectos grandes
- Sistema de módulos/componentes que escala bien
- HttpClient y routing integrados
- CLI madura con generación de código
- TypeScript como lenguaje nativo

## Estructura

```
frontend/src/app/
├── app.config.ts                    # Providers globales (HttpClient, router)
├── app.routes.ts                    # Definición de rutas
├── app.ts                           # Componente raíz
├── pages/
│   └── visual-mapper/               # Página principal — integración con extensión
│       ├── visual-mapper.component.ts
│       ├── visual-mapper.component.html
│       └── visual-mapper.component.css
└── services/
    └── api.service.ts               # Servicio HTTP base
```

## Páginas

### visual-mapper
Página principal que se comunica con la **extensión Chrome Visual Scraper** para iniciar sesiones de mapeo:

1. El usuario pega una URL de e-commerce
2. El frontend inicia una sesión de mapeo via `chrome.runtime.connectExternal`
3. La extensión abre la URL en una nueva pestaña con el content script activo
4. El usuario selecciona elementos visualmente (overlay highlight + menú flotante)
5. Las asignaciones se envian en tiempo real al frontend via puerto nativo
6. Al finalizar, la regla se guarda en el backend

## Comunicación con la Extensión

### Handshake
El content script de la extensión se anuncia al frontend via `window.postMessage`:

```typescript
// Content script envía
window.postMessage({ type: '__VS_READY__', extensionId: chrome.runtime.id }, '*');

// Frontend responde con ping
window.postMessage({ type: '__VS_PING__' }, '*');
```

### Sesión de mapeo (puerto nativo)
```typescript
const port = chrome.runtime.connect(extensionId, { name: 'mapping-session' });
port.postMessage({ type: 'OPEN_MAPPER', payload: { url } });

port.onMessage.addListener((msg) => {
  if (msg.type === 'FIELD_ASSIGNED') { /* actualizar UI */ }
  if (msg.type === 'MAPPING_COMPLETE') { /* guardar regla */ }
});
```

## Servicios

### ApiService
Servicio singleton que envuelve `HttpClient` de Angular y apunta al backend NestJS.

```typescript
export class ApiService {
  private baseUrl = '/api';

  getDomains(): Observable<DomainRule[]> { ... }
  createDomain(rule: CreateDomainDto): Observable<DomainRule> { ... }
  getProducts(): Observable<Product[]> { ... }
}
```

## Proxy de Desarrollo

En desarrollo, Angular corre en `localhost:4200` y el backend en `localhost:3000`. El archivo `proxy.conf.json` redirige todas las peticiones `/api/*` al backend:

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false
  }
}
```
