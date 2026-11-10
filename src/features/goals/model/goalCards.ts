import type { ProgressBarTone } from '../../../components';
import type { components } from '../../../lib/api';

export type GoalType = components['schemas']['GoalType'];
export type GoalProgress = components['schemas']['GoalProgress'];
type GoalTarget = components['schemas']['GoalTarget'];

/** How each goal looks on its card (FE-14). A new goal type is a compile error until it is added here. */
export const goalCardConfig = {
  direct: { title: 'Direct Service', tone: 'gold', hasTarget: true },
  supervision: { title: 'Supervision', tone: 'red', hasTarget: true },
  total_activity: { title: 'Total Activity', tone: 'lime', hasTarget: true },
  on_site: { title: 'Total Time On-site', tone: null, hasTarget: false },
} as const satisfies Record<GoalType, { title: string; tone: ProgressBarTone | null; hasTarget: boolean }>;

const hoursFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const targetFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, useGrouping: false });

/** Hours to two decimals, for example 1.25 (ASM-06). */
export function formatHours(hours: number): string {
  return hoursFormat.format(hours);
}

/** A target in whole hours. */
export function formatTarget(hours: number): string {
  return targetFormat.format(hours);
}

/** A whole-number percent that can pass 100, for example "108%". */
export function formatPercent(percent: number): string {
  return `${String(percent)}%`;
}

/** Whole percent of `target`, rounded down like the server, so the bar and the number agree after an edit. */
function percentOfTarget(hours: number, target: number): number {
  return Math.floor((hours / target) * 100);
}

/** `goal` with the saved target applied, and its percents recomputed. Other goals pass through unchanged. */
export function withTarget(goal: GoalProgress, saved: GoalTarget): GoalProgress {
  if (goal.goal_type !== saved.goal_type) return goal;
  return {
    ...goal,
    target_hours: saved.target_hours,
    approved_percent: percentOfTarget(goal.approved_hours, saved.target_hours),
    pending_percent: percentOfTarget(goal.pending_hours, saved.target_hours),
  };
}

export const MIN_TARGET = 1;
export const MAX_TARGET = 100000;

export type TargetInput = { ok: true; hours: number } | { ok: false; message: string };

/** Checks the typed target before it is sent. The server is the authority (FE-40). */
export function parseTarget(text: string): TargetInput {
  const value = text.trim();
  if (value === '') return { ok: false, message: 'Enter a target in hours.' };
  if (!/^\d+$/.test(value)) return { ok: false, message: 'Enter a whole number of hours, such as 1200.' };
  const hours = Number(value);
  if (hours < MIN_TARGET) return { ok: false, message: 'The target must be at least 1 hour.' };
  if (hours > MAX_TARGET) return { ok: false, message: `The target can be at most ${String(MAX_TARGET)} hours.` };
  return { ok: true, hours };
}
