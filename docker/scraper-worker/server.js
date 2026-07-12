#!/usr/bin/env node

/**
 * Scraper-worker — Express server running inside the Playwright Docker image.
 *
 * Starts Xvfb on boot, then listens for scrape requests. Each request launches
 * a headed Chromium with stealth plugin, scrapes the requested source, and
 * returns the result as JSON.
 *
 * Endpoints:
 *   POST /scrape/:source  — Run a scraper (body: { outputDir?, maxItems? })
 *   GET  /health          — Health check
 *
 * Usage:
 *   docker run --rm -p 3100:3100 scraper-worker
 *   curl -X POST http://localhost:3100/scrape/mercadolibre
 */

import express from 'express';
import { scrapeMercadoLibre } from './ml-scraper.js';

const PORT = parseInt(process.env.WORKER_PORT || '3100', 10);

const app = express();
app.use(express.json());

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', display: process.env.DISPLAY || ':99' });
});

// ─── Scrape endpoint ─────────────────────────────────────────────────────────

const SOURCE_HANDLERS = {
  mercadolibre: scrapeMercadoLibre,
};

app.post('/scrape/:source', async (req, res) => {
  const { source } = req.params;
  const handler = SOURCE_HANDLERS[source];

  if (!handler) {
    return res.status(400).json({
      error: `Unknown source "${source}". Available: ${Object.keys(SOURCE_HANDLERS).join(', ')}`,
    });
  }

  console.log(`\n=== Scrape request: ${source} ===`);
  try {
    const result = await handler({
      outputDir: req.body.outputDir,
      maxItems: req.body.maxItems,
    });
    console.log(`=== Done: ${source} — ${result.totalScraped} items in ${result.durationMs}ms ===\n`);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`=== Failed: ${source} — ${msg} ===\n`);
    res.status(500).json({
      source,
      error: msg,
      totalScraped: 0,
      durationMs: 0,
    });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=== Scraper-worker listening on port ${PORT} ===`);
  console.log(`    DISPLAY=${process.env.DISPLAY || ':99'}`);
  console.log(`    Sources: ${Object.keys(SOURCE_HANDLERS).join(', ')}\n`);
});
