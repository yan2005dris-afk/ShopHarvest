# Source Management Specification

## Purpose

Manages scraping source configurations — CRUD, status lifecycle, and per-source extraction rules. A source defines an e-commerce site or store to be scraped.

## Requirements

### Requirement: Source CRUD

The system MUST support creating, reading, updating, and deleting scraping source records.

#### Scenario: Create a new source

- GIVEN a valid source payload with `code`, `baseUrl`, and `name`
- WHEN the system receives a create request
- THEN a new source record is created with status `inactive`
- AND the response contains the new source ID

#### Scenario: Prevent duplicate source code

- GIVEN an existing source with code `ML_AR`
- WHEN the system receives a create request with the same code
- THEN the request is rejected with a duplicate code error

#### Scenario: Read source by code

- GIVEN an existing source with code `ML_AR`
- WHEN the system reads by code
- THEN the full source record is returned

#### Scenario: Update source base URL

- GIVEN an existing source
- WHEN the system updates its `baseUrl`
- THEN the updated source record is returned

#### Scenario: Delete inactive source

- GIVEN an inactive source with no dependent records
- WHEN the system deletes it
- THEN the source record is removed

### Requirement: Source Status Lifecycle

The system SHALL track source status transitions: `inactive` -> `active` -> `error`. Only `active` sources are eligible for scraping.

#### Scenario: Activate a source

- GIVEN an existing source with status `inactive`
- WHEN the system activates the source
- THEN status changes to `active`

#### Scenario: Source enters error state

- GIVEN an active source
- WHEN scraping fails for that source
- THEN status transitions to `error`

#### Scenario: Cannot scrape inactive source

- GIVEN a source with status `inactive`
- WHEN the scraper requests eligible sources
- THEN the source is excluded from results

### Requirement: Per-Source Config

Each source SHOULD carry a `config` JSON payload with extraction rules (selectors, rate limits, pagination).

#### Scenario: Store extraction config

- GIVEN a source with provided `config` JSON
- WHEN the source is created
- THEN the config is persisted alongside the source

#### Scenario: Config is optional

- GIVEN a source creation without `config`
- WHEN the system processes the request
- THEN the source is created with an empty config
