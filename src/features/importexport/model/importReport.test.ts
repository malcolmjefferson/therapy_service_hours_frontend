import { describe, expect, test } from 'vitest';
import type { components } from '../../../lib/api';
import {
  MAX_IMPORT_BYTES,
  checkLedgerFile,
  importFailureMessage,
  reportFileName,
  reportSummary,
  reportToText,
} from './importReport';

type ImportReport = components['schemas']['ImportReport'];

const report: ImportReport = {
  total_rows: 4,
  imported_count: 2,
  needs_time_count: 1,
  merged_clients: [
    { client: { id: '00000000-0000-4000-8000-0000000000d1', name: 'A.B.' }, created: true },
    { client: { id: '00000000-0000-4000-8000-0000000000d2', name: 'C.D.' }, created: false },
  ],
  skipped_count: 2,
  skipped_rows: [
    { row: 3, reason: 'duplicate', message: 'Same date, category, hours, notes and clients.' },
    { row: 4, reason: 'unknown-category', field: 'category', message: 'The category is not valid.' },
  ],
};

describe('checkLedgerFile', () => {
  test('accepts a Markdown file within the limit', () => {
    expect(checkLedgerFile({ name: 'ledger.md', size: 2000 })).toBeUndefined();
    expect(checkLedgerFile({ name: 'LEDGER.MD', size: MAX_IMPORT_BYTES })).toBeUndefined();
  });
  test('refuses other file types, empty files and files over 1 MiB', () => {
    expect(checkLedgerFile({ name: 'ledger.csv', size: 10 })).toMatch(/Markdown/);
    expect(checkLedgerFile({ name: 'ledger.md', size: 0 })).toMatch(/empty/);
    expect(checkLedgerFile({ name: 'ledger.md', size: MAX_IMPORT_BYTES + 1 })).toMatch(/larger than 1 MB/);
  });
});

describe('reportSummary', () => {
  test('describes the result', () => {
    expect(reportSummary(report)).toBe('Imported 2 entries of 4 rows.');
    expect(reportSummary({ ...report, total_rows: 1, imported_count: 1 })).toBe('Imported 1 entry of 1 row.');
    expect(reportSummary({ ...report, imported_count: 0 })).toMatch(/Nothing was imported/);
    expect(reportSummary({ ...report, total_rows: 0, imported_count: 0 })).toMatch(/no entries/);
  });
});

describe('reportToText', () => {
  test('lists counts, clients and each skipped row with its reason', () => {
    const text = reportToText(report, 'ledger.md', new Date('2026-10-27T10:00:00Z'));
    expect(text).toContain('File: ledger.md');
    expect(text).toContain('Date: 2026-10-27');
    expect(text).toContain('Skipped: 2');
    expect(text).toContain('- A.B. (added)');
    expect(text).toContain('- C.D. (already saved)');
    expect(text).toContain('- Row 3: Already imported. Same date, category, hours, notes and clients.');
    expect(text).toContain('- Row 4: Category is not recognised.');
    expect(text.endsWith('\n')).toBe(true);
  });
  test('leaves out sections that are empty', () => {
    const text = reportToText(
      { ...report, merged_clients: [], skipped_rows: [], skipped_count: 0 },
      'a.md',
      new Date(),
    );
    expect(text).not.toContain('Clients / Groups');
    expect(text).not.toContain('Skipped rows');
  });
  test('names the file by date', () => {
    expect(reportFileName(new Date('2026-10-27T23:00:00Z'))).toBe('import-report-2026-10-27.txt');
  });
});

describe('importFailureMessage', () => {
  test('explains each refusal in plain language', () => {
    expect(importFailureMessage(413, 'urn:therapy-service-hours:problem:body-too-large')).toMatch(/1 MB/);
    expect(importFailureMessage(413, 'urn:therapy-service-hours:problem:import-too-many-rows')).toMatch(/5,000/);
    expect(importFailureMessage(400, undefined)).toMatch(/not a Markdown ledger/);
    expect(importFailureMessage(429, undefined)).toMatch(/Wait/);
    expect(importFailureMessage(undefined, undefined)).toMatch(/nothing was saved/);
  });
});
