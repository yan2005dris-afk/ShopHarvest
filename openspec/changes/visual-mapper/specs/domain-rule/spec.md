# Delta for Domain Rule (Data Model)

## ADDED Requirements

### R1: fieldMappings Column

The DomainRule model MUST add an optional `fieldMappings` JSON column that stores an array of field-to-selector mappings.

#### Schema
```prisma
fieldMappings  Json?  // Array of { canonicalField, selector, type, attribute? }
```

Each entry:
| Field | Type | Description |
|-------|------|-------------|
| canonicalField | string | One of: title, price, imageUrl, sku, currency, description, category |
| selector | string | CSS selector for the element |
| type | string | `text` \| `attribute` \| `html` |
| attribute | string? | Attribute name when type=attribute (e.g. "src", "href") |

#### Scenario: Migration is backward compatible
- GIVEN existing DomainRules with selectorTitle, selectorPrice, selectorImage, selectorSku populated
- WHEN the migration runs
- THEN the `fieldMappings` column is added as nullable
- AND all existing rows have `fieldMappings = null`
- AND the old `selector*` columns remain populated and readable

## MODIFIED Requirements

### R2: Selector Resolution Priority

The system MUST prefer `fieldMappings` over the legacy `selector*` columns when `fieldMappings` is non-null and non-empty.

#### Scenario: Worker uses fieldMappings
- GIVEN a DomainRule with both `fieldMappings` and legacy `selector*` populated
- WHEN the worker runs a scrape
- THEN the worker uses `fieldMappings` for extraction
- AND the legacy `selector*` columns are ignored

#### Scenario: Worker falls back to legacy
- GIVEN a DomainRule with `fieldMappings = null`
- WHEN the worker runs a scrape
- THEN the worker falls back to `selectorTitle`, `selectorPrice`, `selectorImage`, `selectorSku`

### R3: containerSelector Field

The DomainRule model MUST add an optional `containerSelector` string column for the CSS selector that identifies the product container element in a listing page.

(Previously: no container selector existed)

#### Scenario: Container selector stored
- GIVEN the user sets a product container in the visual mapper
- WHEN they save the DomainRule
- THEN `containerSelector` is populated with the CSS selector
