import { describe, expect, test } from 'vitest';
import type { components } from '../../../lib/api';
import { sampleEntries } from '../../../test/handlers';
import { parseLedger } from '../../../test/ledgerParser';
import { serializeLedger } from './markdown';

type Entry = components['schemas']['Entry'];

const BASE: Entry = {
  id: '00000000-0000-4000-8000-0000000000f1',
  session_date: '2026-02-03',
  start_time: '09:00',
  end_time: '10:30',
  duration_minutes: 90,
  hours: 1.5,
  category: { id: '00000000-0000-4000-8000-0000000000c1', name: 'Individual Counseling', group: 'direct' },
  clients: [],
  on_site: false,
  status: 'pending',
  needs_time: false,
  created_at: '2026-02-03T20:00:00Z',
  updated_at: '2026-02-03T20:00:00Z',
};

function entry(changes: Partial<Entry>): Entry {
  return { ...BASE, ...changes };
}

/** The data rows of the entries table, as the lines of text. */
function dataRows(markdown: string): string[] {
  return markdown.split('\n').filter((line) => line.startsWith('| 20'));
}

describe('serializeLedger', () => {
  test('writes the documented ledger layout, header included', () => {
    const oldestFirst = [...sampleEntries].reverse();
    expect(serializeLedger(oldestFirst)).toBe(`# Clinical Hours Ledger

## Summary

- Direct Service: 1.25 hours
- Indirect Service: 1.00 hours
- Supervision: 0.00 hours
- Total Activity: 2.25 hours
- Total Time On-site: 1.25 hours

## Clients / Groups

- A.B.
- C.D.

## Entries

| Date | Start | End | Group | Category | Client | Hours | On-site | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-01-05 | 09:00 | 10:00 | Indirect Service | Staff Meetings | — | 1.00 | No |  |
| 2026-01-12 | 13:00 | 14:15 | Direct Service | Individual Counseling | A.B.; C.D. | 1.25 | Yes | Follow-up on coping plan. |
`);
  });

  test('an empty ledger is still a file the importer accepts', () => {
    const markdown = serializeLedger([]);
    expect(markdown).toContain('| Date | Start | End | Group | Category | Client | Hours | On-site | Notes |');
    expect(markdown).toContain('## Clients / Groups\n\n- —\n');
    expect(parseLedger(markdown)).toEqual({ clients: [], rows: [] });
  });

  test('an entry without times keeps its hours and shows no times', () => {
    const legacy: Entry = {
      id: BASE.id,
      session_date: BASE.session_date,
      duration_minutes: 20,
      hours: 0.33,
      category: BASE.category,
      clients: [],
      on_site: false,
      status: 'pending',
      needs_time: true,
      created_at: BASE.created_at,
      updated_at: BASE.updated_at,
    };
    expect(dataRows(serializeLedger([legacy]))).toEqual([
      '| 2026-02-03 | — | — | Direct Service | Individual Counseling | — | 0.33 | No |  |',
    ]);
  });

  test('escapes pipes in the category, clients and notes', () => {
    const piped = entry({
      category: { ...BASE.category, name: 'Intake | Review' },
      clients: [{ id: BASE.id, name: 'A|B' }],
      notes: 'a | b \\| c',
    });
    const [line] = dataRows(serializeLedger([piped]));
    expect(line).toBe(
      '| 2026-02-03 | 09:00 | 10:30 | Direct Service | Intake \\| Review | A\\|B | 1.50 | No | a \\| b \\\\| c |',
    );
    expect(parseLedger(serializeLedger([piped])).rows[0]).toMatchObject({
      category: 'Intake | Review',
      clients: ['A|B'],
      notes: 'a | b \\| c',
    });
  });

  test('keeps a row on one line: line breaks in notes become a space', () => {
    const multiline = entry({ notes: 'first line\r\nsecond line\n\n  third\tline' });
    const markdown = serializeLedger([multiline]);
    expect(dataRows(markdown)).toHaveLength(1);
    expect(parseLedger(markdown).rows[0]?.notes).toBe('first line second line third\tline');
  });

  test('writes text that looks like markup, SQL or a formula exactly as typed', () => {
    const notes = `<script>alert(1)</script> '; DROP TABLE entries;-- =1+1 [x](javascript:alert(1)) 100% _a_`;
    expect(parseLedger(serializeLedger([entry({ notes })])).rows[0]?.notes).toBe(notes);
  });

  test('lists saved clients first, then clients found on entries, ignoring case', () => {
    const markdown = serializeLedger(
      [
        entry({
          clients: [
            { id: '1', name: 'zed' },
            { id: '2', name: 'AB' },
          ],
        }),
      ],
      { savedClients: ['Ab', 'Cy'] },
    );
    expect(parseLedger(markdown).clients).toEqual(['Ab', 'Cy', 'zed']);
  });

  test('the summary leaves out rejected entries, like goal progress', () => {
    const markdown = serializeLedger([entry({}), entry({ status: 'rejected', on_site: true })]);
    expect(markdown).toContain('- Total Activity: 1.50 hours');
    expect(markdown).toContain('- Total Time On-site: 0.00 hours');
    expect(dataRows(markdown)).toHaveLength(2);
  });

  test('is deterministic', () => {
    const entries = [...sampleEntries];
    expect(serializeLedger(entries)).toBe(serializeLedger(entries));
  });
});
