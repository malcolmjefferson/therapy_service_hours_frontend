/**
 * Column widths as whole tenths of a percent, so they always add up to exactly 1000 (100%) and
 * resizing never drifts by a rounding error.
 */
export type ColumnWidths = readonly number[];

/** Date, Time, Category, Client, Hours, On-site, Notes. */
export const DEFAULT_WIDTHS: ColumnWidths = [120, 120, 160, 140, 100, 100, 260];

/** Total of all columns: 100%. */
export const TOTAL_WIDTH = 1000;

/** No column gets narrower than 10%, so a heading and its sort arrow stay readable. */
export const MIN_WIDTH = 100;

/** One arrow-key press moves the edge by 1%. */
export const KEY_STEP = 10;

/**
 * Moves the edge between column `index` and the one after it by `delta` tenths of a percent: the
 * left column grows by what the right column loses, so the total never changes. The move stops
 * where either column would fall under the minimum.
 */
export function resizeEdge(widths: ColumnWidths, index: number, delta: number): ColumnWidths {
  const left = widths[index];
  const right = widths[index + 1];
  if (left === undefined || right === undefined) return widths;
  const moved = Math.max(MIN_WIDTH - left, Math.min(right - MIN_WIDTH, Math.round(delta)));
  if (moved === 0) return widths;
  return widths.map((width, i) => (i === index ? left + moved : i === index + 1 ? right - moved : width));
}

/** A width as a percentage string for `aria-valuenow` and the CSS variable, e.g. `17` or `12.5`. */
export function toPercent(width: number): number {
  return width / 10;
}
