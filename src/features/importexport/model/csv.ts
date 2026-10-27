import type { components } from '../../../lib/api';

type Entry = components['schemas']['Entry'];

/** The CSV header, in column order. Start and End are empty on an entry that still needs its times. */
export const CSV_COLUMNS = [
  'Date',
  'Start',
  'End',
  'Group',
  'Category',
  'Client',
  'Hours',
  'On-site',
  'Notes',
  'Status',
] as const;

/** The group names the prototype ledger uses (CLAUDE.md section 12.3). */
const GROUP_LABELS: Record<Entry['category']['group'], string> = {
  direct: 'Direct Service',
  indirect: 'Indirect Service',
  supervision: 'Supervision',
};

/** A spreadsheet reads a cell that starts with one of these as a formula (SEC-37). */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Makes `value` safe to open in a spreadsheet: a cell that would run as a formula gets a leading
 * `'`, which every major spreadsheet shows as plain text (SEC-37).
 */
export function neutralizeFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

/** One RFC 4180 field: always quoted, quotes doubled, commas and line breaks kept as they are. */
export function csvField(value: string): string {
  return `"${neutralizeFormula(value).replaceAll('"', '""')}"`;
}

function entryFields(entry: Entry): string[] {
  return [
    entry.session_date,
    entry.start_time ?? '',
    entry.end_time ?? '',
    GROUP_LABELS[entry.category.group],
    entry.category.name,
    // The same `; ` join the Markdown ledger uses.
    entry.clients.map((client) => client.name).join('; '),
    entry.hours.toFixed(2),
    entry.on_site ? 'Yes' : 'No',
    entry.notes ?? '',
    entry.status,
  ];
}

const UTF8_BOM = '﻿';

export interface CsvOptions {
  /** Start the file with a UTF-8 byte-order mark, which Excel needs to read accented names correctly. */
  bom?: boolean;
}

/** The whole file: a header row and one row per entry, CRLF between rows as RFC 4180 asks. */
export function entriesToCsv(entries: readonly Entry[], { bom = false }: CsvOptions = {}): string {
  const rows = [[...CSV_COLUMNS], ...entries.map(entryFields)];
  const body = rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
  return bom ? UTF8_BOM + body : body;
}

/** `therapy-hours-2026-10-27.csv`, dated by the day the file was made (UTC, like the rest of the app's dates). */
export function csvFileName(now: Date): string {
  return `therapy-hours-${now.toISOString().slice(0, 10)}.csv`;
}
