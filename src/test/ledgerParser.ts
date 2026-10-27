/**
 * A small reader for the Markdown ledger, used only by tests to prove an export imports back
 * unchanged. It follows the rules of the backend parser (internal/service/importexport/parse.go,
 * S4-02): columns found by header name, `\|` is a literal pipe, `; ` separates clients, and `—` or an
 * empty cell means none. It stops at the first row it cannot read instead of reporting it, because a
 * test wants to fail loudly. The backend parser stays the authority on the format.
 */
export interface ParsedRow {
  date: string;
  start: string | undefined;
  end: string | undefined;
  group: string;
  category: string;
  clients: string[];
  minutes: number;
  onSite: boolean;
  notes: string;
}

export interface ParsedLedger {
  clients: string[];
  rows: ParsedRow[];
}

const NONE = '—';
const BOM = String.fromCodePoint(0xfeff);

function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text;
}

/** Splits a table line on unescaped pipes; the leading pipe and one closing pipe are borders. */
function splitCells(line: string): string[] {
  const text = line.trim().replace(/^\|/, '');
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (char === '\\' && text.charAt(i + 1) === '|') {
      current += '|';
      i += 1;
    } else if (char === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim() !== '') cells.push(current.trim());
  return cells;
}

/** Hours text such as `1.25` to whole minutes, rounded like the backend. */
function minutesFromHours(text: string): number {
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`bad hours: ${text}`);
  return Math.round(Number(text) * 60);
}

function parseClients(cell: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of (cell === NONE ? '' : cell).split(';')) {
    const name = part.trim();
    if (name === '' || name === NONE || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

export function parseLedger(markdown: string): ParsedLedger {
  const ledger: ParsedLedger = { clients: [], rows: [] };
  let section = '';
  let header: string[] | undefined;
  let separatorSeen = false;
  for (const raw of stripBom(markdown).split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#')) {
      section = line.replace(/^#+/, '').trim().toLowerCase();
    } else if (section.startsWith('client') && /^[-*+] /.test(line)) {
      const name = line.slice(2).trim();
      if (name !== '' && name !== NONE) ledger.clients.push(name);
    } else if (line.startsWith('|') && section.startsWith('entries')) {
      const cells = splitCells(line);
      if (!header) {
        header = cells.map((cell) => cell.toLowerCase().replace(/[ _-]/g, ''));
      } else if (!separatorSeen) {
        separatorSeen = true;
      } else {
        ledger.rows.push(parseRow(header, cells));
      }
    }
  }
  if (!header) throw new Error('no entries table');
  return ledger;
}

function parseRow(header: readonly string[], cells: readonly string[]): ParsedRow {
  if (cells.length !== header.length)
    throw new Error(`row has ${String(cells.length)} cells, table has ${String(header.length)}`);
  const get = (name: string): string => {
    const at = header.indexOf(name);
    if (at < 0) throw new Error(`missing column ${name}`);
    return cells[at] ?? '';
  };
  const time = (name: string): string | undefined => {
    const value = get(name);
    return value === '' || value === NONE ? undefined : value;
  };
  return {
    date: get('date'),
    start: time('start'),
    end: time('end'),
    group: get('group'),
    category: get('category'),
    clients: parseClients(get('client')),
    minutes: minutesFromHours(get('hours')),
    onSite: get('onsite').toLowerCase() === 'yes',
    notes: get('notes'),
  };
}
