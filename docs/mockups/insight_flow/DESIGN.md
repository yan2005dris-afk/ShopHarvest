---
name: Insight Flow
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#464554'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#4b5a9c'
  on-secondary: '#ffffff'
  secondary-container: '#a6b5fd'
  on-secondary-container: '#354585'
  tertiary: '#5b5e65'
  on-tertiary: '#ffffff'
  tertiary-container: '#74777e'
  on-tertiary-container: '#03050a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#dde1ff'
  secondary-fixed-dim: '#b8c4ff'
  on-secondary-fixed: '#001354'
  on-secondary-fixed-variant: '#334282'
  tertiary-fixed: '#e0e2ea'
  tertiary-fixed-dim: '#c4c6ce'
  on-tertiary-fixed: '#181c21'
  on-tertiary-fixed-variant: '#43474d'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.08em
  metric-value:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.03em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  sidebar_width: 240px
  container_max_width: 1440px
  gutter: 1.5rem
  card_padding: 1.5rem
  stack_sm: 0.5rem
  stack_md: 1rem
  stack_lg: 2rem
---

## Brand & Style

The design system is engineered for professional Business Intelligence environments where clarity and data density are paramount. The brand personality is **analytical, sophisticated, and reliable**. It balances the clinical precision required for data visualization with a soft, modern aesthetic that reduces cognitive fatigue during long sessions.

The visual style is **Corporate / Modern** with a lean toward **Minimalism**. It utilizes a "soft-functional" approach: high-utility layouts characterized by generous white space, subtle tonal layering for depth, and a refined color palette that distinguishes between navigational elements and actionable data insights. The UI should evoke a sense of calm control, allowing complex datasets to remain the focal point.

## Colors

The palette is anchored by a **Lavender and Indigo** core, used primarily for brand identification and primary actions. The background utilizes a very light cool-grey (`#F8FAFC`) to provide a clean canvas for white data cards.

*   **Primary (Indigo):** Used for primary buttons, active sidebar states, and key data series.
*   **Secondary (Lavender):** Used for hover states, selection overlays, and secondary data markers.
*   **Status Indicators:** These use high-chroma values to ensure immediate recognition:
    *   **Success/Active:** Emerald green for positive growth or "Scrape Active" states.
    *   **Warning/Needs Extension:** Amber for alerts that require attention but aren't critical.
    *   **Error/Pending:** Crimson for stalled processes or negative outliers.
*   **Neutrals:** Slate tones are used for typography to ensure high legibility without the harshness of pure black.

## Typography

**Hanken Grotesk** is the sole typeface, chosen for its exceptional legibility in data-heavy contexts and its contemporary, sharp geometry. 

For BI dashboards, we introduce a specific `metric-value` style designed for high-level KPIs. Labels utilize a tracked-out uppercase style to differentiate "metadata" from "content data." Paragraph text should maintain a 1.6x line height to ensure readability in descriptive analysis sections.

## Layout & Spacing

The design system employs a **Fixed Sidebar + Fluid Content** layout model. The sidebar remains fixed at 240px, while the main stage utilizes a 12-column fluid grid system.

*   **Grid:** 24px (1.5rem) gutters between all major dashboard cards.
*   **Margins:** 32px page margins on desktop; 16px on mobile.
*   **Responsive Reflow:**
    *   **Desktop:** Cards span 3, 4, 6, or 12 columns.
    *   **Tablet:** KPI cards reflow to 2 columns; charts span 12.
    *   **Mobile:** Sidebar collapses into a hamburger menu; all cards stack vertically to 12 columns.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** rather than aggressive shadows. 

1.  **Level 0 (Background):** `#F8FAFC` - The base canvas.
2.  **Level 1 (Cards/Sidebar):** White `#FFFFFF` with a subtle, ultra-diffused shadow (`0 1px 3px rgba(0,0,0,0.05)`) and a 1px border in `#E2E8F0`.
3.  **Level 2 (Modals/Popovers):** White with a medium shadow (`0 10px 15px rgba(0,0,0,0.1)`) to indicate significant separation from the data plane.

Interactive elements (buttons) use a slight Y-axis shift and brightness increase on hover rather than an elevation change.

## Shapes

The shape language is **Rounded**, conveying a modern and approachable feel.

*   **Standard Elements (Cards, Inputs):** 0.5rem (8px) radius.
*   **Large Elements (Dialogs, Feature Cards):** 1rem (16px) radius.
*   **Interactive Elements (Buttons, Chips):** Use the standard 8px radius or fully pill-shaped (rounded-full) for status badges to distinguish them from actionable buttons.

## Components

### Sidebar Navigation
The sidebar should use a transparent background for inactive items and a soft Lavender (`#EEF2FF`) background with an Indigo left-border for active states. Icons should be stroke-based (2px weight).

### Data Cards
Cards must include a clear Title (Headline-SM) and a Subtitle (Label-Caps in muted grey). KPI cards should feature a colored top-border (2px) corresponding to the metric's category or status.

### Buttons & Chips
*   **Primary Button:** Solid Indigo with white text.
*   **Status Chips:** Light tinted background (10% opacity of status color) with high-contrast text and a leading 6px dot indicator.
*   **Action Chips:** Light grey borders, used for filters.

### Input Fields
Inputs should have a subtle `#F1F5F9` background and no border until focused. On focus, use a 2px Indigo ring.

### Data Visualization
Charts should use a primary Indigo palette, supplemented by teal and soft orange for multi-series data. Grid lines in charts should be kept to a minimum using `#F1F5F9`.