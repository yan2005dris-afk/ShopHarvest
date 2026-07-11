# Raw Capture Ingestion Specification

## Purpose

Ingests and stores the latest raw scraped payload per (offerId, sourceId) pair. Each combination holds exactly one record — re-scrapes overwrite the previous payload. Full capture history is deferred to Fase 1b analytics.

## Requirements

### Requirement: Upsert Raw Payload

The system MUST upsert raw capture records by the composite key (offerId, sourceId). On conflict, the existing record is overwritten.

#### Scenario: First capture creates record

- GIVEN no existing RawCapture for (offerId: "abc123", sourceId: 1)
- WHEN the system ingests a raw payload
- THEN a new record is created with the payload and current `capturedAt`

#### Scenario: Re-scrape overwrites payload

- GIVEN an existing RawCapture for (offerId: "abc123", sourceId: 1) with payload "A"
- WHEN the system ingests payload "B" for the same pair
- THEN the existing record is updated to payload "B"
- AND `capturedAt` updates to the new timestamp

#### Scenario: Different source IDs are independent

- GIVEN a RawCapture for (offerId: "abc123", sourceId: 1)
- WHEN the system ingests a payload for (offerId: "abc123", sourceId: 2)
- THEN a second record is created (no overwrite)

### Requirement: Payload Validation

The system MUST accept valid JSON payloads and reject empty or null payloads.

#### Scenario: Valid JSON persisted

- GIVEN a valid JSON payload
- WHEN the system processes ingestion
- THEN the payload is stored as-is

#### Scenario: Null payload rejected

- GIVEN a null payload
- WHEN the system attempts ingestion
- THEN the request is rejected with a validation error

#### Scenario: Empty object accepted

- GIVEN an empty JSON object `{}`
- WHEN the system processes ingestion
- THEN the record is created with empty payload

### Requirement: Immutable Identity Keys

The (offerId, sourceId) composite key MUST NOT be modifiable after creation.

#### Scenario: Update payload only

- GIVEN an existing RawCapture
- WHEN the system receives an upsert with matching offerId and sourceId
- THEN only payload and `capturedAt` are updated, keys remain unchanged

### Requirement: Timestamp Precision

The system MUST record `capturedAt` with sub-second precision.

#### Scenario: Rapid sequential captures

- GIVEN two rapid captures for different offer-source pairs
- WHEN both are ingested
- THEN each record has a distinct `capturedAt` timestamp
