# Delta for brand-extraction

## ADDED Requirements

All requirements are NEW — no existing brand-extraction spec.

Refer to `openspec/specs/brand-extraction/spec.md` for the full specification.

### Requirement: Brand CRUD

The system MUST support creating, reading, updating, and deleting brands with unique names.

#### Scenario: Create brand with aliases

- GIVEN a brand with name "Samsung" and aliases ["Sam", "SSG"]
- WHEN the system creates it
- THEN the brand is persisted with name and aliases

#### Scenario: Prevent duplicate brand name

- GIVEN an existing brand "Sony"
- WHEN another "Sony" is created
- THEN the request is rejected

### Requirement: Fuzzy Matching

The system MUST match offer text to brands via pg_trgm similarity (threshold >0.6).

#### Scenario: Near-match returns brand

- GIVEN brand "Samsung" and text "Samgsung Telefono"
- WHEN similarity exceeds 0.6
- THEN "Samsung" is returned

#### Scenario: No match below threshold

- GIVEN brands ["Sony", "LG"] and text "XYZUnknown"
- WHEN similarity is below 0.6
- THEN no match is returned

#### Scenario: Match via alias

- GIVEN brand "Samsung" with alias "SSG"
- WHEN offer text contains "SSG"
- THEN alias matching returns "Samsung"

### Requirement: Low-Confidence Flag

Matches between 0.6 and 0.75 SHOULD be flagged as low-confidence.

#### Scenario: Flag uncertain match

- GIVEN a brand match with similarity 0.65
- WHEN the result is returned
- THEN the response includes `lowConfidence: true`
