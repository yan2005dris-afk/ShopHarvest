# Delta Spec for raw-capture-ingestion

## ADDED Requirements

### Requirement: ETL Queue Extraction

The system MUST query only pending raw capture records for product extraction. Pending records are defined as having status `UNPROCESSED` or `FAILED`, and attempts less than 3. If a record's staging transformation fails, the attempts counter MUST be incremented by 1 and its status MUST be set to `FAILED`. Records with attempts equal to or greater than 3 MUST be skipped.

#### Scenario: Extract pending records

- GIVEN a RawCapture with status `UNPROCESSED` and attempts `0`
- AND a RawCapture with status `FAILED` and attempts `2`
- AND a RawCapture with status `FAILED` and attempts `3`
- WHEN the StagingProcessor runs extraction
- THEN the first two records are extracted
- AND the third record is skipped

#### Scenario: Staging transformation failure increments attempts

- GIVEN a RawCapture with status `UNPROCESSED` and attempts `1`
- WHEN the staging transformation fails for this record
- THEN the record status is set to `FAILED`
- AND the attempts counter is incremented to `2`

### Requirement: ETL DW Loader Marking

The system MUST mark raw capture records as `PROCESSED` after they are successfully written to the analytical database (DW).

#### Scenario: Mark loaded records as PROCESSED

- GIVEN a RawCapture with status `UNPROCESSED`
- WHEN the record is successfully written to the DW
- THEN the record status is set to `PROCESSED`

### Requirement: File Fallback for Non-DB Entities

The system MUST continue to use file-based fallbacks for surveys and exchange rates.

#### Scenario: Process surveys and rates from files

- GIVEN survey and rate files exist in the fallback directory
- WHEN the ETL pipeline executes
- THEN surveys and rates are extracted from the files rather than the operational database

## MODIFIED Requirements

### Requirement: Upsert Raw Payload

The system MUST upsert raw capture records by the composite key (offerId, sourceId). On conflict, the existing record is overwritten. Upon ingestion, the record's status MUST be set to `UNPROCESSED` and attempts MUST be set to `0`.
(Previously: Upserted raw capture records with payload and timestamp only, without tracking status or attempts)

#### Scenario: First capture creates record

- GIVEN no existing RawCapture for (offerId: "abc123", sourceId: 1)
- WHEN the system ingests a raw payload
- THEN a new record is created with the payload, current `capturedAt`, status `UNPROCESSED`, and attempts `0`

#### Scenario: Re-scrape overwrites payload

- GIVEN an existing RawCapture for (offerId: "abc123", sourceId: 1) with payload "A", status "PROCESSED", and attempts 1
- WHEN the system ingests payload "B" for the same pair
- THEN the existing record is updated to payload "B"
- AND `capturedAt` updates to the new timestamp
- AND status is reset to `UNPROCESSED`
- AND attempts is reset to `0`

#### Scenario: Different source IDs are independent

- GIVEN a RawCapture for (offerId: "abc123", sourceId: 1)
- WHEN the system ingests a payload for (offerId: "abc123", sourceId: 2)
- THEN a second record is created with status `UNPROCESSED` and attempts `0`
