/**
 * Layout barrel — re-exports every primitive under src/app/layout/
 * so consumers can do `import { SidebarComponent, ThemeToggleComponent }
 * from './layout';` instead of memorizing folder paths.
 *
 * The CSS that backs the .nav-item / dim-tint rules lives at
 * layout.css and is bundled by each consuming component via
 * Angular's `styleUrls`. There is no JS-level CSS import needed.
 */

export { SidebarComponent } from './sidebar/sidebar.component';
export { ThemeToggleComponent } from './theme-toggle/theme-toggle.component';
export { ExtensionStatusComponent } from './extension-status/extension-status.component';
export { NAV_ITEMS, type SidebarNavItem } from './layout.types';