# Brand Extraction Specification

## Purpose

Manages brand entities with fuzzy matching against raw offer text using trigram similarity (pg_trgm). Brands are optionally created on demand — no pre-built dictionary required.

## Requirements

### Requirement: Brand CRUD

The system MUST support creating, reading, updating, and deleting brand records.

#### Scenario: Create brand with aliases

- GIVEN a brand with name "Samsung" and aliases ["Sam", "SSG"]
- WHEN the system creates it
- THEN the brand is persisted with name and aliases

#### Scenario: Create brand without aliases

- GIVEN a brand with only a name
- WHEN the system creates it
- THEN the brand is persisted with an empty aliases array

#### Scenario: Prevent duplicate brand name

- GIVEN an existing brand "Sony"
- WHEN the system creates another brand named "Sony"
- THEN the request is rejected as duplicate

### Requirement: Fuzzy Matching

The system MUST match raw offer text to a persisted brand using pg_trgm similarity with a configurable threshold (default >0.6).

#### Scenario: Exact text match

- GIVEN a persisted brand "Sony" and offer text "Sony"
- WHEN the system runs matching
- THEN it returns "Sony" with similarity 1.0

#### Scenario: Near-match returns brand

- GIVEN a brand "Samsung" and text "Samgsung Telefono"
- WHEN trigram similarity exceeds 0.6
- THEN the system returns "Samsung"

#### Scenario: No match below threshold

- GIVEN brands ["Sony", "LG"] and text "XYZUnknown"
- WHEN similarity is below 0.6
- THEN the system returns no match

#### Scenario: Match via alias

- GIVEN a brand "Samsung" with alias "SSG"
- WHEN offer text contains "SSG"
- THEN alias matching returns "Samsung"

#### Scenario: Empty text yields no match

- GIVEN persisted brands and empty offer text
- WHEN the system runs matching
- THEN no brand is returned

### Requirement: Configurable Threshold

The system SHOULD accept an override threshold per match request.

#### Scenario: Override similarity threshold

- GIVEN a match request with threshold 0.8
- WHEN the system evaluates candidates
- THEN only brands with similarity >=0.8 are returned

### Requirement: Low-Confidence Flag

Matches between 0.6 and 0.75 SHOULD be flagged as low-confidence.

#### Scenario: Flag uncertain match

- GIVEN a brand match with similarity 0.65
- WHEN the system returns the result
- THEN the response includes a `lowConfidence: true` flag
