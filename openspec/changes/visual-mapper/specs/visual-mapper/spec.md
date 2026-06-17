# Spec — Visual Mapper

## Purpose

Interactive UI that replaces the manual url-input. Users paste a store URL, preview the rendered page in a sandboxed iframe, click elements to assign CSS selectors to canonical fields, and trigger listing scraping — all without writing selectors.

## Requirements

### R1: URL Input & Page Fetch

The system MUST provide a text input for a store URL and a "Fetch Page" button that calls `POST /api/fetch-page`.

#### Scenario: Fetch rendered page
- GIVEN the user is on the visual mapper page
- WHEN they paste a valid URL and click "Fetch Page"
- THEN the system calls `POST /api/fetch-page` and displays a loading spinner
- AND the rendered HTML is displayed in the sandboxed iframe preview

#### Scenario: Invalid URL
- GIVEN the user pastes an invalid URL
- WHEN they click "Fetch Page"
- THEN the system SHOWs a validation error and does NOT call the API

### R2: Sandboxed Preview

The system MUST render the fetched HTML inside an `<iframe srcdoc="...">` with sandbox attributes preventing script execution and navigation.

#### Scenario: HTML rendered safely
- GIVEN the page HTML was fetched successfully
- WHEN the iframe loads
- THEN the content is sandboxed (scripts do NOT execute, parent navigation is blocked)

### R3: Click-to-Select Mapping

The user MUST be able to click any rendered element in the iframe preview to assign it to a canonical field or mark it as the product container.

| Field | Type | Required |
|-------|------|----------|
| title | text | Yes |
| price | text | Yes |
| imageUrl | attribute (src) | No |
| sku | text | No |
| currency | text | No |
| description | html | No |
| category | text | No |
| product-container | element | Yes |

#### Scenario: Assign element to field
- GIVEN the iframe preview is visible
- WHEN the user clicks an element in the iframe
- THEN a floating menu appears with options "Assign to [field]" for each canonical field
- AND the selected field is highlighted in the field list

#### Scenario: Set product container
- GIVEN the iframe preview is visible
- WHEN the user clicks an element and selects "Set as product container"
- THEN all matching elements are highlighted with a bounding outline and count displayed
- AND the container selector is stored

### R4: Limit & Scrape

The system MUST provide a numeric input for max products (default 20) and a "Save & Scrape" button that saves the DomainRule with fieldMappings and triggers `POST /api/scrape-listing`.

#### Scenario: Save and start scraping
- GIVEN all fields are mapped
- WHEN the user clicks "Save & Scrape"
- THEN the DomainRule is saved with fieldMappings JSON
- AND `POST /api/scrape-listing` is called with the domainRuleId, URL, and limit
- AND the UI transitions to "scraping" state showing the job ID

#### Scenario: Required fields missing
- GIVEN title or price has NOT been mapped
- WHEN the user clicks "Save & Scrape"
- THEN the button is disabled and a tooltip shows "Map title and price first"

### R5: UI States

| State | Visual |
|-------|--------|
| idle | URL input + "Fetch Page" button, no preview |
| fetching | Loading spinner over preview area |
| preview | Rendered iframe + click-to-select overlay |
| mapping | Fields assigned, container selected, limit input shown |
| scraping | Job ID displayed, link to products page |
| done | Success message + link to view scraped products |

### R6: Route

The visual mapper MUST be the default route (`/`). The `/url-input` route MUST be removed.

#### Scenario: Default route
- GIVEN the user navigates to `/`
- THEN the VisualMapperComponent is displayed
