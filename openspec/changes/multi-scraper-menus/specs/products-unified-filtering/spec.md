# Spec — Products Unified Filtering

## 1. Objective

The products page at `/products` SHALL support filtering by `source` (Origin) and `category` (Product Type). Filters MUST be URL-driven via query parameters and the available filter options MUST be derived from existing product data, not hardcoded.

## 2. Scope

**In:**

- Reading `?source=<id>` and `?type=<category>` from the URL via Angular Router's `queryParamMap`.
- Applying the filters in the products data query (frontend service call).
- Rendering two filter controls (`Origin` and `Product Type`) above the products table.
- Updating the URL when a filter changes (`Router.navigate` with `queryParams` and `queryParamsHandling: 'merge'`).
- Deriving the available `source` and `type` values dynamically from existing data.
- Cross-linking from the scrapers panel: `Run` actions and run-history rows MAY link to `/products?source=<id>` for completed scrapers.

**Out:**

- Persisting filter preferences per user. URL state is the source of truth.
- Multi-select on a single dimension (each filter is single-valued in this change).
- Free-text search across product titles or descriptions.
- New server-side filter endpoints; this change uses the existing products listing endpoint with optional filter params.

## 3. Functional Requirements

### 3.1. URL-Driven Filters

- The products page MUST read `?source` and `?type` query params from `ActivatedRoute.queryParamMap` and convert them into signals (via `toSignal()` or `effect()`).
- When a query param is present, the data query MUST filter by it.
- When no query param is present, the products query MUST return all products (no filter applied).
- Changing a filter MUST update the URL via `Router.navigate(...)` with `queryParams` and `queryParamsHandling: 'merge'` (preserves the other filter).
- Clearing a filter MUST remove the corresponding query param from the URL.
- Query params MUST survive a browser refresh and back/forward navigation.

### 3.2. Dynamic Filter Options

- Available `Origin` values MUST be derived from the distinct `source` values present in the products response (or a lightweight metadata endpoint if available in the same response).
- Available `Product Type` values MUST be derived from the distinct `category` values present in the products response.
- No source identifier, category string, or display label MUST be hardcoded in the frontend.

### 3.3. UI Behavior

- Each filter MUST render a `<select>` (or equivalent combo box) listing the dynamically derived options, with the current selection reflecting the URL state.
- The products table MUST update reactively (Angular signals) when either filter changes.
- Selecting an option MUST navigate to the URL with the corresponding query param.

### 3.4. Accessibility

- Each filter MUST have an associated `<label>` and/or `aria-label`.
- The filter MUST be keyboard navigable (native `<select>` is acceptable; custom widgets must implement ARIA Listbox/Combobox patterns).

## 4. Non-Functional Requirements

- Filter changes MUST re-render the products list within a single render cycle (signals guarantee this).
- Empty filter combinations MUST show an empty-state message in the table, not a broken page.
- The filter dropdowns SHOULD populate from a single products query response (no extra round-trip) when the response includes a faceted payload.
- The component MUST use `OnPush` change detection.

## 5. Scenarios

### 5.1. Navigate with `?source=mercadolibre`

**Given** the user opens `/products?source=mercadolibre`  
**When** the products page initializes  
**Then** only products with `source === "mercadolibre"` MUST be shown  
**And** the `Origin` filter MUST display `mercadolibre` as the selected option

### 5.2. No query params shows all products

**Given** the user navigates to `/products` with no query params  
**When** the page initializes  
**Then** the products list MUST contain every product  
**And** both filters MUST show an empty/placeholder selection  
**And** no API call MUST include a filter param

### 5.3. Filter values are derived from data, not hardcoded

**Given** the products in the database have sources `{mercadolibre, aliexpress, temu}` and categories `{book, electronics}`  
**When** the filter options are loaded  
**Then** the Origin dropdown MUST list exactly those three sources  
**And** the Product Type dropdown MUST list exactly `book` and `electronics`  
**And** no other values appear in the dropdowns

### 5.4. Changing a filter updates the URL

**Given** the user is on `/products?source=mercadolibre`  
**When** they change the Product Type dropdown to `book`  
**Then** the URL MUST become `/products?source=mercadolibre&type=book`  
**And** the products list MUST update to show only `mercadolibre` products of type `book`

### 5.5. Clearing a filter

**Given** the user is on `/products?source=mercadolibre&type=book`  
**When** they clear the `source` filter  
**Then** the URL MUST become `/products?type=book`  
**And** products of all sources with type `book` MUST be displayed

### 5.6. Deep link from scrapers panel

**Given** a completed `mercadolibre` run exists in the run history  
**When** the user clicks the "View products" action  
**Then** the browser navigates to `/products?source=mercadolibre`  
**And** the products table is pre-filtered as in scenario 5.1
