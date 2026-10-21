import { describe, expect, test } from 'vitest';
import { emptyDraft, validateEntry, type EntryDraft } from './validation';

const valid: EntryDraft = {
  sessionDate: '2026-10-12',
  categoryId: 'cat-1',
  startTime: '09:00',
  endTime: '10:15',
  clientIds: [],
  onSite: true,
  notes: 'Pseudonym A',
};

describe('validateEntry', () => {
  test('accepts a complete draft', () => {
    expect(validateEntry(valid)).toEqual({});
  });

  test('notes and on-site are optional', () => {
    expect(validateEntry({ ...valid, notes: '', onSite: false })).toEqual({});
  });

  test('asks for every required field on an empty draft', () => {
    expect(Object.keys(validateEntry(emptyDraft)).sort()).toEqual([
      'categoryId',
      'endTime',
      'sessionDate',
      'startTime',
    ]);
  });

  test.each(['2026-02-30', '2026-13-01', '10/12/2026', 'tomorrow'])('rejects the date %j', (sessionDate) => {
    expect(validateEntry({ ...valid, sessionDate }).sessionDate).toBe('Date must be a real date.');
  });

  test('accepts a leap day', () => {
    expect(validateEntry({ ...valid, sessionDate: '2028-02-29' })).toEqual({});
  });

  test('rejects times that are off the 15-minute step', () => {
    const errors = validateEntry({ ...valid, startTime: '09:05', endTime: '10:20' });
    expect(errors.startTime).toBe('Start time must be in 15-minute steps.');
    expect(errors.endTime).toBe('End time must be in 15-minute steps.');
  });

  test.each([
    ['10:00', '10:00'],
    ['11:00', '10:00'],
  ])('rejects an end that is not after the start (%s to %s)', (startTime, endTime) => {
    expect(validateEntry({ ...valid, startTime, endTime }).endTime).toBe(
      'End time must be after the start time on the same day.',
    );
  });

  test('does not also report an ordering error when a time is already invalid', () => {
    expect(validateEntry({ ...valid, startTime: '', endTime: '10:00' })).toEqual({
      startTime: 'Start time is required.',
    });
  });
});
