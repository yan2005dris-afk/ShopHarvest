# Delta — Nav Integration

## Context

The main app sidebar shows navigation links for the app sections. This change adds an "ETL" link that is visible only when the user is authenticated, navigating to the top-level `/etl-management` route.

## ADDED Requirements

### Requirement: Add "ETL" link in main sidebar

The sidebar component MUST conditionally render an `<a routerLink="/etl-management">` link with label "ETL" and a gear icon. The link MUST be visible when the user has a valid JWT token and hidden when unauthenticated.

#### Scenario: Authenticated user sees ETL link

- GIVEN a user with a valid JWT token
- WHEN the sidebar renders
- THEN an "ETL" link with a gear icon appears among the navigation items
- AND clicking it navigates to `/etl-management`

#### Scenario: Unauthenticated user does not see ETL link

- GIVEN no valid JWT token
- WHEN the sidebar renders
- THEN no "ETL" link appears
- AND the sidebar shows only the public nav items

#### Scenario: ETL link navigates to protected route

- GIVEN an authenticated user clicks the ETL link
- WHEN the router navigates to `/etl-management`
- THEN `authGuard` passes (user is authenticated)
- AND the ETL management page loads

### Requirement: Existing sidebar links unchanged

The existing sidebar links (VisualMapper, Products, Categories, Sources, Setup) MUST remain functional. Their positions, labels, and routes MUST NOT change.

#### Scenario: Existing nav unaffected

- GIVEN the ETL link was added to the sidebar
- WHEN the user clicks "Products"
- THEN the Products page loads as before
