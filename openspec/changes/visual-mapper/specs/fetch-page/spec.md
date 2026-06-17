# Spec — Fetch Page

## Purpose

Proxy endpoint that accepts a store URL, dispatches it to the worker via RabbitMQ for Playwright rendering, and returns the rendered HTML plus detected interactive elements.

## Requirements

### R1: Endpoint Contract

`POST /api/fetch-page` — Input: `{ url: string }`. Output: `{ html: string, url: string, title: string, detectedElements: Array<{ tag: string, text: string, selector: string }> }`.

#### Scenario: Valid URL returns rendered HTML
- GIVEN a valid store URL
- WHEN POST /api/fetch-page is called
- THEN the system publishes a message to the `page-fetch` queue
- AND the worker opens the URL with Playwright
- AND the endpoint returns the rendered HTML body, page title, and a list of detected interactive elements
- AND the response is returned within 30 seconds

#### Scenario: Non-reachable URL
- GIVEN a URL that returns a network error
- WHEN POST /api/fetch-page is called
- THEN the backend returns HTTP 502 with `{ error: "Failed to fetch page" }`

#### Scenario: Timeout
- GIVEN a page that takes longer than 30s to render
- WHEN the timeout is exceeded
- THEN the endpoint returns HTTP 504 with `{ error: "Page fetch timed out" }`
- AND the worker cancels the navigation

### R2: Detected Elements

The worker MUST return interactive elements (buttons, links, inputs, images with `alt` text) with a unique CSS selector for each.

#### Scenario: Interactive elements detected
- GIVEN a page with buttons, links, and images
- WHEN the worker processes it
- THEN `detectedElements` contains each interactive element with `tag`, `text` (inner text or alt), and a unique `selector`

### R3: Queue Message

The system SHALL use RabbitMQ exchange `amq.direct`, routing key `page-fetch` with a single active consumer.

#### Scenario: Message published
- GIVEN a valid request
- WHEN the endpoint is called
- THEN a JSON message `{ url: string, requestId: string }` is published to the `page-fetch` queue
