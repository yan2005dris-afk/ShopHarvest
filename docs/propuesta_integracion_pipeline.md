# Propuesta Técnica: Integración del Data Pipeline (ETL) en la Aplicación Web
**Proyecto:** Plataforma de Inteligencia de Negocios para Monitoreo de Precios  
**Componentes a Integrar:** NestJS (Backend), Angular (Frontend), PostgreSQL (Database)  

---

## 1. Introducción y Objetivo

El objetivo de esta propuesta es migrar los scripts autónomos ubicados en la carpeta `pipeline/` para convertirlos en un servicio nativo de la aplicación web. Esto permitirá automatizar la ejecución del proceso ETL, registrar los resultados directamente en la base de datos relacional y ofrecer una interfaz gráfica de administración en el frontend para iniciar o monitorear el pipeline en tiempo real.

---

## 2. Arquitectura de Integración Propuesta

```mermaid
graph TD
    subgraph "Capa de Cliente (Angular)"
        AdminDashboard["Panel de Control (Pipeline UI)"]
        GrafanaCharts["Grafana Dashboards / Charts"]
    end

    subgraph "Capa de Servidor (NestJS Backend)"
        APIController["EtlController (/api/etl)"]
        ETLService["EtlService (Ingesta + Calidad + @Cron)"]
        PlaywrightScraper["Playwright Crawler Service"]
        PrismaService["Prisma ORM Service"]
    end

    subgraph "Capa de Almacenamiento (PostgreSQL)"
        DB_OLTP["Esquema Transaccional (Products, Rules, Jobs)"]
        DB_OLAP["Esquema Analítico (Fact/Dim Tables)"]
    end

    %% Flujos de Control y Datos
    AdminDashboard -->|HTTP POST /api/etl/run| APIController
    APIController -->|Iniciar ETL Asíncrono| ETLService
    ETLService -->|@Cron scheduled daily| ETLService
    
    ETLService -->|Ejecutar Crawlers| PlaywrightScraper
    ETLService -->|Estandarizar y Limpiar| ETLService
    ETLService -->|Guardar datos limpios| PrismaService
    
    PrismaService -->|Cargar a DW| DB_OLAP
    PrismaService -->|Escribir Logs de Calidad| DB_OLTP
    
    GrafanaCharts -->|Consultar DW (OLAP)| DB_OLAP
```

---

## 3. Plan de Implementación en el Backend (NestJS)

Para embeber el pipeline dentro del backend NestJS actual, se creará un módulo especializado llamado `EtlModule`.

### A. Estructura de Módulos a incorporar:
```text
backend/src/modules/etl/
├── etl.module.ts
├── etl.controller.ts
├── etl.service.ts
├── services/
│   ├── scraper-crawler.service.ts
│   ├── data-cleaner.service.ts
│   └── quality-validator.service.ts
└── dto/
    └── etl-status.dto.ts
```

### B. Ejecución Automatizada (Cron Jobs)
En `etl.service.ts`, se utilizará el decorador `@Cron` de NestJS para programar la extracción automática de datos sin necesidad de intervención manual:

```ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class EtlService {
  private isRunning = false;
  private lastRunStatus = 'idle';

  // Ejecución programada todos los días a las 02:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCron() {
    console.log('Iniciando ejecución automatizada del ETL...');
    await this.runPipeline();
  }

  async runPipeline() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      // 1. Extracción (Scrapers y APIs)
      // 2. Transformación (Staging)
      // 3. Framework de Calidad
      // 4. Persistencia en la Base de Datos analítica
      this.lastRunStatus = 'success';
    } catch (error) {
      this.lastRunStatus = 'error';
    } finally {
      this.isRunning = false;
    }
  }
}
```

### C. Endpoints de la API REST
Se expondrán rutas HTTP para permitir al frontend disparar la ingesta bajo demanda:
*   `POST /api/etl/run`: Inicia la ejecución del pipeline de forma asíncrona (retorna `202 Accepted` de inmediato).
*   `GET /api/etl/status`: Retorna el estado actual del proceso (`isRunning`, `lastRunStatus`, `logs` de errores y métricas).

---

## 4. Plan de Implementación en el Frontend (Angular)

En la aplicación Angular, se creará una nueva vista de administración dedicada a la gobernanza de datos.

### A. Interfaz del Panel de Administración (UI)
*   **Estado de Ejecución**: Un indicador visual (badge verde/azul) mostrando si el pipeline está "Ejecutándose" o en estado "Inactivo".
*   **Botón de Control**: Botón `"Sincronizar Ahora"` para enviar la solicitud HTTP `POST /api/etl/run`.
*   **Métricas del Último Reporte**: Tarjetas con los números exactos extraídos del `quality_report.json` (Registros Raw, Completitud, Duplicados eliminados, etc.).
*   **Bitácora Interactiva**: Tabla que liste los últimos 50 registros del log de errores para auditoría rápida desde el dashboard del administrador.

### B. Consumo del Servicio API (`etl.service.ts` en Angular)
```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EtlApiService {
  private apiUrl = '/api/etl';

  constructor(private http: HttpClient) {}

  triggerPipeline(): Observable<any> {
    return this.http.post(`${this.apiUrl}/run`, {});
  }

  getPipelineStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/status`);
  }
}
```

---

## 5. Beneficios Clave de la Integración

1.  **Gobernanza Centralizada**: Todo el flujo de datos (desde el mapeo visual de la regla hasta el análisis en el Data Warehouse) se administra en un solo portal web.
2.  **Operación Portátil**: Al empaquetar el ETL en contenedores de Docker (junto con el backend NestJS), no se requiere instalar Node ni Playwright de forma independiente en los entornos de producción.
3.  **Auditoría en Tiempo Real**: Los administradores pueden visualizar la bitácora de errores directamente en el navegador sin necesidad de acceder a los archivos de log en el servidor.
4.  **Carga Directa a PostgreSQL**: Se elimina la escritura intermedia en archivos JSON locales, guardando los datos en la base de datos a través de Prisma de forma directa y segura.
