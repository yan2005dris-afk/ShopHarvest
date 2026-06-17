import amqp, { ChannelModel, Channel, ConsumeMessage } from 'amqplib';
import { scrapeUrl, fetchPage, scrapeListing, closeOpenBrowser } from './scraper.js';
import type {
  ScrapedData,
  ScrapingJob,
  DomainRule,
  ScrapeResultPayload,
  ListingJobMessage,
  ListingProduct,
  FetchPageJob,
  FetchPageResultPayload,
} from './types.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://scraper:scraperpass@localhost:5672';
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://backend:3000';
const HTTP_TIMEOUT_MS = parseInt(process.env.HTTP_TIMEOUT_MS || '10000', 10);
const SCRAPING_QUEUE = 'scraping_jobs';
const PAGE_FETCH_QUEUE = 'page-fetch';
const RECONNECT_DELAY_MS = 5000;

let model: ChannelModel | null = null;
let channel: Channel | null = null;

// ─── Bootstrap ─────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[Worker] Starting scraping worker...');
  console.log(`[Worker] Backend API URL: ${BACKEND_API_URL}`);
  console.log(`[Worker] Queues: ${SCRAPING_QUEUE}, ${PAGE_FETCH_QUEUE}`);
  await connectAndConsume();
}

// ─── Connection & Reconnection ──────────────────────────────

async function connectAndConsume(): Promise<void> {
  try {
    model = await amqp.connect(RABBITMQ_URL);
    channel = await model.createChannel();

    // Assert both queues exist (durable = survives broker restart)
    await channel.assertQueue(SCRAPING_QUEUE, { durable: true });
    await channel.assertQueue(PAGE_FETCH_QUEUE, { durable: true });

    // Only fetch 1 message at a time — backpressure control
    await channel.prefetch(1);

    console.log(`[Worker] Connected to RabbitMQ. Listening on queues "${SCRAPING_QUEUE}" and "${PAGE_FETCH_QUEUE}"`);

    // Consume from scraping_jobs (existing + listing type)
    await channel.consume(SCRAPING_QUEUE, async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      await handleScrapingJobMessage(msg);
    });

    // Consume from page-fetch (new queue for visual mapper)
    await channel.consume(PAGE_FETCH_QUEUE, async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      await handlePageFetchMessage(msg);
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

// ─── Helper: Sleep ─────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Helper: Submit Scraping Result with Retry ──────────────

async function submitResult(jobId: string, payload: ScrapeResultPayload | Record<string, unknown>): Promise<boolean> {
  const url = `${BACKEND_API_URL}/scraping-jobs/${jobId}/result`;
  const maxAttempts = 3;
  const delays = [2000, 4000, 8000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Worker] Submitting result for job ${jobId} (attempt ${attempt}/${maxAttempts})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`[Worker] Result submitted successfully for job ${jobId} (status ${response.status})`);
        return true;
      }

      console.warn(
        `[Worker] POST failed for job ${jobId} (attempt ${attempt}/${maxAttempts}): status ${response.status}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Worker] POST error for job ${jobId} (attempt ${attempt}/${maxAttempts}): ${message}`);
    }

    if (attempt < maxAttempts) {
      const delay = delays[attempt - 1] || 8000;
      console.log(`[Worker] Retrying job ${jobId} in ${delay}ms...`);
      await sleep(delay);
    }
  }

  console.error(`[Worker] Failed to submit result after ${maxAttempts} retries for job ${jobId}`);
  return false;
}

// ─── Helper: Submit Fetch-Page Result with Retry ────────────

async function submitFetchResult(requestId: string, payload: FetchPageResultPayload): Promise<boolean> {
  const url = `${BACKEND_API_URL}/fetch-page/${requestId}/result`;
  const maxAttempts = 3;
  const delays = [2000, 4000, 8000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Worker] Submitting fetch-page result for request ${requestId} (attempt ${attempt}/${maxAttempts})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`[Worker] Fetch-page result submitted for request ${requestId} (status ${response.status})`);
        return true;
      }

      console.warn(
        `[Worker] POST failed for fetch-page ${requestId} (attempt ${attempt}/${maxAttempts}): status ${response.status}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Worker] POST error for fetch-page ${requestId} (attempt ${attempt}/${maxAttempts}): ${message}`);
    }

    if (attempt < maxAttempts) {
      const delay = delays[attempt - 1] || 8000;
      console.log(`[Worker] Retrying fetch-page ${requestId} in ${delay}ms...`);
      await sleep(delay);
    }
  }

  console.error(`[Worker] Failed to submit fetch-page result after ${maxAttempts} retries for request ${requestId}`);
  return false;
}

// ─── Message Processing: Scraping Jobs ─────────────────────

async function handleScrapingJobMessage(msg: ConsumeMessage): Promise<void> {
  let job: ScrapingJob | ListingJobMessage;

  try {
    const raw = msg.content.toString();
    console.log(`[Worker] Received message: ${raw.substring(0, 200)}`);
    job = JSON.parse(raw);
  } catch {
    console.error('[Worker] Invalid message format (not valid JSON). Discarding.');
    channel?.nack(msg, false, false);
    return;
  }

  // Route to listing handler if type='listing'
  if ('type' in job && job.type === 'listing') {
    await handleListingJob(msg, job as ListingJobMessage);
    return;
  }

  // ── Existing single-product flow (unchanged) ──
  const singleJob = job as ScrapingJob;

  if (!singleJob.url || !singleJob.selectors?.title || !singleJob.selectors?.price) {
    console.error('[Worker] Invalid job: missing required fields (url, selectors.title, selectors.price). Discarding.');
    channel?.nack(msg, false, false);
    return;
  }

  const rule: DomainRule = {
    selectors: {
      title: singleJob.selectors.title,
      price: singleJob.selectors.price,
      image: singleJob.selectors.image,
      sku: singleJob.selectors.sku,
    },
    selectorType: singleJob.selectorType || 'css',
  };

  let result: ScrapedData;

  try {
    result = await scrapeUrl(singleJob.url, rule);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Scraping error for job ${singleJob.jobId}: ${message}`);

    await submitResult(singleJob.jobId, { success: false, error: message });
    channel?.ack(msg);
    return;
  }

  if (result.success) {
    const payload: ScrapeResultPayload = {
      success: true,
      title: result.title,
      price: result.price,
      currency: result.currency,
      imageUrl: result.imageUrl,
      sku: result.sku,
    };

    const submitted = await submitResult(singleJob.jobId, payload);
    if (!submitted) {
      console.error(`[Worker] Failed to submit result after 3 retries for job ${singleJob.jobId}`);
    }
  } else {
    await submitResult(singleJob.jobId, {
      success: false,
      error: result.error || 'Unknown scrape error',
    });
  }

  channel?.ack(msg);
}

// ─── Message Processing: Listing Jobs ──────────────────────

async function handleListingJob(msg: ConsumeMessage, job: ListingJobMessage): Promise<void> {
  // Validate listing-specific fields
  if (!job.url || !job.containerSelector || !job.fieldMappings || job.fieldMappings.length === 0) {
    console.error('[Worker] Invalid listing job: missing url, containerSelector, or fieldMappings. Discarding.');
    await submitResult(job.jobId, {
      success: false,
      error: 'Missing required listing fields (url, containerSelector, fieldMappings)',
    });
    channel?.ack(msg);
    return;
  }

  console.log(
    `[Worker] Processing listing job ${job.jobId} for ${job.url} (container: "${job.containerSelector}", ${job.fieldMappings.length} mappings, limit: ${job.limit ?? 20})`,
  );

  let products: ListingProduct[];
  let truncated: boolean;

  try {
    const result = await scrapeListing(job.url, job.containerSelector, job.fieldMappings, job.limit);
    products = result.products;
    truncated = result.truncated;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Listing scrape error for job ${job.jobId}: ${message}`);

    await submitResult(job.jobId, { success: false, error: message });
    channel?.ack(msg);
    return;
  }

  // POST batch result
  const payload = {
    success: true,
    type: 'listing' as const,
    products,
    truncated,
  };

  const submitted = await submitResult(job.jobId, payload);
  if (!submitted) {
    console.error(`[Worker] Failed to submit listing result after 3 retries for job ${job.jobId}`);
  }

  channel?.ack(msg);
}

// ─── Message Processing: Page Fetch ────────────────────────

async function handlePageFetchMessage(msg: ConsumeMessage): Promise<void> {
  let job: FetchPageJob;

  try {
    const raw = msg.content.toString();
    console.log(`[Worker] Received page-fetch message: ${raw.substring(0, 200)}`);
    job = JSON.parse(raw) as FetchPageJob;
  } catch {
    console.error('[Worker] Invalid page-fetch message format. Discarding.');
    channel?.nack(msg, false, false);
    return;
  }

  if (!job.url || !job.requestId) {
    console.error('[Worker] Invalid page-fetch job: missing url or requestId. Discarding.');
    channel?.nack(msg, false, false);
    return;
  }

  console.log(`[Worker] Fetching page for request ${job.requestId}: ${job.url}`);

  try {
    const result = await fetchPage(job.url, job.cookies);

    if (result.success) {
      // ── Success ──────────────────────────────────────────
      const payload: FetchPageResultPayload = {
        success: true,
        html: result.html,
        title: result.title,
        detectedElements: result.detectedElements,
      };

      await submitFetchResult(job.requestId, payload);
      console.log(`[Worker] Page fetch completed for request ${job.requestId}: ${result.detectedElements.length} elements detected`);

      // Close the persistent browser — we're done
      await closeOpenBrowser();
    } else if (result.captchaDetected) {
      // ── CAPTCHA detected ────────────────────────────────
      console.log(`[Worker] CAPTCHA detected for request ${job.requestId}: ${job.url}`);

      const payload: FetchPageResultPayload = {
        success: false,
        captchaDetected: true,
        error: 'CAPTCHA detected — user must resolve in browser',
      };

      await submitFetchResult(job.requestId, payload);

      // IMPORTANT: do NOT close the browser/context here.
      // The persistent context keeps cookies etc. so the retry
      // (after user resolves the captcha) can reuse them.
    } else {
      // ── Real error (non-captcha) ─────────────────────────
      console.error(`[Worker] Page fetch error for request ${job.requestId}: ${result.error}`);

      const payload: FetchPageResultPayload = {
        success: false,
        error: result.error,
      };

      await submitFetchResult(job.requestId, payload);

      // Close the persistent browser — it's a real failure
      await closeOpenBrowser();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Unexpected error in page-fetch handler for request ${job.requestId}: ${message}`);

    const payload: FetchPageResultPayload = {
      success: false,
      error: message,
    };

    await submitFetchResult(job.requestId, payload);

    // Close on unexpected error too
    await closeOpenBrowser();
  }

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
