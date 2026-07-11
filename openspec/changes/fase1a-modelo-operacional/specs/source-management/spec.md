# Delta for source-management

## ADDED Requirements

All requirements are NEW — no existing source-management spec.

Refer to `openspec/specs/source-management/spec.md` for the full specification.

### Requirement: Source CRUD

The system MUST support creating, reading, updating, and deleting scraping source records with unique `code` constraint and status lifecycle.

#### Scenario: Create a new source

- GIVEN a valid source payload with `code`, `baseUrl`, and `name`
- WHEN the system receives a create request
- THEN a new source record is created with status `inactive`

#### Scenario: Prevent duplicate source code

- GIVEN an existing source with code `ML_AR`
- WHEN the system receives a create request with the same code
- THEN the request is rejected with a duplicate code error

#### Scenario: Delete inactive source

- GIVEN an inactive source with no dependent records
- WHEN the system deletes it
- THEN the source record is removed

### Requirement: Source Status Lifecycle

The system SHALL track status transitions: `inactive` -> `active` -> `error`. Only `active` sources are scrapable.

#### Scenario: Activate a source

- GIVEN an inactive source
- WHEN activated
- THEN status changes to `active`

#### Scenario: Cannot scrape inactive source

- GIVEN a source with status `inactive`
- WHEN the scraper requests eligible sources
- THEN the source is excluded from results

### Requirement: Per-Source Config

Each source SHOULD carry a `config` JSON payload.

#### Scenario: Store extraction config

- GIVEN a source with provided `config` JSON
- WHEN the source is created
- THEN the config is persisted alongside the source
