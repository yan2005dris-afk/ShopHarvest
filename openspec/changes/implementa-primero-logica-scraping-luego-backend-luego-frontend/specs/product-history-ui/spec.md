# Spec — Product History UI

## 1. Objective

Provide a frontend page that lists all tracked products with their current price and shows a price history table (and optional chart) for each product.

## 2. Scope

**In:** Products list page, price history table, minimal chart, ApiService methods, navigation link, loading/empty states.

**Out:** CRUD from UI, batch operations, advanced filtering, export, WebSocket live updates.

## 3. Functional Requirements

### 3.1. ApiService Methods
The `ApiService` MUST be extended with:
- `getProducts(includeHistory?: boolean): Observable<Product[]>` — calls `GET /api/products`.
- `getProduct(id: string): Observable<Product>` — calls `GET /api/products/:id`.
- `getPriceHistory(productId: string, from?: string, to?: string): Observable<PriceHistory[]>` — calls `GET /api/products/:productId/history`.

TypeScript interfaces MUST be defined for `Product` and `PriceHistory`.

### 3.2. Products List Page
A new `ProductsComponent` MUST be created at `src/app/pages/products/` with route `/products`.

The page MUST display:
- A **header** with the page title ("Productos" / "Products") and the total product count.
- A **search/filter input** that filters the product list by title (client-side filter, MAY be debounced).

The **product list** MUST show each product as a card or table row containing:
- Product title (linked to detail view or expandable).
- Current price with currency.
- Domain name.
- Last extracted date.
- Thumbnail image (if `imageUrl` is present).

### 3.3. Price History View
Clicking on a product MUST toggle or navigate to show its price history.

The price history MUST display:
- A **table** with columns: Date (capturedAt), Price, Currency. Ordered by date DESC.
- A **simple line chart** showing price over time (MAY use Canvas-based rendering or a lightweight library like Chart.js).

The chart SHOULD:
- Use the `capturedAt` as the X-axis and `price` as the Y-axis.
- Show a line connecting price points.
- Handle as few as 1 data point (show a dot).

### 3.4. Navigation
- A navigation link to `/products` MUST be added to the app shell (or a simple nav bar in `app.html`), alongside the existing `/url-input` route.
- The route `{ path: 'products', component: ProductsComponent }` MUST be registered in `app.routes.ts`.

### 3.5. States
The page MUST handle:
- **Loading**: Show a skeleton or spinner while products load.
- **Empty**: Show "No products tracked yet. Start by scraping a URL." with a link to `/url-input`.
- **Error**: Show an error message with a retry button.

## 4. Non-Functional Requirements
- The price history chart MUST NOT block the initial page render (deferred or lazy-loaded).
- The product list MUST be responsive (single column on mobile, grid on desktop).
- Client-side search MUST handle accented characters (e.g., "camiseta" matches "camiseta").

## 5. Scenarios

### 5.1. View products list
**Given** at least one Product exists  
**When** the user navigates to `/products`  
**Then** the product list is displayed with title, price, domain, and date

### 5.2. Expand price history
**Given** a product with multiple PriceHistory entries  
**When** the user clicks on the product  
**Then** the price history table appears  
**And** the price-over-time chart is rendered

### 5.3. Empty state
**Given** no Products exist  
**When** the user navigates to `/products`  
**Then** a message "No products tracked yet" is shown  
**And** a link to `/url-input` is displayed

### 5.4. Client-side search
**Given** 10 products with different titles  
**When** the user types "zapato" in the search field  
**Then** only products whose title contains "zapato" are shown
