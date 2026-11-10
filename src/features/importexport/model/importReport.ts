import type { components } from '../../../lib/api';

type ImportReport = components['schemas']['ImportReport'];
type SkipReason = components['schemas']['SkipReason'];

/** The largest ledger the server takes (`POST /import/markdown`): 1 MiB. */
export const MAX_IMPORT_BYTES = 1_048_576;

/** Plain-language names for why a row was skipped. `satisfies` makes tsc fail when the spec adds a reason (FE-29). */
export const SKIP_REASON_LABEL = {
  duplicate: 'Already imported',
  overlap: 'Overlaps another session',
  'malformed-row': 'Row has the wrong columns',
  'invalid-date': 'Date is not valid',
  'invalid-time': 'Time is not valid',
  'invalid-hours': 'Hours are not valid',
  'unknown-category': 'Category is not recognised',
  'invalid-client': 'Client name is not valid',
  'invalid-notes': 'Notes are not valid',
} as const satisfies Record<SkipReason, string>;

/** Why a chosen file cannot be imported, or `undefined` when it can be tried. The server stays the authority. */
export function checkLedgerFile(file: { name: string; size: number }): string | undefined {
  if (!/\.(md|markdown|txt)$/i.test(file.name)) return 'Choose a Markdown ledger file (.md).';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_IMPORT_BYTES) return 'That file is larger than 1 MB, which is the most that can be imported.';
  return undefined;
}

const plural = (count: number, one: string, many: string) => `${String(count)} ${count === 1 ? one : many}`;

/** One sentence that says what the import did. */
export function reportSummary(report: ImportReport): string {
  if (report.total_rows === 0) return 'The file has no entries to import.';
  if (report.imported_count === 0) return 'Nothing was imported. Every row was skipped.';
  return `Imported ${plural(report.imported_count, 'entry', 'entries')} of ${plural(report.total_rows, 'row', 'rows')}.`;
}

/** The report as a plain-text file the person can keep (S4-10). It holds counts, reasons and client names only. */
export function reportToText(report: ImportReport, fileName: string, now: Date): string {
  const lines = [
    'Import report',
    `File: ${fileName}`,
    `Date: ${now.toISOString().slice(0, 10)}`,
    '',
    reportSummary(report),
    `Rows in file: ${String(report.total_rows)}`,
    `Imported: ${String(report.imported_count)}`,
    `Imported without times (need a time): ${String(report.needs_time_count)}`,
    `Skipped: ${String(report.skipped_count)}`,
  ];
  if (report.merged_clients.length > 0) {
    lines.push('', 'Clients / Groups');
    for (const { client, created } of report.merged_clients) {
      lines.push(`- ${client.name} (${created ? 'added' : 'already saved'})`);
    }
  }
  if (report.skipped_rows.length > 0) {
    lines.push('', 'Skipped rows');
    for (const skipped of report.skipped_rows) {
      lines.push(`- Row ${String(skipped.row)}: ${SKIP_REASON_LABEL[skipped.reason]}. ${skipped.message}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/** `import-report-2026-10-27.txt`, dated by the day the report was made. */
export function reportFileName(now: Date): string {
  return `import-report-${now.toISOString().slice(0, 10)}.txt`;
}

/** What the person is told when an import fails. Nothing was stored, so trying again is safe (FE-37). */
export function importFailureMessage(status: number | undefined, type: string | undefined): string {
  if (type === 'urn:therapy-service-hours:problem:body-too-large') {
    return 'That file is larger than 1 MB, which is the most that can be imported.';
  }
  if (type === 'urn:therapy-service-hours:problem:import-too-many-rows') {
    return 'That file has more than 5,000 entries. Split it into smaller files and import them one at a time.';
  }
  if (status === 400) return 'That file is not a Markdown ledger. Choose a file exported from the tracker.';
  if (status === 429) return 'Too many imports just now. Wait a moment and try again.';
  return 'The import could not be completed and nothing was saved. Check your connection and try again.';
}
