import { describe, expect, test } from 'vitest';
import { formatSessionDate, formatTimeRange } from './format';

describe('formatSessionDate', () => {
  test('formats the calendar day as written, whatever the time zone', () => {
    expect(formatSessionDate('2026-01-05')).toBe('Jan 5, 2026');
    expect(formatSessionDate('2026-12-31')).toBe('Dec 31, 2026');
  });

  test('shows an unreadable date as it came rather than "Invalid Date"', () => {
    expect(formatSessionDate('soon')).toBe('soon');
  });
});

describe('formatTimeRange', () => {
  test('joins start and end', () => {
    expect(formatTimeRange('09:00', '10:15')).toBe('09:00 to 10:15');
  });

  test('is null for a legacy entry without times', () => {
    expect(formatTimeRange(undefined, undefined)).toBeNull();
  });
});
