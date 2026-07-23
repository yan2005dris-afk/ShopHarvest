/**
 * Shared types for the layout subsystem (sidebar, navbar, footer).
 *
 * The sidebar's nav-items are statically declared at module load
 * time and never change at runtime, so we model them as a const
 * tuple (`NAV_ITEMS`) typed by `SidebarNavItem`. New entries that
 * should be guarded by `authGuard` are added as
 * `requiresAuth: true` and the sidebar template filters them through
 * `auth.isAuthenticated()`.
 */
export interface SidebarNavItem {
  /** Route the link navigates to. */
  readonly routerLink: string;
  /** Exact match required on `routerLinkActive` (default true for `/`). */
  readonly exact?: boolean;
  /** Material Symbols icon name. */
  readonly icon: string;
  /** Visible label (i18n hook here once we add translations). */
  readonly label: string;
  /** When true, the link is rendered only if the user is authenticated. */
  readonly requiresAuth?: boolean;
}

/**
 * Canonical sidebar nav. Order = display order top→bottom in the
 * sidebar's <nav>. Adding a new page requires just inserting here and
 * optionally a route in app.routes.ts.
 */
export const NAV_ITEMS: readonly SidebarNavItem[] = [
  {
    routerLink: '/mapper',
    exact: true,
    icon: 'account_tree',
    label: 'Visual Mapper',
  },
  {
    routerLink: '/dashboard',
    icon: 'dashboard',
    label: 'Dashboard',
  },
  {
    routerLink: '/products',
    icon: 'inventory_2',
    label: 'Productos',
  },
  {
    routerLink: '/sources',
    icon: 'settings_input_component',
    label: 'Fuentes',
  },
  {
    routerLink: '/categories',
    icon: 'category',
    label: 'Categorías',
  },
  {
    routerLink: '/etl-management',
    icon: 'memory',
    label: 'ETL',
    requiresAuth: true,
  },
];
