import { describe, expect, test } from 'vitest';
import { durationMinutes, formatHours, isOnStep, parseTime } from './time';

describe('parseTime', () => {
  test.each([
    ['00:00', 0],
    ['09:30', 570],
    ['23:45', 1425],
  ])('reads %s as %i minutes', (value, minutes) => {
    expect(parseTime(value)).toBe(minutes);
  });

  test.each(['', '9:30', '24:00', '12:60', '12:30:15', 'noon'])('rejects %j', (value) => {
    expect(parseTime(value)).toBeNull();
  });
});

describe('isOnStep', () => {
  test.each([0, 15, 570, 1425])('%i is on a 15-minute step', (minutes) => {
    expect(isOnStep(minutes)).toBe(true);
  });
  test.each([1, 14, 571])('%i is not', (minutes) => {
    expect(isOnStep(minutes)).toBe(false);
  });
});

describe('durationMinutes', () => {
  test('is the gap between start and end', () => {
    expect(durationMinutes('09:00', '10:15')).toBe(75);
  });
  test.each([
    ['', '10:00'],
    ['09:00', ''],
    ['10:00', '10:00'],
    ['11:00', '10:00'],
    ['bad', '10:00'],
  ])('is null for %j to %j', (start, end) => {
    expect(durationMinutes(start, end)).toBeNull();
  });
});

describe('formatHours', () => {
  test.each([
    [15, '0.25'],
    [60, '1.00'],
    [75, '1.25'],
    [90, '1.50'],
    [465, '7.75'],
  ])('shows %i minutes as %s hours', (minutes, text) => {
    expect(formatHours(minutes)).toBe(text);
  });
});
