# Worker — Crawlee + Playwright

## Tecnología

**Crawlee 3** con **Playwright** como motor de navegación. Microservicio Node.js que escucha una cola de RabbitMQ y ejecuta scraping headless.

**Por qué Crawlee + Playwright:**
- Crawlee maneja automáticamente reintentos, colas de URLs y gestión de navegadores
- Playwright proporciona un navegador Chromium completo con soporte JavaScript
- Anti-detección integrada (fingerprinting, headers reales)
- Escalable horizontalmente (más workers = más capacidad de scraping)

## Estructura

```
worker/src/
├── consumer.ts      # Entry point — conexión RabbitMQ + loop de consumo
├── scraper.ts       # Motor de scraping con PlaywrightCrawler
└── types.ts         # Tipos compartidos: ScrapingJob, ScrapedData, DomainRule
```

## Componentes

### consumer.ts
Se conecta a RabbitMQ usando `amqplib` y escucha la cola `scraping-jobs`.

Características:
- **Conexión**: Usa `amqplib.connect()` con URL desde `RABBITMQ_URL`
- **Cola**: Escucha `scraping-jobs` con `{ durable: true }`
- **Prefetch**: 1 mensaje a la vez (backpressure controlado)
- **ACK/NACK**: Confirma el mensaje solo si el scraping fue exitoso
- **Reconexión**: Si RabbitMQ se cae, reintenta cada 5 segundos automáticamente
- **Graceful shutdown**: Atrapa SIGTERM/SIGINT para cerrar conexiones limpiamente

```typescript
// Flujo del consumer
async function main() {
  const connection = await connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue('scraping-jobs', { durable: true });
  channel.prefetch(1);

  channel.consume('scraping-jobs', async (msg) => {
    const job: ScrapingJob = JSON.parse(msg.content.toString());
    const result = await scrapeUrl(job.url, job.selectors, job.selectorType);
    if (result.success) {
      channel.ack(msg);
      // Guardar en PostgreSQL
    } else {
      channel.nack(msg, false, true); // Re-encolar
    }
  });
}
```

### scraper.ts
Usa `PlaywrightCrawler` de Crawlee para navegar a la URL y extraer datos.

Características:
- **Navegación headless**: Chromium sin interfaz gráfica
- **Selectores CSS/XPath**: Aplica los selectores definidos en la regla
- **Parser de precios**: Convierte strings como "$12.99" o "€34,50" a números
- **Reintentos**: Crawlee reintenta automáticamente si la página falla
- **Timeout**: 30 segundos por página

```typescript
export async function scrapeUrl(
  url: string,
  selectors: SelectorSet,
  selectorType: 'css' | 'xpath'
): Promise<ScrapedData> {
  const crawler = new PlaywrightCrawler({
    requestHandler: async ({ page }) => {
      await page.goto(url, { waitUntil: 'networkidle' });

      const extract = selectorType === 'css'
        ? (sel: string) => page.textContent(sel)
        : (sel: string) => page.evaluate((xpath) => {
            const el = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue;
            return el?.textContent || '';
          }, sel);

      return {
        title: await extract(selectors.title),
        price: parsePrice(await extract(selectors.price)),
        imageUrl: await extractImage(page, selectors.image),
        sku: selectors.sku ? await extract(selectors.sku) : undefined,
      };
    },
    maxRequestRetries: 3,
    headless: true,
  });

  return crawler.run([url]);
}
```

## RabbitMQ — Conceptos Básicos

RabbitMQ es un message broker que implementa el protocolo AMQP.

### Conceptos clave:

| Concepto | Explicación |
|----------|-------------|
| **Cola** | Buffer donde se almacenan los mensajes. La nuestra se llama `scraping-jobs` |
| **Productor** | Quien envía mensajes (NestJS) |
| **Consumidor** | Quien recibe y procesa mensajes (Worker) |
| **ACK** | Confirmación de que un mensaje fue procesado exitosamente |
| **NACK** | Rechazo del mensaje (puede re-encolarse o descartarse) |
| **Prefetch** | Cuántos mensajes puede tener un consumidor a la vez |

### Flujo:

```
NestJS ──publica──▶ RabbitMQ ──entrega──▶ Worker
                      │                      │
                      │                      ▼
                      │                 ¿Procesó?
                      │                /        \
                      │             ACK        NACK
                      │           (borra)   (re-encola)
                      ▼
                 Siguiente mensaje
```

## Comandos Útiles

```bash
# Ver colas y mensajes en RabbitMQ
docker compose exec rabbitmq rabbitmqctl list_queues

# Ver management UI
# Abrir http://localhost:15672 (user: scraper, pass: scraperpass)
```
