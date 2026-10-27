import type { components } from '../../../lib/api';
import { summarizeGoals, type GoalLine, type GoalTargets } from './goalSummary';

type Entry = components['schemas']['Entry'];
type Status = components['schemas']['EntryStatus'];

export interface PdfColumn {
  heading: string;
  /** Share of the table width. The shares add up to 1. */
  share: number;
  align: 'left' | 'right';
}

/** Everything the PDF shows, as text, so the layout and the writer never look at API types. */
export interface PdfReport {
  title: string;
  /** `2026-01-05`: the day the file was made, in the person's own time zone. */
  generatedOn: string;
  goals: GoalLine[];
  columns: readonly PdfColumn[];
  rows: string[][];
  entryCount: number;
}

export const PDF_COLUMNS: readonly PdfColumn[] = [
  { heading: 'Date', share: 0.08, align: 'left' },
  { heading: 'Times', share: 0.1, align: 'left' },
  { heading: 'Category', share: 0.16, align: 'left' },
  { heading: 'Clients', share: 0.15, align: 'left' },
  { heading: 'Hours', share: 0.06, align: 'right' },
  { heading: 'On-site', share: 0.06, align: 'left' },
  { heading: 'Status', share: 0.08, align: 'left' },
  { heading: 'Notes', share: 0.31, align: 'left' },
];

const STATUS_LABEL = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
} as const satisfies Record<Status, string>;

/** `09:00 to 10:15`, or `Needs time` for a legacy entry that has none, so the cell is never empty. */
function timeRange(entry: Entry): string {
  return entry.start_time !== undefined && entry.end_time !== undefined
    ? `${entry.start_time} to ${entry.end_time}`
    : 'Needs time';
}

/** One table row. */
export function pdfRow(entry: Entry): string[] {
  return [
    entry.session_date,
    timeRange(entry),
    entry.category.name,
    entry.clients.map((client) => client.name).join('; '),
    entry.hours.toFixed(2),
    entry.on_site ? 'Yes' : 'No',
    STATUS_LABEL[entry.status],
    entry.notes ?? '',
  ];
}

/** `2026-01-05` from a date, using the person's local calendar day. */
export function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** Builds the report for a whole ledger, oldest first as the export endpoint serves it. */
export function buildPdfReport(entries: readonly Entry[], generatedAt: Date, targets?: GoalTargets): PdfReport {
  return {
    title: 'Service hours',
    generatedOn: localIsoDate(generatedAt),
    goals: summarizeGoals(entries, targets),
    columns: PDF_COLUMNS,
    rows: entries.map(pdfRow),
    entryCount: entries.length,
  };
}
