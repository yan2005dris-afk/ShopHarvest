# 🏗️ Análisis de Arquitectura — Alternativas a Chrome Extension

**Versión**: 1.0  
**Fecha**: 2026-07-21  
**Propósito**: Evaluar alternativas y proponer mejora arquitectónica

---

## 📋 Tabla de Contenidos

1. [Arquitectura Actual](#arquitectura-actual)
2. [Problemas Identificados](#problemas-identificados)
3. [Alternativas Evaluadas](#alternativas-evaluadas)
4. [Recomendación](#recomendación)
5. [Roadmap de Migración](#roadmap-de-migración)

---

## 🔄 Arquitectura Actual

```
┌──────────────────────────────────────────────────────────┐
│                    USUARIO                               │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  NAVEGADOR                          SERVIDOR             │
│  ┌─────────────────────┐           ┌─────────────────┐   │
│  │   Angular App       │           │   NestJS API    │   │
│  │   (localhost:4200)  │───HTTP───▶│  (localhost:    │   │
│  │                     │◀──────────│   3000)         │   │
│  └─────────────────────┘           └─────────────────┘   │
│  │                                        ▲               │
│  │                                        │               │
│  │  ┌──────────────────────────────┐     │               │
│  │  │  Extension Chrome MV3        │     │               │
│  │  ├──────────────────────────────┤     │               │
│  │  │ Background Service Worker    │─────┘               │
│  │  │ (chrome.alarms, auth token)  │                     │
│  │  ├──────────────────────────────┤                     │
│  │  │ Content Script               │                     │
│  │  │ (inject en página target)    │                     │
│  │  └──────────────────────────────┘                     │
│  │         ▲                                              │
│  │         │ window.postMessage +                        │
│  │         │ chrome.runtime.connect                      │
│  │         │                                              │
│  │  ┌──────▼──────────────────────┐                      │
│  │  │  Target Website             │                      │
│  │  │  (amazon.com, mercado, etc) │                      │
│  │  └─────────────────────────────┘                      │
│  └─────────────────────────────────────────────────────────┘
│                                                            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│            PostgreSQL + Redis                             │
└──────────────────────────────────────────────────────────┘
```

**Flujo**:
1. Usuario mapea en la extensión
2. Extension extrae del sitio target
3. Envía a NestJS (autenticado con JWT)
4. Backend ingesta en DB
5. Frontend ve datos en tiempo real

**Limitaciones**:
- ⚠️ Requiere instalación de extensión
- ⚠️ Múltiples navegadores = múltiples builds
- ⚠️ Comunicación compleja (postMessage + chrome.runtime)
- ⚠️ Debugging difícil
- ⚠️ Handshake puede fallar

---

## ⚠️ Problemas Identificados

### 1. **Complejidad de Instalación**

| Paso | Complejidad | Tiempo |
|------|-------------|--------|
| Chrome | Baixa → Descomprimir + Cargar | 2 min |
| Firefox | Media → UUID + Carpeta temp | 5 min |
| Edge | Baja → Similar a Chrome | 2 min |
| Safari | Alta → Requiere Xcode | 20+ min |

**Problema**: Usuario no técnico se pierde en pasos 🔴

### 2. **Comunicación Frágil**

```
window.postMessage → content-script → background → Angular
↑                                            ↓
└────────────── chrome.runtime.connect ──────┘
```

**Puntos de falla**:
- ❌ Content script no carga si sitio tiene CSP
- ❌ Handshake timeout
- ❌ Port desconecta aleatoriamente
- ❌ Background script duerme en MV3 (inactivity)

### 3. **Multi-Navegador = Multi-Build**

```
BROWSER=chrome pnpm package  → chrome.zip
BROWSER=firefox pnpm package → firefox.zip
BROWSER=edge pnpm package    → edge.zip
BROWSER=safari pnpm package  → safari.zip
```

**Costo**: 4x mantenimiento, 4x testing, 4x bugs potenciales

### 4. **Auto-Replay Débil**

```
chrome.alarms → background service worker
    ↓
    Problema: Service worker se duerme después de 5 min inactividad
    Solución: Hacer ping cada 4 minutos (overhead)
```

### 5. **No Funciona en Navegadores No-Chromium**

```
Safari:   Requiere Xcode + compilación
Firefox:  Instalación temporal (se olvida al reiniciar)
Mobile:   ❌ Sin soporte
```

---

## 🔍 Alternativas Evaluadas

### Alternativa 1: **Backend Scraping (Playwright/Puppeteer)**

#### Arquitectura

```
┌─────────────────────┐
│   Angular App       │
│   (localhost:4200)  │
└──────────┬──────────┘
           │ HTTP
           ▼
┌─────────────────────────────────────────┐
│         NestJS Backend                  │
├─────────────────────────────────────────┤
│ ├─ Playwright Server (headless Chrome)  │
│ ├─ Auto-replay scheduler                │
│ └─ Product ingestion pipeline           │
└────────────────┬────────────────────────┘
                 │
                 ▼
            Target Website
            (amazon.com, etc)
```

#### Pros ✅

| Ventaja | Impacto |
|---------|---------|
| **No requiere extensión** | 100% usuarios SIN instalación |
| **Escalable** | 1000+ scrapes paralelos en servidor |
| **Confiable** | Headless browser en server, sin fallos de comunicación |
| **Multi-sitio** | Un servidor scrape todos los sitios |
| **Auto-replay fácil** | Simple scheduler en backend, no chrome.alarms |
| **Mobile-compatible** | API funciona en cualquier cliente |
| **Centralizad** | Mantenimiento = solo 1 versión |

#### Contras ❌

| Desventaja | Impacto |
|-----------|---------|
| **CPU/RAM alto** | Playwright headless browser usa ~50-100MB por instancia |
| **No mapeo visual** | Usuario no ve en "vivo" qué se extrae |
| **Overhead servidor** | Aumenta carga backend significativamente |
| **Requiere API timeout alto** | Scrape puede tardar 10+ segundos |

#### Implementación

```typescript
// backend/src/modules/scraping/scraping.service.ts

import { Browser, chromium } from 'playwright';

@Injectable()
export class ScrapingService {
  private browser: Browser;

  async onModuleInit() {
    this.browser = await chromium.launch({ headless: true });
  }

  async scrapeRule(rule: DomainRule, url: string): Promise<ExtractedProduct[]> {
    const page = await this.browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      
      // Mapear campos usando selector CSS
      const products = await page.evaluate((fieldMappings) => {
        const containers = document.querySelectorAll(fieldMappings.containerSelector);
        return Array.from(containers).map(container => {
          const product = {};
          for (const mapping of fieldMappings.mappings) {
            const element = container.querySelector(mapping.selector);
            if (element) {
              product[mapping.canonicalField] = 
                mapping.type === 'text' ? element.textContent :
                mapping.type === 'attribute' ? element.getAttribute(mapping.attribute) :
                element.innerHTML;
            }
          }
          return product;
        });
      }, rule.fieldMappings);
      
      return products;
    } finally {
      await page.close();
    }
  }
}
```

#### Costo Estimado

```
CPU:  +30-50% (headless browsers)
RAM:  +500MB-1GB (pool de browsers)
Coding: 3-5 días (reemplazar extension por service)
```

---

### Alternativa 2: **User Script (Tampermonkey/Greasemonkey)**

#### Arquitectura

```
┌─────────────────────┐
│   Angular App       │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  Tampermonkey Extension (injected JS)    │
│  - Más fácil de instalar                 │
│  - Open source                           │
│  - Comunidad grande                      │
└──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│         NestJS API                       │
└──────────────────────────────────────────┘
```

#### Pros ✅

- Instalar = 1 click en Tampermonkey (no build por navegador)
- Más simple que MV3
- Debugging más fácil
- Comunidad activa

#### Contras ❌

- Requiere instalar Tampermonkey (otro paso)
- User scripts menos potentes que extensiones nativas
- No hay auto-replay fácil (no equivalent a chrome.alarms)
- Menos seguro (scripts se ven en la página)

#### Veredicto

Mejor que extensión nativa pero **no es ideal**. Sigue requiriendo instalación manual.

---

### Alternativa 3: **Hybrid: Backend Scraping + Simple Bookmarklet**

#### Arquitectura

```
Caso Simple (sin mapeo visual):
┌─────────────────────┐
│   Angular App       │
│  [Save Selector]    │
│  [Scrape Now]       │
└──────────┬──────────┘
           │ POST /api/scrape
           ▼
┌─────────────────────────────────────────┐
│ Backend (Playwright scraping)           │
│ - Ejecuta scraping automático           │
│ - Ingesta de productos                  │
│ - Auto-replay con cron                  │
└─────────────────────────────────────────┘
           ▲
           │
      Target Site

Caso Complejo (mapeo visual):
┌─────────────────────┐
│   Angular App       │
│   [Open Mapper]     │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────┐
│ Lightweight Script   │ ← Inyectado vía API (sin extensión)
│ (genera fieldMap)    │
│ [Click elemento]     │
│ [Finish]             │
└──────────┬───────────┘
           │ POST /api/mapping
           ▼
        Backend → Scrapea + ingesta
```

#### Implementación

**Sin extensión**: Script inyectado dinámicamente
```typescript
// frontend/src/app/pages/visual-mapper/visual-mapper.page.ts

async openMapperNoExtension(url: string) {
  // Abre la URL en tab nueva
  const tab = window.open(url, '_blank');
  
  // Inyecta script en la página
  const script = `
    window.addEventListener('click', (e) => {
      const selector = generateSelector(e.target);
      window.opener.postMessage({ 
        type: 'ELEMENT_SELECTED', 
        selector 
      }, '*');
    });
  `;
  
  // usuario selecciona elementos
  // cuando termina, click "Finish"
  // backend scrape con esos selectores
}
```

#### Pros ✅

- ✅ Backend controla scraping (confiable)
- ✅ No requiere extensión (instalación x)
- ✅ Auto-replay en backend (simple)
- ✅ Escalable

#### Contras ❌

- ⚠️ Mapeo visual menos fluido (back-and-forth)
- ⚠️ Script inyectado puede ser bloqueado por CSP

---

### Alternativa 4: **Desktop App (Electron)**

#### Arquitectura

```
MacOS / Windows / Linux
┌─────────────────────────────┐
│   Electron App              │
│  ├─ Main Process            │
│  ├─ Renderer (Angular 22)   │
│  └─ Preload Scripts         │
└──────────────┬──────────────┘
               │
               ├─ Webkit/Chromium embedded
               │  (no extension needed)
               │
               └─ NestJS API
```

#### Pros ✅

- ✅ No depender de navegador usuario
- ✅ Acceso a filesystem
- ✅ Poder computacional completo
- ✅ Mapeo visual perfecto

#### Contras ❌

- ❌ 150MB+ descargar
- ❌ Soporte OS múltiples = testing x3
- ❌ Overhead mantenimiento alto
- ❌ Usuarios odian "apps para todo"

---

## ✅ Recomendación

### **Opción Ganadora: Backend Scraping (Playwright)**

**Razón**: Máxima confiabilidad + escalabilidad + UX simplificada

#### Comparativa

```
┌────────────────────┬──────────┬──────────┬──────────┬──────────┐
│ Criterio           │ Current  │ Backend  │ Booklet  │ Electron │
├────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ Instalación        │ ❌ 5min  │ ✅ 0min  │ ⚠️ 2min  │ ❌ 5min  │
│ Confiabilidad      │ ⚠️ 70%   │ ✅ 99%   │ ⚠️ 75%   │ ✅ 98%   │
│ Auto-replay        │ ❌ Frágil│ ✅ Fácil │ ❌ No    │ ✅ Fácil │
│ Escalabilidad      │ ❌ Baja  │ ✅ Alta  │ ⚠️ Media │ ⚠️ Media │
│ Multi-navegador    │ ✅ Sí    │ ❌ N/A   │ ✅ Sí    │ ❌ No    │
│ Costo Dev          │ 0        │ +100h    │ +20h     │ +150h    │
│ Costo Servidor     │ bajo     │ +alto    │ bajo     │ muy alto │
│ UX Mapeo Visual    │ ✅ Excel │ ⚠️ OK    │ ⚠️ OK    │ ✅ Excel │
└────────────────────┴──────────┴──────────┴──────────┴──────────┘
```

---

## 🛣️ Roadmap de Migración

### Fase 1: Investigación (1 semana)

```
[ ] Testear Playwright con 10+ sitios reales
[ ] Medir CPU/RAM por browser instance
[ ] Diseñar pool strategy (connection pooling)
[ ] Crear PoC de scraping sin extension
```

### Fase 2: Backend Scraping (2-3 semanas)

```
[ ] Crear `ScrapingService` con Playwright
[ ] Endpoint: POST /api/scraping/execute (async)
[ ] Endpoint: GET /api/scraping/status/:jobId
[ ] Manejo de errores (timeout, CSP block, etc)
[ ] Tests unitarios + integration
```

### Fase 3: Scheduler Backend (1 semana)

```
[ ] Reemplazar chrome.alarms con NestJS cron (@Cron)
[ ] Endpoint: POST /api/schedules/:domainId
[ ] Storage: DB (no chrome.storage.local)
[ ] Ejecutar scrapes automáticas
```

### Fase 4: UX Simplificada (1-2 semanas)

```
[ ] Simplificar flujo: URL → Backend scrape → Preview
[ ] Dashboard de trabajos en progreso
[ ] Fallback a manual scraping si algo falla
[ ] Notificaciones cuando termina
```

### Fase 5: Deprecar Extension (1 semana)

```
[ ] Marcar extension como "legacy"
[ ] Migrar usuarios activos a backend
[ ] Remover código de MV3
[ ] Deprecar endpoint de extension
```

**Tiempo total**: 6-7 semanas  
**Esfuerzo**: 1 dev full-time

---

## 📊 Impacto

### Antes (Current)

```
Confiabilidad:  ⭐⭐⭐ (70%)
UX Instalación: ⭐ (manual 5+ min)
Escalabilidad:  ⭐⭐ (1 usuario = 1 browser)
Mantenimiento:  ⭐⭐ (4x builds)
```

### Después (Backend Scraping)

```
Confiabilidad:  ⭐⭐⭐⭐⭐ (99%)
UX Instalación: ⭐⭐⭐⭐⭐ (0 min, no extension)
Escalabilidad:  ⭐⭐⭐⭐⭐ (server pool)
Mantenimiento:  ⭐⭐⭐⭐ (1 versión)
```

---

## 🎯 Conclusión

### **Recomendación Final**

**MIGRAR a Backend Scraping (Playwright)** en siguiente sprint:

✅ **Ventajas principales**:
- Elimina complejidad de extension MV3
- Confiabilidad x3
- Auto-replay trivial
- Escalable: 1000+ scrapes simultáneos
- UX: 0 instalación (usuario nunca ve extension)

⚠️ **Trade-off**:
- Servidor necesita +50% CPU/RAM
- Requiere 6-7 semanas implementación
- CSP blocks en algunos sitios (mitigable con rotación IPs)

### **Alternativa si costo es problema**

**Hybrid (corto plazo)**:
```
1. Mantener extension MV3 (8-12 meses)
2. Implementar backend scraping en paralelo
3. Usuarios nuevos = backend
4. Usuarios viejos = gradualmente migrar
5. Deprecar extension cuando 80% estén en backend
```

---

## 📚 Recursos

### Playwright

- Docs: https://playwright.dev/
- Performance: https://playwright.dev/docs/performance
- Pool: https://github.com/microsoft/playwright/discussions

### NestJS Scheduling

- @Cron: https://docs.nestjs.com/techniques/task-scheduling
- RabbitMQ Jobs (alternativa): https://docs.nestjs.com/microservices/rabbitmq

### Testing

- Playwright Testing: https://playwright.dev/docs/intro

---

**Fecha de Revisión**: 2026-07-21  
**Próxima Revisión**: Después de completar Fase 1
