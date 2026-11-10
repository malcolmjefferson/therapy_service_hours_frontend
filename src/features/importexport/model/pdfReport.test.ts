import { describe, expect, test } from 'vitest';
import { buildPdfReport, localIsoDate, pdfRow, PDF_COLUMNS } from './pdfReport';
import { categories, entry, legacyEntry } from './testEntries';

describe('pdfRow', () => {
  test('lists date, times, category, clients, hours, on-site, status and notes', () => {
    const row = pdfRow(
      entry({
        session_date: '2026-01-12',
        start_time: '13:00',
        end_time: '14:15',
        duration_minutes: 75,
        hours: 1.25,
        category: categories.DIRECT,
        clients: [
          { id: '00000000-0000-4000-8000-0000000000a1', name: 'A.B.' },
          { id: '00000000-0000-4000-8000-0000000000a2', name: 'C.D.' },
        ],
        on_site: true,
        status: 'pending',
        notes: 'Follow-up on coping plan.',
      }),
    );
    expect(row).toEqual([
      '2026-01-12',
      '13:00 to 14:15',
      'Individual Counseling',
      'A.B.; C.D.',
      '1.25',
      'Yes',
      'Pending',
      'Follow-up on coping plan.',
    ]);
  });

  test('an entry without times says Needs time, and hours always show two decimals', () => {
    const row = pdfRow(legacyEntry({ hours: 2, status: 'rejected', on_site: false }));
    expect(row[1]).toBe('Needs time');
    expect(row.slice(4, 7)).toEqual(['2.00', 'No', 'Rejected']);
  });
});

describe('buildPdfReport', () => {
  test('column shares add up to the whole table width', () => {
    expect(PDF_COLUMNS.reduce((sum, c) => sum + c.share, 0)).toBeCloseTo(1, 10);
  });

  test('keeps the order it is given and dates the file with the local day', () => {
    const entries = [entry({ session_date: '2026-01-05' }), entry({ session_date: '2026-02-09' })];
    const report = buildPdfReport(entries, new Date(2026, 9, 7, 23, 30));
    expect(report.generatedOn).toBe('2026-10-07');
    expect(report.rows.map((r) => r[0])).toEqual(['2026-01-05', '2026-02-09']);
    expect(report.entryCount).toBe(2);
    expect(report.goals).toHaveLength(4);
  });

  test('localIsoDate pads month and day', () => {
    expect(localIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
