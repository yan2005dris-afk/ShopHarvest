# Plan de Consolidación del Pipeline de Scraping en el Backend NestJS

> Objetivo: consolidar la lógica de scraping (hoy en `legacy/pipeline/`) dentro del
> backend NestJS como código nativo.
>
> **Requisitos firmes:**
>
> 1. **MELI y AliExpress** scrapean su **target de producción REAL** con Playwright.
> 2. **Temu y Shein** se scrapean con la **extensión Chrome** del usuario (humano
>    scrapeando, backend consume `extension_export.json`). Sin Playwright, sin proxy
>    residencial, sin sitios demo.
> 3. **Cero fallback a datos demo** (`quotes.toscrape.com` u otro). Si el export no
>    existe o la corrida real falla → **error explícito logueado, nunca relleno falso**.
> 4. (CSV y Encuesta no son sitios: son cargadores de archivos y se conservan como tales.)

---

## 1. Diagnóstico de las fuentes actuales

La lógica real vive en `legacy/pipeline/scripts/scraping/`. El backend solo tiene
adapters delgados que la invocan vía `pipeline-scripts-bridge.ts` (hoy roto).

Clasificación por "realidad" del scrapeo:

| Fuente | Target | Scrapeo real | Comportamiento |
| --- | --- | --- | --- |
| **MercadoLibre** | `mercadolibre.com.ec` (producción) | ✅ Sí | Playwright dinámico + evasión anti-bot (User-Agent, delays aleatorios, movimiento de mouse, scroll). Selectores con fallback en cascada. |
| **ExchangeRates** | `exchangerate-api.com` / `open.er-api.com` | ✅ Sí (API) | Llamada HTTP real vía axios. Datos vivos de tasas. |
| AliExpress | `books.toscrape.com` | ⚠️ Parcial | Playwright real, pero contra un sitio demo académico, no e-commerce real. |
| Temu | `extension_export.json` (producido por extensión Chrome del usuario) | ✅ Asistido | **El usuario scrapea con la extensión.** El backend solo consume el export. Sin Playwright. |
| Shein | `extension_export.json` (producido por extensión Chrome del usuario) | ✅ Asistido | Mismo modelo: humano scrapea, backend consume export. Sin Playwright. |
| CSV Dataset | archivo local Kaggle | ❌ No | Carga de archivo estructurado. |
| Encuesta | archivo local | ❌ No | Carga + anonimización. |

### Conclusión — modelo de scraping por tipo de fuente

Estado objetivo (alineado con la decisión de alcance del usuario):

| Sitio | Estado hoy | Estado objetivo | Mecanismo | Dificultad anti-bot |
| --- | --- | --- | --- | --- |
| **MercadoLibre** | Real ✅ | Real (`mercadolibre.com.ec`) | Playwright | Baja–media (ya manejado) |
| **AliExpress** | Demo (`books.toscrape`) | **Real (`aliexpress.com`)** | Playwright | Media (JS pesado, geo/i18n, lazy load) |
| **Temu** | Export precargado ❌ | **Export desde extensión Chrome** | Extensión + `extension_export.json` | N/A (humano scrapea) |
| **Shein** | Export precargado ❌ | **Export desde extensión Chrome** | Extensión + `extension_export.json` | N/A (humano scrapea) |

- **`ExchangeRates`** — dato vivo de apoyo (conversión a USD en staging). Se conserva.
- **CSV / Encuesta** — no son sitios; se conservan como cargadores de archivos.

> 💡 **Por qué Temu/Shein NO usan Playwright.** Requieren técnicas de *stealth* +
> proxies residenciales rotativos (costo mensual: $30-270 USD según proveedor y
> frecuencia). Para el alcance académico de esta entrega, el camino más honesto es
> que **el usuario scrapee con la extensión Chrome** y el backend consuma el export.
> El plan documenta el upgrade a Playwright como follow-up si en el futuro hay
> presupuesto y necesidad operativa.

---

## 2. Estado actual del backend

Arquitectura hexagonal correcta (puertos/tokens/adapters con DI). El problema es la
ubicación del código y el puente en runtime.

```
backend/src/modules/pipeline/
├── pipeline.module.ts          # Wiring DI: DATA_SOURCES[], DW_LOADER, STAGING_PROCESSOR
├── pipeline.service.ts         # Orquestador: runAll / runScraper / runStaging / loadDw
├── pipeline.controller.ts      # 5 endpoints REST
├── etl-scheduler.service.ts    # Scheduling ETL
├── pipeline-scripts-bridge.ts  # ⚠️ ROTO — require() runtime a ruta inexistente
├── interfaces/                 # IDataSource, IDwLoader, IStagingProcessor, *Result
└── adapters/
    ├── data-sources/           # 7 adapters delgados (llaman al bridge)
    ├── dw-loader.adapter.ts
    └── staging-processor.adapter.ts
```

### ⚠️ Bug bloqueante: el bridge apunta a una ruta que no existe

`pipeline-scripts-bridge.ts:47` resuelve:

```
resolve(__dirname, '..','..','..', 'pipeline', 'scripts')
→ backend/pipeline/scripts/     ← NO EXISTE
```

Los scripts fueron movidos a `legacy/pipeline/scripts/` (commit `405f875 "mov"`).
Cualquier ejecución real de scraping/staging/DW por el bridge lanza error de `require`.

El bridge además usa `eval('require')` + `ts-node` en runtime para compilar `.ts` al
vuelo. Esto es frágil, oculta errores del compilador y no sobrevive a un build de
producción (`nest build` → `node dist`). **Se elimina en la consolidación.**

---

## 3. Estrategia de consolidación

Convertir cada script legacy en **código nativo del backend** (dentro del adapter o de
un servicio de dominio que el adapter usa), eliminando el bridge y el `require()` en
runtime. El scraping pasa a ser TypeScript compilado normal del backend.

### Principio rector

> El adapter deja de ser una cáscara que delega en un `.ts` externo. Pasa a **contener
> o importar estáticamente** la lógica de scraping, tipada y compilada por el backend.

---

## 4. Fases

### Fase 0 — Preparación

- [ ] Instalar dependencias reales en `backend/package.json`:
  `playwright`, `playwright-extra`, `puppeteer-extra-plugin-stealth`, `axios`,
  `csv-parse` (y `playwright install chromium` en CI/Docker).
- [ ] Definir env de scraping: `SCRAPER_PROXY_URL` (proxy residencial rotativo,
  opcional por sitio), `SCRAPER_HEADLESS`, timeouts y `maxItems` por fuente.
- [ ] Confirmar que `@web-scraping/contracts/pipeline` (tokens, `PipelineSource`,
  `ScrapeResult`, `SourceConfig`) está publicado y resoluble desde el backend.
- [ ] Definir `backend/pipeline/raw/` y `staging/` como directorios de salida
  versionados por config (env `PIPELINE_RAW_DIR`, `PIPELINE_STAGING_DIR`), no rutas
  hardcodeadas a `process.cwd()`.

### Fase 1 — MercadoLibre (scraper real, prioridad máxima)

- [ ] Mover `legacy/pipeline/scripts/scraping/mercadolibre.ts` + `_base.ts`
  (`saveToRaw`, `logError`, `randomDelay`, `USER_AGENT`) a
  `backend/src/modules/pipeline/scraping/` como módulos TS nativos.
- [ ] Reescribir `meli.adapter.ts` para **importar estáticamente** `scrapeMercadoLibre`
  (sin bridge, sin `require`).
- [ ] Parametrizar por config/env: categorías/URLs objetivo, `maxItems`,
  `acceptLanguage`, timeouts. Hoy las `CATEGORIES` están hardcodeadas y una apunta a
  `_Tienda_temu` (revisar: parece residuo, no una categoría de tecnología real).
- [ ] Endurecer selectores y agregar reintentos con backoff ante `HTTP >= 400` /
  bloqueo anti-bot. Registrar métricas de items extraídos por corrida.
- [ ] Persistir resultado (raw + Prisma) y devolver `ScrapeResult` tipado.

### Fase 2 — ExchangeRates (API real)

- [ ] Migrar `exchangerates.ts` a `api-rates.adapter.ts` nativo con axios.
- [ ] Mover `API_KEY` a `ConfigService` (env), con fallback a `open.er-api.com`.
- [ ] Cachear la tasa por corrida para que staging la consuma (conversión a USD).

### Fase 3 — Temu / Shein → extensión Chrome (humano scrapea, backend consume)

- [ ] **MANTENER** la lectura de `extension_export.json` como flujo primario.
  La extensión Chrome del usuario es quien scrapea el sitio real.
- [ ] **ELIMINAR por completo** el fallback a `quotes.toscrape.com` y a
  `quotes.toscrape.com/login`. Eso es demo data y va contra la regla firme.
- [ ] Reescribir ambos adapters para **leer el export y nada más**: validar
  estructura (`products[]`, `source`, `capturedAt`), persistir raw + Prisma,
  devolver `ScrapeResult` tipado.
- [ ] Si el `extension_export.json` no existe o no es válido → **error explícito
  logueado**. Nunca rellenar con datos inventados, nunca fallback a demo.
- [ ] Documentar en el README el flujo para el usuario:
  `1) abrir Temu/Shein en el browser con la extensión, 2) ejecutar scraper en la
  página, 3) la extensión exporta JSON, 4) el adapter del backend lo procesa`.
- [ ] Marcar estos adapters con un **"MECHANISM: extension"** en `source-meta.ts`
  para distinguirlos claramente de los Playwright (MELI/AliExpress) y CSV.
- [ ] 📌 **Follow-up documentado** (no en esta entrega): upgrade a Playwright con
  stealth + proxy residencial si en el futuro hay presupuesto operativo.

### Fase 4 — AliExpress → scrapeo real (`aliexpress.com`)

- [ ] Cambiar el target de `books.toscrape.com` (demo) a **`aliexpress.com` real**.
- [ ] Reescribir el adapter nativo con Playwright: manejo de i18n/geo, lazy-load
  (scroll para cargar tarjetas), selectores robustos, esperas dinámicas.
- [ ] Aplicar la capa stealth del `BrowserFactoryService` (ver §5) — el proxy
  residencial queda como opt-in vía `SCRAPER_PROXY_SERVER`.

### Fase 5 — Cargadores de archivos (CSV / Encuesta)

- [ ] Migrar `load_csv.ts` y `load_encuesta.ts` a adapters nativos con `csv-parse`.
- [ ] Preservar la anonimización de la encuesta.
- [ ] Marcarlos claramente como *fuentes de archivo*, no scrapers.

### Fase 6 — Staging, Calidad y DW

- [ ] Migrar `scripts/staging/` → `staging-processor.adapter.ts` (normalización,
  conversión USD, clasificación, dedup por clave compuesta).
- [ ] Migrar `scripts/quality/` (7 controles + logger) a un servicio de calidad
  inyectable, integrado con el `Logger` de NestJS.
- [ ] Migrar `scripts/dw/` (`dw_schema.sql`, `dw_load_staging.ts`) → `dw-loader.adapter.ts`
  usando Prisma / cliente SQL del backend.

### Fase 7 — Orquestación, scheduling y limpieza

- [ ] Verificar `pipeline.service.ts` (`runAll`, `runScraper`, `runStaging`, `loadDw`)
  contra los adapters nativos.
- [ ] Configurar `etl-scheduler.service.ts` (cron) para corridas reales programadas.
- [ ] **Eliminar `pipeline-scripts-bridge.ts`** y toda referencia a `ts-node`/`eval`.
- [ ] Retirar `legacy/pipeline/` una vez migrado y verde (o archivarlo como histórico).
- [ ] Actualizar `legacy/packages/contracts/` → confirmar que el contrato vivo es
  `@web-scraping/contracts` (no la copia en `legacy/`).

### Fase 8 — Tests y verificación

- [ ] Tests unitarios por adapter (mock de Playwright/axios).
- [ ] Test de integración de `MercadoLibre` contra una corrida real controlada
  (o fixture de HTML capturado) — validar que extrae > 0 items.
- [ ] Verificar build de producción: `nest build && node dist` ejecuta el pipeline
  sin `ts-node`.

---

## 5. Implementación de referencia — stealth + proxy (MELI / AliExpress)

Aplica solo a los adapters con Playwright (MELI, AliExpress). Temu/Shein usan el flujo
de extensión Chrome y no necesitan browser automation.

### 5.1 Stealth por defecto; proxy residencial opcional

`playwright-extra` + `puppeteer-extra-plugin-stealth` se aplican **siempre** porque
reducen fingerprint detectable (navigator.webdriver, plugins, languages) sin costo.

El **proxy residencial rotativo** es **opcional** y se activa solo si `SCRAPER_PROXY_SERVER`
está seteado. Sirve como upgrade cuando:

- MELI empieza a devolver 403 / challenges en corridas repetidas desde una IP de VPS.
- AliExpress bloquea por geo/IP en contenido i18n.

Si `SCRAPER_PROXY_SERVER` no está seteado, el `BrowserFactoryService` arranca
**sin proxy** (MELI/AliExpress funcionan así en alcance académico).

### 5.2 Proveedor y rotación (referencia para upgrade futuro)

No se maneja una lista de IPs. El proveedor (BrightData, Oxylabs, Smartproxy/Decodo,
IPRoyal) entrega **un gateway** `host:port`. La rotación ocurre **del lado del
proveedor**, codificada en el **username**:

| Modo | Username (ejemplo) | IP | Uso |
| --- | --- | --- | --- |
| **Rotating** (por request) | `customer-XXXX-cc-ec` | nueva cada conexión | Listados: MELI, AliExpress |
| **Sticky session** | `customer-XXXX-session-abc123` | misma por N min | Flujos con login (no aplica a MELI/AliExpress) |

Playwright solo apunta al gateway; la rotación es transparente.

### 5.3 Configuración (env)

```dotenv
# backend/.env
# Stealth siempre activo; proxy opcional
SCRAPER_PROXY_SERVER=                          # vacío = sin proxy. BrightData/Oxylabs si se setea
SCRAPER_PROXY_USERNAME=customer-XXXX-cc-ec{session}  # {session} → reemplazado por launch
SCRAPER_PROXY_PASSWORD=
SCRAPER_HEADLESS=true
```

### 5.4 Dependencias

```bash
pnpm --filter backend add playwright-extra puppeteer-extra-plugin-stealth
```

### 5.5 `BrowserFactoryService` (centraliza proxy + stealth)

No repetir el `launch` en cada adapter. Un único servicio inyectable centraliza proxy,
stealth y fingerprint; todos los adapters lo consumen.

`backend/src/modules/pipeline/scraping/browser-factory.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext } from 'playwright';

chromium.use(stealth());

export interface BrowserOptions {
  /** true → sticky IP (flujos con login). false → rotate per launch. */
  stickySession?: boolean;
  acceptLanguage?: string;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

@Injectable()
export class BrowserFactoryService {
  private readonly logger = new Logger(BrowserFactoryService.name);

  constructor(private readonly config: ConfigService) {}

      /**
       * Launch a stealth browser. The residential proxy is OPTIONAL: only attached
       * when SCRAPER_PROXY_SERVER is set. Used by MELI/AliExpress adapters. Temu/Shein
       * do not call this — they consume the Chrome extension export.
       */
      async launch(opts: BrowserOptions = {}): Promise<Browser> {
        const headless = this.config.get('SCRAPER_HEADLESS') !== 'false';
        const server = this.config.get<string>('SCRAPER_PROXY_SERVER');
        const useProxy = Boolean(server);

        const launchOptions: Parameters<typeof chromium.launch>[0] = { headless };
        if (useProxy) {
          launchOptions.proxy = {
            server: server as string,
            username: this.buildUsername(opts.stickySession),
            password: this.config.get<string>('SCRAPER_PROXY_PASSWORD'),
          };
          this.logger.log('Launching browser with residential proxy');
        } else {
          this.logger.log('Launching browser WITHOUT proxy (SCRAPER_PROXY_SERVER not set)');
        }

        return chromium.launch(launchOptions);
      }

  /** New context with realistic fingerprint (UA, locale, viewport). */
  async newContext(browser: Browser, opts: BrowserOptions = {}): Promise<BrowserContext> {
    return browser.newContext({
      userAgent: USER_AGENT,
      locale: opts.acceptLanguage ?? 'es-EC',
      viewport: { width: 1366, height: 768 },
      extraHTTPHeaders: { 'Accept-Language': opts.acceptLanguage ?? 'es-EC,es;q=0.9' },
    });
  }

  /**
   * Inject a session id into the username template so the provider
   * keeps (sticky) or drops (rotating) the IP. The `{session}`
   * placeholder in SCRAPER_PROXY_USERNAME is replaced per launch.
   */
  private buildUsername(sticky = false): string {
    const template = this.config.get<string>('SCRAPER_PROXY_USERNAME') ?? '';
    const session = sticky ? `-session-${Date.now().toString(36)}` : '';
    return template.replace('{session}', session);
  }
}
```

### 5.6 Uso en un adapter (AliExpress con Playwright + stealth)

```ts
// En ali.adapter.ts:
const browser = await this.browserFactory.launch();
const context = await this.browserFactory.newContext(browser, {
  acceptLanguage: 'es-EC',
});
const page = await context.newPage();
// ... scrape real aliexpress.com con retries + backoff ...
await browser.close();
```

Registrar `BrowserFactoryService` en `providers` de `pipeline.module.ts`.

### 5.7 Puntos críticos

- **Stealth por defecto, proxy opcional.** El factory nunca falla por falta de
  proxy; lo agrega solo si `SCRAPER_PROXY_SERVER` está seteado. Esto es compatible
  con el alcance académico (MELI/AliExpress funcionan sin proxy al inicio).
- **Rotating para listados.** Si en el futuro se activa proxy para AliExpress, usar
  rotating (cada launch nueva IP). Sticky solo si se agrega un flujo con login.
- **Costo por GB (si se activa proxy).** Residencial se cobra por ancho de banda:
  bloquear imágenes/CSS/fonts con `route.abort()` para no quemar datos.
- **Stealth ≠ invisible.** Sumar `randomDelay` y esperas por selector real
  (`waitForSelector`), no `waitForTimeout` fijo.
- **Temu/Shein NO entran al factory.** Esos adapters leen `extension_export.json`,
  no lanzan browser.

---

## 6. Resultado esperado

- **MELI y AliExpress** scrapean su **target de producción REAL** con Playwright
  - stealth. AliExpress migra de `books.toscrape.com` (demo) a `aliexpress.com`.
- **Temu y Shein** se scrapean con la **extensión Chrome** del usuario. El backend
  consume `extension_export.json` producido por la extensión. Sin Playwright,
  sin proxy, sin sitios demo.
- **ExchangeRates** consume la API viva con axios. Se conserva tal cual.
- **CSV y Encuesta** se migran como cargadores de archivo nativos con `csv-parse`.
- **Cero** fallback a datos demo en el flujo productivo. Ante corrida real
  fallida → error explícito logueado, nunca relleno falso.
- Pipeline compilado nativamente en el backend (sin bridge ni `require()` en runtime).
- `legacy/` retirado o archivado.

---

## 7. Decisiones

### 7.1 Decididas (2026-07-08)

- **Temu/Shein**: scraping con extensión Chrome (humano scrapea, backend consume
  `extension_export.json`). Sin Playwright, sin proxy residencial. Si el export
  no existe → error explícito.
- **MELI/AliExpress**: Playwright real con stealth por defecto. Proxy residencial
  opcional (se activa con `SCRAPER_PROXY_SERVER`). Sin presupuesto requerido para
  esta entrega.
- **Estructura de trabajo**: dos SDD changes secuenciales:
  1. `pipeline-consolidation` (este plan) — backend.
  2. `multi-scraper-menus` (pausado) — frontend, se retoma al terminar este.
- **Branch**: `feat/bi-dashboard-analytics` (mismo branch que el Entregable 5).

### 7.2 Pendientes de confirmar

1. **Frecuencia del scheduler**: ¿cada cuánto corren los scrapers reales?
   Recomendación: cada 6-12h para MELI/AliExpress.
2. **`legacy/`**: ¿archivar tras migración o borrar? Recomendación: archivar
   (es evidencia del Entregable 3 y referencia histórica).
