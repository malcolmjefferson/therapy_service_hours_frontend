/** Sessions are logged in 15-minute steps (CLAUDE.md §7.1, ASM-02). */
export const STEP_MINUTES = 15;

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes since midnight for a 24-hour `HH:MM` value, or `null` when it is empty or malformed. */
export function parseTime(value: string): number | null {
  const match = TIME.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** True when the time sits on a 15-minute step. */
export function isOnStep(minutes: number): boolean {
  return minutes % STEP_MINUTES === 0;
}

/**
 * Session length in minutes, or `null` when either time is missing or the end is not after the
 * start. Sessions never cross midnight, so there is no wrap-around case.
 */
export function durationMinutes(start: string, end: string): number | null {
  const from = parseTime(start);
  const to = parseTime(end);
  if (from === null || to === null || to <= from) return null;
  return to - from;
}

/** Hours to two decimals, for example 75 minutes shows as `1.25` (CLAUDE.md §7.1, ASM-06). */
export function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}
