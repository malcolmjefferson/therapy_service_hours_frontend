const hoursFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false });

/** `value` as a share of `max` between 0 and 100. A missing, negative or non-finite value counts as 0. */
export function percentOf(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || value <= 0 || max <= 0) {
    return 0;
  }
  return Math.min(100, (value / max) * 100);
}

/** `value` held between 0 and `max`, so `aria-valuenow` always sits inside the bar's range. */
export function clampHours(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || value <= 0 || max <= 0) {
    return 0;
  }
  return Math.min(value, max);
}

/**
 * The screen reader text, for example "312 of 1200 hours approved, 20 pending". It reports the
 * real numbers even when approved hours pass the target, so the bar's clamping never hides them.
 */
export function hoursText(approved: number, pending: number, max: number): string {
  return `${hoursFormat.format(approved)} of ${hoursFormat.format(max)} hours approved, ${hoursFormat.format(pending)} pending`;
}

/**
 * The approved and pending widths as percentages of the bar. Pending is cut off at the end of the
 * bar so the two segments together never overflow it.
 */
export function segmentPercents(approved: number, pending: number, max: number): { approved: number; pending: number } {
  const approvedPct = percentOf(approved, max);
  const pendingPct = Math.min(percentOf(pending, max), 100 - approvedPct);
  return { approved: approvedPct, pending: pendingPct };
}
