# Spec — Scraping Worker

## 1. Objective

The worker MUST scrape a product URL using Crawlee + Playwright, then POST the structured result to the backend API so data persists.

## 2. Scope

**In:** HTTP POST after scrape, retry with backoff, environment-based API URL, structured payload, graceful error handling.

**Out:** Database writes, message queue management (already exists), result caching.

## 3. Functional Requirements

### 3.1. Result Submission
- After a successful scrape, the worker MUST POST the scraped data to `POST /api/scraping-jobs/:jobId/result`.
- The backend URL MUST be configurable via `BACKEND_API_URL` environment variable (default `http://backend:3000`).
- The POST body MUST contain:
  - `jobId` (string) — echoed from the consumed message
  - `success` (boolean)
  - `title`, `price`, `currency`, `imageUrl`, `sku` (all optional, present only when `success: true`)
  - `error` (string, optional, present only when `success: false`)

### 3.2. Retry on Failure
- If the POST fails (network error or non-2xx status), the worker MUST retry up to 3 times.
- Retries MUST use exponential backoff: 2s, 4s, 8s.
- After all retries are exhausted, the worker MUST log the final failure and **NOT** requeue the RabbitMQ message (ACK the message to remove it from the queue).

### 3.3. Message ACK/NACK Behavior
- On successful POST (2xx): ACK the message immediately.
- On final retry exhaustion: ACK the message (don't requeue — the backend will mark the job as failed).
- On scrape failure (before POST): the worker MUST still POST a result with `success: false` and `error` populated, so the backend can mark the job as failed.

### 3.4. Configuration
- `BACKEND_API_URL` — environment variable, defaults to `http://backend:3000`.
- `HTTP_TIMEOUT_MS` — optional, defaults to 10 000ms.

## 4. Non-Functional Requirements
- The worker MUST NOT block the message consumption loop while waiting for a POST response (use async/await as already done).
- The worker MUST log each POST attempt with status code or error message.

## 5. Scenarios

### 5.1. Successful scrape with successful POST
**Given** a valid job message with selectors  
**When** the worker scrapes successfully and POSTs the result  
**Then** the backend receives `success: true` with title, price, currency  
**And** the worker ACKs the RabbitMQ message

### 5.2. Successful scrape with failed POST (retries exhausted)
**Given** a valid job message  
**When** the worker scrapes successfully but the backend returns 500 for 3 consecutive retries  
**Then** the worker ACKs the message  
**And** logs "Failed to submit result after 3 retries"

### 5.3. Scrape failure
**Given** a valid job message  
**When** `scrapeUrl()` throws an error  
**Then** the worker POSTs `{ success: false, error: "<message>" }` to the backend  
**And** ACKs the message

### 5.4. Missing BACKEND_API_URL
**Given** no `BACKEND_API_URL` environment variable  
**When** the worker starts  
**Then** it MUST default to `http://backend:3000`
