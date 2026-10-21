import { describe, expect, test } from 'vitest';
import { clampHours, hoursText, percentOf, segmentPercents } from './progress';

describe('percentOf', () => {
  test.each([
    [312, 1200, 26],
    [0, 1200, 0],
    [1200, 1200, 100],
    [1500, 1200, 100],
    [-5, 1200, 0],
    [5, 0, 0],
    [5, -10, 0],
    [Number.NaN, 100, 0],
    [5, Number.POSITIVE_INFINITY, 0],
  ])('%d of %d is %d%%', (value, max, expected) => {
    expect(percentOf(value, max)).toBe(expected);
  });
});

describe('clampHours', () => {
  test.each([
    [312, 1200, 312],
    [1500, 1200, 1200],
    [-1, 1200, 0],
    [Number.NaN, 1200, 0],
    [5, 0, 0],
  ])('%d against a target of %d is %d', (value, max, expected) => {
    expect(clampHours(value, max)).toBe(expected);
  });
});

describe('hoursText', () => {
  test('reads as the acceptance criterion', () => {
    expect(hoursText(312, 20, 1200)).toBe('312 of 1200 hours approved, 20 pending');
  });

  test('keeps fractions to two places and drops thousands separators', () => {
    expect(hoursText(1234.567, 0.5, 3000)).toBe('1234.57 of 3000 hours approved, 0.5 pending');
  });

  test('reports hours past the target as they are', () => {
    expect(hoursText(1300, 0, 1200)).toBe('1300 of 1200 hours approved, 0 pending');
  });
});

describe('segmentPercents', () => {
  test('lays pending after approved', () => {
    expect(segmentPercents(300, 150, 1200)).toEqual({ approved: 25, pending: 12.5 });
  });

  test('cuts pending off at the end of the bar', () => {
    expect(segmentPercents(1000, 600, 1200)).toEqual({
      approved: (1000 / 1200) * 100,
      pending: 100 - (1000 / 1200) * 100,
    });
  });

  test('gives pending no room when approved already fills the bar', () => {
    expect(segmentPercents(1200, 50, 1200)).toEqual({ approved: 100, pending: 0 });
  });
});
