import type { components } from '../../../lib/api';

type Entry = components['schemas']['Entry'];

export interface GoalLine {
  id: 'direct' | 'supervision' | 'total' | 'onsite';
  label: string;
  /** Approved hours, which drive progress (CLAUDE.md section 7.2). */
  approvedHours: number;
  /** Pending hours: logged but not yet approved. Rejected hours count toward nothing. */
  pendingHours: number;
  /** Target in hours, or `null` for the on-site total, which is tracked without a target. */
  targetHours: number | null;
}

interface GoalRule {
  id: GoalLine['id'];
  label: string;
  /** The default target; targets are per-user settings, so a caller with the real ones passes them in. */
  defaultTarget: number | null;
  counts: (entry: Entry) => boolean;
}

const GOALS = [
  { id: 'direct', label: 'Direct Service', defaultTarget: 1200, counts: (e) => e.category.group === 'direct' },
  { id: 'supervision', label: 'Supervision', defaultTarget: 100, counts: (e) => e.category.group === 'supervision' },
  { id: 'total', label: 'Total Activity', defaultTarget: 3000, counts: () => true },
  { id: 'onsite', label: 'Total Time On-site', defaultTarget: null, counts: (e) => e.on_site },
] as const satisfies readonly GoalRule[];

/** Targets in hours by goal id, for the goals that have one. */
export type GoalTargets = Partial<Record<GoalLine['id'], number>>;

/**
 * Hours toward each goal from a whole ledger: approved hours and pending hours, rejected excluded. Hours are
 * summed as minutes and divided once, so quarter-hours never pick up floating-point drift.
 */
export function summarizeGoals(entries: readonly Entry[], targets: GoalTargets = {}): GoalLine[] {
  return GOALS.map((goal) => {
    let approved = 0;
    let pending = 0;
    for (const entry of entries) {
      if (!goal.counts(entry)) continue;
      if (entry.status === 'approved') approved += entry.duration_minutes;
      else if (entry.status === 'pending') pending += entry.duration_minutes;
    }
    return {
      id: goal.id,
      label: goal.label,
      approvedHours: approved / 60,
      pendingHours: pending / 60,
      targetHours: targets[goal.id] ?? goal.defaultTarget,
    };
  });
}
