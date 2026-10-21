import { describe, expect, test } from 'vitest';
import { sampleEntries } from '../../../test/handlers';
import { describeEntry, draftFromEntry, overlapMessage, requestFromDraft } from './entryMapping';
import { validateEntry } from './validation';

const [entry] = sampleEntries;
if (!entry) throw new Error('sampleEntries is empty');

describe('draftFromEntry', () => {
  test('carries every saved value, so saving an unchanged edit changes nothing', () => {
    const draft = draftFromEntry(entry);
    expect(draft).toEqual({
      sessionDate: '2026-01-12',
      categoryId: '00000000-0000-4000-8000-0000000000c1',
      startTime: '13:00',
      endTime: '14:15',
      clientIds: ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2'],
      onSite: true,
      notes: 'Follow-up on coping plan.',
    });
    expect(validateEntry(draft)).toEqual({});
  });

  test('an entry without notes or times starts with empty strings, and the times fail validation', () => {
    const bare = { ...entry };
    delete bare.notes;
    delete bare.start_time;
    delete bare.end_time;
    const draft = draftFromEntry(bare);
    expect(draft).toMatchObject({ startTime: '', endTime: '', notes: '' });
    expect(Object.keys(validateEntry(draft)).sort()).toEqual(['endTime', 'startTime']);
  });
});

describe('requestFromDraft', () => {
  test('sends the editable fields only: no hours, no duration', () => {
    const request = requestFromDraft(draftFromEntry(entry));
    expect(Object.keys(request).sort()).toEqual([
      'category_id',
      'client_ids',
      'end_time',
      'notes',
      'on_site',
      'session_date',
      'start_time',
    ]);
  });
});

describe('overlapMessage', () => {
  test('names the clashing session as US-04 words it', () => {
    expect(overlapMessage({ id: 'x', session_date: '2026-01-05', start_time: '09:00', end_time: '10:00' })).toBe(
      'This overlaps an existing session on 2026-01-05 (09:00 to 10:00)',
    );
  });

  test('still says something when the server names no session', () => {
    expect(overlapMessage(undefined)).toBe('This overlaps an existing session.');
  });
});

describe('describeEntry', () => {
  test('gives the date, times and category', () => {
    expect(describeEntry(entry)).toBe('Jan 12, 2026, 13:00 to 14:15, Individual Counseling');
  });
});
