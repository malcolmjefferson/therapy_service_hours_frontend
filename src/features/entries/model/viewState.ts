import type { paths } from '../../../lib/api';

type ListQuery = NonNullable<paths['/entries']['get']['parameters']['query']>;

/** Columns the API can sort by; anything else is a 400 (CLAUDE.md §11.1). */
export type EntrySortField = NonNullable<ListQuery['sort']>;
export type SortDirection = NonNullable<ListQuery['dir']>;

/** What the entries table shows: the sort and the page. It lives in the URL (FE-31). */
export interface EntriesView {
  sort: EntrySortField;
  dir: SortDirection;
  page: number;
}

/** Items per page: the API default, so the request needs no surprises (GO-56). */
export const PAGE_SIZE = 50;

/** Newest first, the default order (CLAUDE.md §12.1). */
export const DEFAULT_VIEW: EntriesView = { sort: 'session_date', dir: 'desc', page: 1 };

/** Column headings, keyed by the generated sort enum so a new column is a compile error here (FE-29). */
export const sortLabels = {
  session_date: 'Date',
  category: 'Category',
  client: 'Client',
  hours: 'Hours',
  on_site: 'On-site',
} as const satisfies Record<EntrySortField, string>;

// A page number past this is never real; it only stops a hand-edited URL asking for nonsense.
const MAX_PAGE = 100_000;

function isSortField(value: string | null): value is EntrySortField {
  return value !== null && Object.keys(sortLabels).includes(value);
}

function isDirection(value: string | null): value is SortDirection {
  return value === 'asc' || value === 'desc';
}

/** Reads the view from URL search params. Anything unknown or out of range falls back to the default. */
export function parseView(params: URLSearchParams): EntriesView {
  const sort = params.get('sort');
  const dir = params.get('dir');
  const rawPage = params.get('page');
  const page = rawPage !== null && /^\d+$/.test(rawPage) ? Number(rawPage) : DEFAULT_VIEW.page;
  return {
    sort: isSortField(sort) ? sort : DEFAULT_VIEW.sort,
    dir: isDirection(dir) ? dir : DEFAULT_VIEW.dir,
    page: page >= 1 && page <= MAX_PAGE ? page : DEFAULT_VIEW.page,
  };
}

/** Writes the view into a copy of `params`, leaving other params alone and dropping default values. */
export function applyView(params: URLSearchParams, view: EntriesView): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of ['sort', 'dir', 'page'] as const) {
    if (view[key] === DEFAULT_VIEW[key]) next.delete(key);
    else next.set(key, String(view[key]));
  }
  return next;
}

/**
 * The view after the user clicks a column heading: the same column flips direction, a new column
 * starts ascending, and either way the table goes back to the first page.
 */
export function sortedBy(view: EntriesView, field: EntrySortField): EntriesView {
  if (view.sort === field) return { sort: field, dir: view.dir === 'asc' ? 'desc' : 'asc', page: 1 };
  return { sort: field, dir: 'asc', page: 1 };
}

/** `aria-sort` for a column heading (FE-49). */
export function ariaSortFor(view: EntriesView, field: EntrySortField): 'ascending' | 'descending' | 'none' {
  if (view.sort !== field) return 'none';
  return view.dir === 'asc' ? 'ascending' : 'descending';
}

/** Number of pages for `totalItems`; there is always at least one. */
export function pageCount(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}
