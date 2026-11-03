import { describe, expect, test } from 'vitest';
import type { components } from '../../../lib/api';
import { sampleEntries } from '../../../test/handlers';
import { CSV_COLUMNS, csvFileName, csvField, entriesToCsv, neutralizeFormula } from './csv';

type Entry = components['schemas']['Entry'];

function entry(overrides: Partial<Entry> = {}): Entry {
  const base = sampleEntries[1];
  if (!base) throw new Error('sampleEntries is empty');
  return { ...base, ...overrides };
}

/** Reads CSV back the RFC 4180 way, so the tests check what a spreadsheet would see. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (quoted) {
      if (char === '"' && text.charAt(i + 1) === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\r' && text.charAt(i + 1) === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else {
      cell += char;
    }
  }
  return rows;
}

describe('neutralizeFormula', () => {
  test.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tcmd', '\rcmd'])('prefixes %j with an apostrophe', (value) => {
    expect(neutralizeFormula(value)).toBe(`'${value}`);
  });

  test.each(['', 'plain', 'A.B.', '2026-01-05', '09:00', '1.25', 'a=b', "'=already", ' =leading space'])(
    'leaves %j alone',
    (value) => {
      expect(neutralizeFormula(value)).toBe(value);
    },
  );
});

describe('csvField', () => {
  test('quotes every field and doubles embedded quotes', () => {
    expect(csvField('plain')).toBe('"plain"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });

  test('exports =1+1 as text', () => {
    expect(csvField('=1+1')).toBe('"\'=1+1"');
  });

  test('neutralizes before quoting, so a quote cannot hide the formula character', () => {
    expect(csvField('=HYPERLINK("http://example.test")')).toBe('"\'=HYPERLINK(""http://example.test"")"');
  });
});

describe('entriesToCsv', () => {
  test('writes the header row, then one CRLF-ended row per entry', () => {
    const csv = entriesToCsv(sampleEntries);
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).not.toMatch(/[^\r]\n/);
  });

  test('keeps the format stable', () => {
    expect(entriesToCsv(sampleEntries)).toMatchInlineSnapshot(`
      ""Date","Start","End","Group","Category","Client","Hours","On-site","Notes","Status"
      "2026-01-12","13:00","14:15","Direct Service","Individual Counseling","A.B.; C.D.","1.25","Yes","Follow-up on coping plan.","pending"
      "2026-01-05","09:00","10:00","Indirect Service","Staff Meetings","","1.00","No","","pending"
      "
    `);
  });

  test('keeps commas, quotes and line breaks in a cell', () => {
    const notes = 'Said "no", then left.\nSecond line,\r\nthird';
    const [, row] = parseCsv(entriesToCsv([entry({ notes })]));
    expect(row?.[8]).toBe(notes);
  });

  test('exports a formula in notes or a client name as text', () => {
    const csv = entriesToCsv([
      entry({ notes: '=1+1', clients: [{ id: '00000000-0000-4000-8000-0000000000a9', name: '@evil' }] }),
    ]);
    const [, row] = parseCsv(csv);
    expect(row?.[8]).toBe("'=1+1");
    expect(row?.[5]).toBe("'@evil");
  });

  test('leaves the times empty on an entry that needs them, and keeps its hours', () => {
    const untimed = entry({ needs_time: true, hours: 1.5, duration_minutes: 90 });
    delete untimed.start_time;
    delete untimed.end_time;
    const [, row] = parseCsv(entriesToCsv([untimed]));
    expect(row?.slice(1, 3)).toEqual(['', '']);
    expect(row?.[6]).toBe('1.50');
  });

  test('writes hours to two decimals and the on-site flag as Yes or No', () => {
    const [, first, second] = parseCsv(
      entriesToCsv([entry({ hours: 0.1 + 0.2, on_site: true }), entry({ hours: 24 })]),
    );
    expect(first?.slice(6, 8)).toEqual(['0.30', 'Yes']);
    expect(second?.slice(6, 8)).toEqual(['24.00', 'No']);
  });

  test('writes only the header for an empty ledger', () => {
    expect(parseCsv(entriesToCsv([]))).toEqual([[...CSV_COLUMNS]]);
  });

  test('starts with a UTF-8 byte-order mark only when asked', () => {
    expect(entriesToCsv([]).startsWith('﻿')).toBe(false);
    expect(entriesToCsv([], { bom: true }).startsWith('﻿"Date"')).toBe(true);
  });

  test('keeps accented names and emoji', () => {
    const [, row] = parseCsv(entriesToCsv([entry({ notes: 'José — café ☕' })]));
    expect(row?.[8]).toBe('José — café ☕');
  });
});

describe('csvFileName', () => {
  test('is dated by the UTC day', () => {
    expect(csvFileName(new Date('2026-10-27T23:30:00Z'))).toBe('therapy-hours-2026-10-27.csv');
  });
});
