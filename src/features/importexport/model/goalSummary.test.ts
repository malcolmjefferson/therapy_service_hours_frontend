import { describe, expect, test } from 'vitest';
import { summarizeGoals } from './goalSummary';
import { categories, entry } from './testEntries';

const line = (id: string, lines: ReturnType<typeof summarizeGoals>) => lines.find((l) => l.id === id);

describe('summarizeGoals', () => {
  test('an empty ledger has zero hours and the default targets', () => {
    const lines = summarizeGoals([]);
    expect(lines.map((l) => [l.label, l.approvedHours, l.pendingHours, l.targetHours])).toEqual([
      ['Direct Service', 0, 0, 1200],
      ['Supervision', 0, 0, 100],
      ['Total Activity', 0, 0, 3000],
      ['Total Time On-site', 0, 0, null],
    ]);
  });

  test('approved and pending hours are counted apart and rejected hours count toward nothing', () => {
    const lines = summarizeGoals([
      entry({ status: 'approved', duration_minutes: 90, hours: 1.5 }),
      entry({ status: 'pending', duration_minutes: 45, hours: 0.75 }),
      entry({ status: 'rejected', duration_minutes: 600, hours: 10 }),
    ]);
    expect(line('direct', lines)).toMatchObject({ approvedHours: 1.5, pendingHours: 0.75 });
    expect(line('total', lines)).toMatchObject({ approvedHours: 1.5, pendingHours: 0.75 });
  });

  test('each entry counts toward the goal of its category group, and every entry toward the total', () => {
    const lines = summarizeGoals([
      entry({ category: categories.DIRECT, duration_minutes: 60 }),
      entry({ category: categories.INDIRECT, duration_minutes: 120 }),
      entry({ category: categories.SUPERVISION, duration_minutes: 30 }),
    ]);
    expect(line('direct', lines)?.approvedHours).toBe(1);
    expect(line('supervision', lines)?.approvedHours).toBe(0.5);
    expect(line('total', lines)?.approvedHours).toBe(3.5);
  });

  test('on-site hours are tracked across categories, with no target', () => {
    const lines = summarizeGoals([
      entry({ on_site: true, duration_minutes: 60 }),
      entry({ on_site: true, category: categories.INDIRECT, status: 'pending', duration_minutes: 15 }),
      entry({ on_site: false }),
    ]);
    expect(line('onsite', lines)).toMatchObject({ approvedHours: 1, pendingHours: 0.25, targetHours: null });
  });

  test('an entry that still needs a time keeps its hours toward goals', () => {
    const lines = summarizeGoals([entry({ needs_time: true, status: 'pending', duration_minutes: 120, hours: 2 })]);
    expect(line('direct', lines)?.pendingHours).toBe(2);
  });

  test('the person’s own targets replace the defaults for the goals they name', () => {
    const lines = summarizeGoals([], { direct: 900 });
    expect(line('direct', lines)?.targetHours).toBe(900);
    expect(line('supervision', lines)?.targetHours).toBe(100);
  });

  test('quarter-hours add up exactly', () => {
    const entries = Array.from({ length: 1000 }, () => entry({ duration_minutes: 15 }));
    expect(line('direct', summarizeGoals(entries))?.approvedHours).toBe(250);
  });
});
