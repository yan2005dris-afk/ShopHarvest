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
│   ├── url-input/                   # Página para pegar URL
│   │   ├── url-input.component.ts
│   │   ├── url-input.component.html
│   │   └── url-input.component.css
│   └── visual-mapper/               # Visual DOM mapper
│       ├── visual-mapper.component.ts
│       ├── visual-mapper.component.html
│       └── visual-mapper.component.css
└── services/
    └── api.service.ts               # Servicio HTTP base
```

## Páginas

### url-input
Página inicial donde el usuario pega la URL del sitio que quiere scrapear (ej: `https://www.temu.com/product-xxx.html`). Al enviar, se comunica con el backend para:
1. Obtener el HTML estático de la URL (vía worker)
2. Redirigir al `visual-mapper` con ese HTML

### visual-mapper
El corazón del sistema. Renderiza el HTML de la página objetivo en un entorno seguro (iframe sandbox) y permite al usuario:
- Hacer clic en elementos para identificar el título
- Hacer clic en elementos para identificar el precio
- Hacer clic en la imagen
- Confirmar los selectores CSS/XPath generados
- Guardar la regla en el backend

## Servicios

### ApiService
Servicio singleton que envuelve `HttpClient` de Angular y apunta al backend NestJS.

```typescript
export class ApiService {
  private baseUrl = '/api';

  getDomains(): Observable<DomainRule[]> { ... }
  createDomain(rule: CreateDomainDto): Observable<DomainRule> { ... }
  createJob(url: string, domainRuleId: string): Observable<ScrapingJob> { ... }
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
