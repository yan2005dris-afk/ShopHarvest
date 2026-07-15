import { registerBones, configureBoneyard } from 'boneyard-js/angular';
// SkeletonResult is declared in the root boneyard-js/types; the
// /angular entry re-exports the components but not all the type
// helpers. Importing the type from the root keeps our preset
// declarations strongly typed.
import type { SkeletonResult } from 'boneyard-js';

/**
 * Preset shapes registered with boneyard-js.
 *
 * Each preset is a `SkeletonResult` describing the skeleton for a
 * single component. When `<boneyard-skeleton name="card"
 * [loading]="...">` renders, boneyard takes the matching preset and
 * lays out the bones at the container's width via `computeLayout`
 * (a pure-JS layout engine — no DOM required, no SSR trip-ups).
 *
 * Coordinates use the canonical M3 card layout:
 *   - 240px square image at the top
 *   - 14px title lines (1.5x), then a 22px price row, then a 14px
 *     source badge
 *
 * Coordinates are authored against a 240px container; boneyard
 * scales them at runtime based on the actual container width.
 */
const PRODUCT_CARD: SkeletonResult = {
  name: 'card',
  viewportWidth: 0,
  width: 240,
  height: 320,
  bones: [
    { x: 0, y: 0, w: 240, h: 240, r: 12, c: true }, // image area (container)
    { x: 12, y: 252, w: 200, h: 14, r: 4 }, // title line 1
    { x: 12, y: 272, w: 140, h: 14, r: 4 }, // title line 2
    { x: 12, y: 296, w: 110, h: 18, r: 4 }, // price row
  ],
};

const KPI_TILE: SkeletonResult = {
  name: 'kpi',
  viewportWidth: 0,
  width: 240,
  height: 96,
  bones: [
    { x: 0, y: 0, w: 80, h: 12, r: 4, c: true }, // uppercase label
    { x: 0, y: 24, w: 140, h: 36, r: 6 }, // big metric value
    { x: 0, y: 72, w: 100, h: 12, r: 4 }, // delta / subtitle
  ],
};

const SOURCE_ROW: SkeletonResult = {
  name: 'sourceRow',
  viewportWidth: 0,
  width: 240,
  height: 56,
  bones: [
    { x: 0, y: 0, w: 140, h: 18, r: 4, c: true }, // source name
    { x: 156, y: 12, w: 84, h: 32, r: 8 }, // action button
  ],
};

/**
 * Map of preset name → SkeletonResult. boneyard's `registerBones`
 * accepts this shape directly.
 */
export const CARD_BONES: Record<string, SkeletonResult> = {
  card: PRODUCT_CARD,
  kpi: KPI_TILE,
  sourceRow: SOURCE_ROW,
};

/**
 * Bootstraps the boneyard-js presets and global styling.
 *
 * Colors come from the Insight Flow palette tokens so skeletons
 * blend with the rest of the design system. boneyard swaps
 * `darkColor` automatically when `class="dark"` lands on <html>.
 */
export function registerBoneyardPresets(): void {
  // High-level config: Insight Flow surface tones. boneyard's
  // SHIMMER animation highlights (#f7f7f7 / #2c2c2c) are computed
  // internally from these base colors.
  configureBoneyard({
    color: '#e7eeff', // surface-container (light base)
    darkColor: '#191b25', // surface-container-low (dark base)
    animate: 'shimmer',
    stagger: true,
  });

  registerBones(CARD_BONES);
}