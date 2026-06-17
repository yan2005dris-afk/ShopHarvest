# Delta for URL Input

## REMOVED Requirements

### R1: UrlInputComponent

The UrlInputComponent is removed and replaced by the VisualMapperComponent.

(Reason: Manual URL input with dropdown domain selector is superseded by the visual CSS selector mapper, which provides a richer interactive experience)
(Migration: The default route `/` now loads VisualMapperComponent. All functionality (domain selection, URL entry, job triggering) is absorbed into the mapper UI.)

### R2: /url-input Route

The route `/url-input` mapping to UrlInputComponent is removed.

(Reason: Replaced by VisualMapperComponent at `/`)
(Migration: Navigate to `/` instead)

### R3: ApiService.enqueueJob Call from UrlInput

The direct API call to `POST /api/scraping-jobs` from the url-input page is no longer provided. Instead, the visual mapper uses `POST /api/scrape-listing` for batch jobs.

(Reason: The listing endpoint provides the correct entry point for the new workflow)
(Migration: Use VisualMapperComponent which calls fetch-page then scrape-listing)
