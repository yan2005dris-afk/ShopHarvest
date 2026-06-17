# Delta for Scraping Worker

## ADDED Requirements

### R1: page-fetch Queue Consumer

The worker MUST consume messages from the `page-fetch` queue. Each message contains `{ url: string, requestId: string }`.

#### Scenario: Worker fetches page and returns HTML
- GIVEN a page-fetch message with a valid URL
- WHEN the worker receives it
- THEN it opens the URL with Playwright, waits for network idle
- AND extracts `document.documentElement.outerHTML`, `document.title`, and interactive elements
- AND POSTs the result to `POST /api/fetch-page/:requestId/result`

#### Scenario: Page navigation fails
- GIVEN a page-fetch message with an unreachable URL
- WHEN Playwright navigation fails
- THEN the worker POSTs a failure result with `{ error: string }`
- AND ACKs the message

### R2: Listing Scrape Logic

The worker MUST handle messages with `type: "listing"`. It receives `{ jobId, domainRuleId, url, limit, fieldMappings, containerSelector }`.

#### Scenario: Listing extraction with fieldMappings
- GIVEN a listing message with containerSelector and fieldMappings
- WHEN the worker processes it
- THEN it finds all elements matching containerSelector
- AND for each (up to limit), applies each fieldMapping selector relative to the container
- AND POSTs the batch result to `POST /api/scraping-jobs/:id/result`

#### Scenario: Container selector returns nothing
- GIVEN a listing message with a non-matching containerSelector
- WHEN the worker processes it
- THEN it posts `{ success: false, error: "No container elements found" }`

## MODIFIED Requirements

### R3: Post-Scrape Submission

(Previously: worker POSTed single product data with title, price, currency, imageUrl, sku)

The worker MUST now also support batch listing results: an array of product objects with field values determined by fieldMappings.

#### Scenario: Listing result submitted
- GIVEN a successful listing scrape
- WHEN the worker POSTs the result to the backend
- THEN the payload contains `{ success: true, type: "listing", products: [{ canonicalField: value, ... }, ...] }`
