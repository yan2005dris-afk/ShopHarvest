# Delta for Scraping Jobs

## ADDED Requirements

### R1: Listing Job Type

ScrapingJob MUST support a `type` field: `'single'` (default) or `'listing'`. Listing jobs process a batch of products from a single page.

#### Scenario: Listing job created
- GIVEN a request to POST /api/scrape-listing
- WHEN the job is created
- THEN `type` is set to `listing`
- AND `status` is set to `queued`

### R2: POST /api/scrape-listing Endpoint

(Previously: only POST /api/scraping-jobs existed for single-URL scraping)

The system MUST expose `POST /api/scrape-listing` for batch listing scraping. This endpoint creates a ScrapingJob with type `listing` and publishes a listing-type message to the worker queue.

#### Scenario: Concurrent listing and single jobs
- GIVEN a listing scrape is in progress
- WHEN a single-URL scrape is requested via POST /api/scraping-jobs
- THEN both jobs run independently — the listing job does NOT interfere with the single job

### R3: Listing Result Endpoint

`POST /api/scraping-jobs/:id/result` MUST now accept listing results: `{ success: true, type: "listing", products: [...] }`. Each product SHALL be upserted via ProductsService.

#### Scenario: Listing result with multiple products
- GIVEN a listing job with status `processing`
- WHEN the worker POSTs a listing result with 15 products
- THEN the job status becomes `completed`
- AND 15 Product entries are created/upserted
- AND each product is linked to the same DomainRule

## MODIFIED Requirements

### R3: Queue Message Format

(Previously: message contained `{ jobId, url, domainRuleId, selectors, selectorType }`)

The message MUST now also include `type: "listing"`, `containerSelector`, `fieldMappings`, and `limit` for listing jobs.

#### Scenario: Listing message format
- GIVEN a listing job is enqueued
- WHEN the message is published to RabbitMQ
- THEN it includes `type: "listing"`, `containerSelector`, `fieldMappings[]`, and `limit`
