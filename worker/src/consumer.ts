import amqp, { ChannelModel, Channel, ConsumeMessage } from 'amqplib';
import { scrapeUrl } from './scraper.js';
import type { ScrapingJob, ScrapedData, DomainRule } from './types.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://scraper:scraperpass@localhost:5672';
const QUEUE = 'scraping-jobs';
const RECONNECT_DELAY_MS = 5000;

let model: ChannelModel | null = null;
let channel: Channel | null = null;

// ─── Bootstrap ─────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[Worker] Starting scraping worker...');
  await connectAndConsume();
}

// ─── Connection & Reconnection ──────────────────────────────

async function connectAndConsume(): Promise<void> {
  try {
    model = await amqp.connect(RABBITMQ_URL);
    channel = await model.createChannel();

    // Assert queue exists (durable = survives broker restart)
    await channel.assertQueue(QUEUE, { durable: true });

    // Only fetch 1 message at a time — backpressure control
    await channel.prefetch(1);

    console.log(`[Worker] Connected to RabbitMQ. Listening on queue "${QUEUE}"`);

    await channel.consume(QUEUE, async (msg: ConsumeMessage | null) => {
      if (!msg) return; // consumer cancelled by broker
      await handleMessage(msg);
    });

    // Reconnect on connection close
    model.on('close', async () => {
      console.error('[Worker] RabbitMQ connection closed. Reconnecting...');
      channel = null;
      model = null;
      setTimeout(connectAndConsume, RECONNECT_DELAY_MS);
    });

    model.on('error', (err: Error) => {
      console.error('[Worker] RabbitMQ connection error:', err.message);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Failed to connect to RabbitMQ: ${message}`);
    console.log(`[Worker] Retrying in ${RECONNECT_DELAY_MS / 1000}s...`);
    setTimeout(connectAndConsume, RECONNECT_DELAY_MS);
  }
}

// ─── Message Processing ────────────────────────────────────

async function handleMessage(msg: ConsumeMessage): Promise<void> {
  let job: ScrapingJob;

  try {
    const raw = msg.content.toString();
    console.log(`[Worker] Received message: ${raw.substring(0, 200)}`);
    job = JSON.parse(raw) as ScrapingJob;
  } catch {
    // Malformed JSON — NACK and discard
    console.error('[Worker] Invalid message format (not valid JSON). Discarding.');
    channel?.nack(msg, false, false);
    return;
  }

  // Validate required fields
  if (!job.url || !job.selectors?.title || !job.selectors?.price) {
    console.error('[Worker] Invalid job: missing required fields (url, selectors.title, selectors.price). Discarding.');
    channel?.nack(msg, false, false);
    return;
  }

  const rule: DomainRule = {
    selectors: {
      title: job.selectors.title,
      price: job.selectors.price,
      image: job.selectors.image,
      sku: job.selectors.sku,
    },
    selectorType: job.selectorType || 'css',
  };

  let result: ScrapedData;

  try {
    result = await scrapeUrl(job.url, rule);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Scraping error for job ${job.jobId}: ${message}`);

    // NACK and requeue — will be retried
    channel?.nack(msg, false, true);
    return;
  }

  // ── Future: persist result via Prisma ──
  console.log(`[Worker] Job ${job.jobId} completed:`, JSON.stringify(result));

  // ACK the message — job done
  channel?.ack(msg);
}

// ─── Graceful Shutdown ─────────────────────────────────────

async function shutdown(): Promise<void> {
  console.log('[Worker] Shutting down...');
  try {
    if (channel) await channel.close();
    if (model) await model.close();
  } catch {
    // Best-effort close
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Start ─────────────────────────────────────────────────

main().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
