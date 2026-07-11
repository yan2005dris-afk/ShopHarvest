# Delta for raw-capture-ingestion

## ADDED Requirements

All requirements are NEW — no existing raw-capture-ingestion spec.

Refer to `openspec/specs/raw-capture-ingestion/spec.md` for the full specification.

### Requirement: Upsert Raw Payload

The system MUST upsert by composite key (offerId, sourceId). On conflict, the existing payload is overwritten.

#### Scenario: First capture creates record

- GIVEN no existing RawCapture for (offerId: "abc123", sourceId: 1)
- WHEN a raw payload is ingested
- THEN a new record is created with payload and current `capturedAt`

#### Scenario: Re-scrape overwrites payload

- GIVEN an existing RawCapture with payload "A"
- WHEN payload "B" is ingested for the same pair
- THEN the record is updated to payload "B"

#### Scenario: Different source IDs are independent

- GIVEN a RawCapture for (offerId: "abc123", sourceId: 1)
- WHEN a payload for (offerId: "abc123", sourceId: 2) is ingested
- THEN a second record is created (no overwrite)

### Requirement: Payload Validation

The system MUST accept valid JSON and reject null payloads.

#### Scenario: Null payload rejected

- GIVEN a null payload
- WHEN ingestion is attempted
- THEN the request is rejected with a validation error

### Requirement: Immutable Identity Keys

The (offerId, sourceId) composite key MUST NOT be modifiable after creation.

#### Scenario: Update preserves keys

- GIVEN an existing RawCapture
- WHEN an upsert with matching offerId and sourceId arrives
- THEN only payload and `capturedAt` update, keys remain unchanged
