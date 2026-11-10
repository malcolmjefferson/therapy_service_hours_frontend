import { describe, expect, test } from 'vitest';
import { sampleGoals } from '../../../test/handlers';
import { formatHours, formatPercent, parseTarget, withTarget } from './goalCards';

describe('parseTarget', () => {
  test.each([
    ['1200', 1200],
    [' 50 ', 50],
    ['1', 1],
    ['100000', 100000],
  ])('accepts %j', (text, hours) => {
    expect(parseTarget(text)).toEqual({ ok: true, hours });
  });

  test.each([
    ['', 'Enter a target in hours.'],
    ['   ', 'Enter a target in hours.'],
    ['abc', 'Enter a whole number of hours, such as 1200.'],
    ['12.5', 'Enter a whole number of hours, such as 1200.'],
    ['-5', 'Enter a whole number of hours, such as 1200.'],
    ['0', 'The target must be at least 1 hour.'],
    ['100001', 'The target can be at most 100000 hours.'],
  ])('refuses %j', (text, message) => {
    expect(parseTarget(text)).toEqual({ ok: false, message });
  });
});

describe('formatting', () => {
  test('hours show two decimals', () => {
    expect(formatHours(1.25)).toBe('1.25');
    expect(formatHours(40)).toBe('40.00');
  });

  test('percents can pass 100', () => {
    expect(formatPercent(108)).toBe('108%');
  });
});

describe('withTarget', () => {
  const direct = sampleGoals.goals[0];
  const supervision = sampleGoals.goals[1];

  test('applies the saved target and recomputes percents rounding down', () => {
    if (!direct) throw new Error('sample data');
    const updated = withTarget(direct, { goal_type: 'direct', target_hours: 600 });
    expect(updated.target_hours).toBe(600);
    expect(updated.approved_percent).toBe(52); // 312.5 / 600 = 52.08
    expect(updated.pending_percent).toBe(3);
  });

  test('leaves other goals unchanged', () => {
    if (!supervision) throw new Error('sample data');
    expect(withTarget(supervision, { goal_type: 'direct', target_hours: 600 })).toBe(supervision);
  });
});
