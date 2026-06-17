# Spec — URL Input

## 1. Objective

Provide a frontend page where the user selects a domain, enters a product URL, submits it for scraping, and sees the scraping result (status + scraped data).

## 2. Scope

**In:** Domain selector dropdown, URL input, submit button, result display area, ApiService methods, navigation update.

**Out:** Batch URL input, file upload, real-time status polling with WebSocket, edit selectors from UI.

## 3. Functional Requirements

### 3.1. ApiService Methods
The existing `ApiService` MUST be extended with:
- `getDomains(): Observable<DomainRule[]>` — calls `GET /api/domains`.
- `enqueueJob(domainRuleId: string, url: string): Observable<{ jobId: string }>` — calls `POST /api/scraping-jobs`.
- `getJobStatus(jobId: string): Observable<ScrapingJob>` — calls `GET /api/scraping-jobs/:id`.
- `getJobResult(jobId: string): Observable<any>` — calls `GET /api/scraping-jobs/:id/result`.

TypeScript interfaces for `DomainRule` and `ScrapingJob` MUST be defined in the frontend.

### 3.2. UrlInputComponent
The existing `UrlInputComponent` (pure scaffold) MUST be updated to:

- **Domain Selector**: A `<select>` dropdown populated from `ApiService.getDomains()`. Displays domain names, stores the selected `domainRuleId`. MUST show a loading state while domains load and an empty state if no domains exist.

- **URL Input**: A `<input type="url">` bound to a component property. MUST validate that the URL belongs to the selected domain (the URL's hostname SHOULD match the selected DomainRule's `domain`). If it doesn't match, show a warning — but still allow submission.

- **Submit Button**: Calls `ApiService.enqueueJob(domainRuleId, url)`. MUST be disabled while a request is in flight. MUST show a loading spinner during submission.

- **Result Display**: After submission, the component MUST show:
  - The job status (`queued`, `processing`, `completed`, `failed`) with appropriate styling.
  - For completed jobs: the scraped product data (title, price, currency, image).
  - For failed jobs: the error message.
  - A link to the products page to view full history.

- **Auto-refresh**: After enqueuing, the component SHOULD poll `getJobStatus()` every 3 seconds until the job reaches `completed` or `failed`, with a maximum of 20 polls (60 seconds).

### 3.3. Navigation
The routes in `app.routes.ts` MUST remain:
- `/url-input` → `UrlInputComponent` (default route).
- The component's HTML template MUST be restyled to be functional — current placeholder content replaced with actual form elements.

## 4. Non-Functional Requirements
- All HTTP calls MUST handle errors gracefully: show a user-friendly error message, not a raw console error.
- The component MUST clean up any polling interval on destroy to prevent memory leaks.
- The domain dropdown MUST support keyboard navigation (accessible).

## 5. Scenarios

### 5.1. User submits a URL for scraping
**Given** the domain list is loaded  
**When** the user selects a domain, enters a URL, and clicks submit  
**Then** the button shows a loading state  
**And** `POST /api/scraping-jobs` is called  
**And** the job ID and initial status "queued" are displayed

### 5.2. Job completes successfully
**Given** a job has been submitted  
**When** polling detects status "completed"  
**Then** the product title, price, and image are shown  
**And** the loading spinner is removed

### 5.3. Job fails
**Given** a job has been submitted  
**When** polling detects status "failed"  
**Then** the error message is displayed  
**And** the loading spinner is removed  
**And** the user can try again with the same URL

### 5.4. No domains configured
**Given** no DomainRules exist  
**When** the page loads  
**Then** the dropdown shows "No domains configured"  
**And** the submit button is disabled
