import type { components } from '../../../lib/api';

type Entry = components['schemas']['Entry'];
type CategoryGroup = components['schemas']['CategoryGroup'];

/** The ledger layout is documented in CLAUDE.md section 12.3; the backend parser (S4-02) reads it back. */
export const LEDGER_TITLE = 'Clinical Hours Ledger';

/** How the prototype writes "no client" and, in this export, "no time". */
const NONE = '—';

/** The columns of the entries table, in order. The importer finds them by name, so only the names matter. */
export const ENTRY_COLUMNS = [
  'Date',
  'Start',
  'End',
  'Group',
  'Category',
  'Client',
  'Hours',
  'On-site',
  'Notes',
] as const;

const GROUP_LABELS = {
  direct: 'Direct Service',
  indirect: 'Indirect Service',
  supervision: 'Supervision',
} satisfies Record<CategoryGroup, string>;

export interface LedgerOptions {
  /** Every saved client, so the Clients / Groups section also lists clients that are on no entry. */
  savedClients?: readonly string[];
}

/**
 * Makes one value safe to sit in a table cell. A row must stay on one line, so line breaks become a
 * space (the one change the importer cannot undo). A literal pipe is escaped as `\|`, the escape the
 * importer reads. Nothing else is rewritten: the importer treats every cell as plain text.
 */
function cell(value: string): string {
  return value.replace(/[ \t]*[\r\n]+[ \t]*/g, ' ').replaceAll('|', '\\|');
}

function row(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`;
}

/** Hours to two decimals from whole minutes, so `1.25` and never a float artefact. */
function hoursText(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

/**
 * Names for the Clients / Groups section: saved clients first, then names found on entries, ignoring
 * case. They are bullets, not cells, so a pipe needs no escape.
 */
function clientNames(entries: readonly Entry[], saved: readonly string[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const all = [...saved, ...entries.flatMap((entry) => entry.clients.map((client) => client.name))];
  for (const raw of all) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (name === '' || name === NONE || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** Total hours as the goals count them: rejected entries are left out (CLAUDE.md section 7.2). */
function summaryLines(entries: readonly Entry[]): string[] {
  const counted = entries.filter((entry) => entry.status !== 'rejected');
  const minutes = (keep: (entry: Entry) => boolean) =>
    counted.filter(keep).reduce((sum, entry) => sum + entry.duration_minutes, 0);
  return [
    `- Direct Service: ${hoursText(minutes((e) => e.category.group === 'direct'))} hours`,
    `- Indirect Service: ${hoursText(minutes((e) => e.category.group === 'indirect'))} hours`,
    `- Supervision: ${hoursText(minutes((e) => e.category.group === 'supervision'))} hours`,
    `- Total Activity: ${hoursText(minutes(() => true))} hours`,
    `- Total Time On-site: ${hoursText(minutes((e) => e.on_site))} hours`,
  ];
}

function entryRow(entry: Entry): string {
  return row([
    entry.session_date,
    entry.start_time ?? NONE,
    entry.end_time ?? NONE,
    GROUP_LABELS[entry.category.group],
    cell(entry.category.name),
    entry.clients.length === 0 ? NONE : entry.clients.map((client) => cell(client.name)).join('; '),
    hoursText(entry.duration_minutes),
    entry.on_site ? 'Yes' : 'No',
    cell(entry.notes ?? ''),
  ]);
}

/**
 * Serializes entries to the prototype's Markdown ledger with Start and End columns added (FR-IO-04).
 * The file is deterministic: the same entries in the same order give the same text. Entries keep the
 * order they are given, which the export endpoint makes oldest first.
 *
 * Importing the result gives back the same entries (date, times, group, category, clients, hours,
 * on-site, notes), with these limits that the importer's format forces:
 * - a line break inside notes becomes a space, because a table row is one line;
 * - a client name that contains `;` or is exactly `—` cannot be told apart from the separator or the
 *   "none" marker, so the importer splits or drops it;
 * - status and review notes are not part of the format; an imported entry starts as pending.
 */
export function serializeLedger(entries: readonly Entry[], options: LedgerOptions = {}): string {
  const names = clientNames(entries, options.savedClients ?? []);
  const lines = [
    `# ${LEDGER_TITLE}`,
    '',
    '## Summary',
    '',
    ...summaryLines(entries),
    '',
    '## Clients / Groups',
    '',
    ...(names.length === 0 ? [`- ${NONE}`] : names.map((name) => `- ${name}`)),
    '',
    '## Entries',
    '',
    row(ENTRY_COLUMNS),
    row(ENTRY_COLUMNS.map(() => '---')),
    ...entries.map(entryRow),
  ];
  return `${lines.join('\n')}\n`;
}
