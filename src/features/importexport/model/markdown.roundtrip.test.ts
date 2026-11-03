import { describe, expect, test } from 'vitest';
import type { components } from '../../../lib/api';
import { parseLedger, type ParsedRow } from '../../../test/ledgerParser';
import { serializeLedger } from './markdown';

type Entry = components['schemas']['Entry'];
type CategoryGroup = components['schemas']['CategoryGroup'];

const GROUP_LABELS: Record<CategoryGroup, string> = {
  direct: 'Direct Service',
  indirect: 'Indirect Service',
  supervision: 'Supervision',
};

/** A small seeded generator, so a failure repeats and the suite needs no extra dependency. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fictional pseudonyms and awkward text only (FE-70). None holds `;` or is exactly `—`, which the format cannot carry.
const CATEGORIES: readonly { name: string; group: CategoryGroup }[] = [
  { name: 'Individual Counseling', group: 'direct' },
  { name: 'Couples / Family Therapy', group: 'direct' },
  { name: 'Writing Progress Notes / Documentation', group: 'indirect' },
  { name: 'Staff Meetings', group: 'indirect' },
  { name: 'Group Supervision', group: 'supervision' },
  { name: 'Odd | Name \\ Here', group: 'indirect' },
];
const CLIENT_POOL = [
  'A.B.',
  'C.D.',
  'Group Alpha',
  "O'Neil",
  'Ünï Çødé',
  '李 华',
  'x|y',
  'a\\b',
  '=SUM(1)',
  '"quoted"',
  'pct%_',
  '日本',
];
const NOTE_PIECES = [
  'plain words',
  '|',
  '\\',
  '\\|',
  '||',
  '\\\\|',
  "'; DROP TABLE entries;--",
  '<b>bold</b>',
  '[l](javascript:x)',
  '=1+1',
  '+1',
  '- item',
  '# not a heading',
  '* star',
  '---',
  '😀',
  'tab\there',
  '  inner  spaces  ',
  'ü',
  '—',
  ';',
];

function pick<T>(items: readonly T[], next: () => number): T {
  return items[Math.floor(next() * items.length)] as T;
}

function twoDigits(n: number): string {
  return String(n).padStart(2, '0');
}

function clock(minutes: number): string {
  return `${twoDigits(Math.floor(minutes / 60))}:${twoDigits(minutes % 60)}`;
}

function makeEntry(next: () => number, index: number): Entry {
  const category = pick(CATEGORIES, next);
  const clientCount = Math.floor(next() * 4);
  const names = new Set<string>();
  while (names.size < clientCount) names.add(pick(CLIENT_POOL, next));
  const timed = next() < 0.7;
  const startSlot = Math.floor(next() * 90);
  const length = 1 + Math.floor(next() * Math.min(16, 95 - startSlot));
  const minutes = timed ? length * 15 : 1 + Math.floor(next() * 1440);
  const noteCount = Math.floor(next() * 5);
  const notes = Array.from({ length: noteCount }, () => pick(NOTE_PIECES, next)).join(next() < 0.5 ? ' ' : '');
  const day = 1 + Math.floor(next() * 28);
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    session_date: `2026-${twoDigits(1 + Math.floor(next() * 12))}-${twoDigits(day)}`,
    ...(timed ? { start_time: clock(startSlot * 15), end_time: clock((startSlot + length) * 15) } : {}),
    duration_minutes: minutes,
    hours: minutes / 60,
    category: { id: '00000000-0000-4000-8000-0000000000c1', ...category },
    clients: [...names].map((name, i) => ({ id: `00000000-0000-4000-8000-0000000000b${String(i)}`, name })),
    on_site: next() < 0.5,
    ...(notes.trim() === '' ? {} : { notes: notes.trim() }),
    status: pick(['pending', 'approved', 'rejected'] as const, next),
    needs_time: !timed,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function groupFromLabel(label: string): CategoryGroup {
  const found = (Object.keys(GROUP_LABELS) as CategoryGroup[]).find((group) => GROUP_LABELS[group] === label);
  if (!found) throw new Error(`unknown group ${label}`);
  return found;
}

/** What importing should give back for an entry: the fields the format carries. */
function expectedRow(entry: Entry): ParsedRow {
  return {
    date: entry.session_date,
    start: entry.start_time,
    end: entry.end_time,
    group: GROUP_LABELS[entry.category.group],
    category: entry.category.name,
    clients: entry.clients.map((client) => client.name),
    minutes: entry.duration_minutes,
    onSite: entry.on_site,
    notes: entry.notes ?? '',
  };
}

describe('Markdown export round trip (S4-07)', () => {
  test.each([1, 2, 3, 4, 5, 6, 7, 8])('export then import gives the same entries (seed %i)', (seed) => {
    const next = random(seed);
    const entries = Array.from({ length: 60 }, (_, index) => makeEntry(next, index));
    const saved = [...new Set(entries.flatMap((entry) => entry.clients.map((client) => client.name)))];

    const parsed = parseLedger(serializeLedger(entries, { savedClients: saved }));

    expect(parsed.rows).toEqual(entries.map(expectedRow));
    expect(parsed.clients.map((name) => name.toLowerCase()).sort()).toEqual(
      saved.map((name) => name.toLowerCase()).sort(),
    );
  });

  test('exporting what was imported gives the same file', () => {
    const next = random(99);
    // Status is not in the file, so every imported entry is pending; start from the same.
    const entries = Array.from({ length: 40 }, (_, index): Entry => ({ ...makeEntry(next, index), status: 'pending' }));
    const first = serializeLedger(entries);
    const parsed = parseLedger(first);
    const again = parsed.rows.map((row, index): Entry => ({
      id: String(index),
      session_date: row.date,
      ...(row.start && row.end ? { start_time: row.start, end_time: row.end } : {}),
      duration_minutes: row.minutes,
      hours: row.minutes / 60,
      category: { id: 'c', name: row.category, group: groupFromLabel(row.group) },
      clients: row.clients.map((name, i) => ({ id: String(i), name })),
      on_site: row.onSite,
      ...(row.notes ? { notes: row.notes } : {}),
      status: 'pending',
      needs_time: !row.start,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }));
    expect(serializeLedger(again)).toBe(first);
  });
});
