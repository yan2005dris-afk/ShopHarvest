# Spec — Scrape Listing

## Purpose

Batch endpoint that creates a listing scraping job. The worker receives the job, uses the DomainRule's container selector to find product elements, applies fieldMappings to extract data from each, and saves Product entries.

## Requirements

### R1: Endpoint Contract

`POST /api/scrape-listing` — Input: `{ domainRuleId: string, url: string, limit?: number }`. Returns `{ jobId: string }`.

#### Scenario: Listing job created
- GIVEN a valid domainRuleId with fieldMappings and containerSelector
- WHEN POST /api/scrape-listing is called
- THEN a ScrapingJob is created with type `listing`
- AND a RabbitMQ message is published with `{ jobId, domainRuleId, url, limit, type: "listing" }`
- AND the response returns the job ID

#### Scenario: Missing fieldMappings
- GIVEN a domainRuleId with NO fieldMappings
- WHEN POST /api/scrape-listing is called
- THEN the endpoint returns HTTP 400 with `{ error: "Domain rule has no field mappings configured" }`

#### Scenario: Default limit
- GIVEN no `limit` parameter
- WHEN POST /api/scrape-listing is called
- THEN the worker scrapes up to 20 products

### R2: Worker Listing Logic

The worker MUST receive the listing message, open the URL, find all elements matching `containerSelector`, iterate up to `limit` products, apply each `fieldMappings` entry's selector within each container, and POST results per product.

#### Scenario: Products extracted from listing
- GIVEN a listing page with 50 product containers
- WHEN the worker processes the job with limit=20
- THEN the worker finds up to 20 container elements
- AND for each container, applies fieldMappings selectors relative to the container
- AND creates a Product entry with status `completed` for each

#### Scenario: No container elements match
- GIVEN a page with no elements matching containerSelector
- WHEN the worker processes the job
- THEN the job status becomes `failed` with error "No container elements found"
- AND no Product entries are created

### R3: Product Creation

Each extracted product MUST be saved as a separate Product entry associated with the DomainRule. If a product URL or SKU matches an existing Product, the system SHALL update it (upsert).

#### Scenario: Duplicate product
- GIVEN a listing page where a product has been scraped before (same SKU matches)
- WHEN the worker extracts data
- THEN the existing Product entry is updated with new data
- AND a new PriceHistory entry is added (if price changed)
