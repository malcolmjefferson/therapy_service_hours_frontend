import type { components, paths } from '../../../lib/api';

type ListQuery = NonNullable<paths['/entries']['get']['parameters']['query']>;

/** Columns the API can sort by; anything else is a 400 (CLAUDE.md §11.1). */
export type EntrySortField = NonNullable<ListQuery['sort']>;
export type SortDirection = NonNullable<ListQuery['dir']>;

export type CategoryGroup = components['schemas']['CategoryGroup'];

/** The category groups the filter offers, in the order of CLAUDE.md §8. Keyed by the generated enum so a new group fails tsc (FE-29). */
export const groupLabels = {
  direct: 'Direct Service',
  indirect: 'Indirect Service',
  supervision: 'Supervision',
} as const satisfies Record<CategoryGroup, string>;

/** The longest client text the API accepts (`maxLength` on the `client` parameter). */
export const MAX_CLIENT_FILTER = 64;

/** The filters. An absent field means "no filter on this". Dates are `YYYY-MM-DD`. */
export interface EntriesFilters {
  group?: CategoryGroup | undefined;
  client?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

/** What the entries table shows: the filters, the sort and the page. It lives in the URL (FE-31). */
export interface EntriesView extends EntriesFilters {
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

function isGroup(value: string | null): value is CategoryGroup {
  return value !== null && Object.keys(groupLabels).includes(value);
}

/** True for a real calendar date written `YYYY-MM-DD`, the only shape the API's `from` and `to` accept. */
export function isIsoDate(value: string | null | undefined): value is string {
  if (value === null || value === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Client text as the API wants it: trimmed, at most 64 characters, and absent when blank. */
export function normalizeClientFilter(text: string | null | undefined): string | undefined {
  const trimmed = (text ?? '').trim().slice(0, MAX_CLIENT_FILTER).trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Reads the view from URL search params. Anything unknown or out of range falls back to the default. */
export function parseView(params: URLSearchParams): EntriesView {
  const sort = params.get('sort');
  const dir = params.get('dir');
  const rawPage = params.get('page');
  const group = params.get('group');
  const from = params.get('from');
  const to = params.get('to');
  const page = rawPage !== null && /^\d+$/.test(rawPage) ? Number(rawPage) : DEFAULT_VIEW.page;
  return {
    sort: isSortField(sort) ? sort : DEFAULT_VIEW.sort,
    dir: isDirection(dir) ? dir : DEFAULT_VIEW.dir,
    page: page >= 1 && page <= MAX_PAGE ? page : DEFAULT_VIEW.page,
    ...(isGroup(group) ? { group } : {}),
    ...pickDefined({ client: normalizeClientFilter(params.get('client')) }),
    ...(isIsoDate(from) ? { from } : {}),
    ...(isIsoDate(to) ? { to } : {}),
  };
}

function pickDefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

const FILTER_KEYS = ['group', 'client', 'from', 'to'] as const;

/** Writes the view into a copy of `params`, leaving other params alone and dropping default values. */
export function applyView(params: URLSearchParams, view: EntriesView): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of ['sort', 'dir', 'page'] as const) {
    if (view[key] === DEFAULT_VIEW[key]) next.delete(key);
    else next.set(key, String(view[key]));
  }
  for (const key of FILTER_KEYS) {
    const value = view[key];
    if (value === undefined || value === '') next.delete(key);
    else next.set(key, value);
  }
  return next;
}

/** True when any filter is set. */
export function hasFilters(view: EntriesFilters): boolean {
  return FILTER_KEYS.some((key) => view[key] !== undefined);
}

/** The view with one filter changed. Any change goes back to the first page, since the result set is different. */
export function filteredBy(view: EntriesView, change: EntriesFilters): EntriesView {
  return { ...view, ...change, page: 1 };
}

/** The view with every filter removed. The sort stays: it is not a filter. */
export function withoutFilters(view: EntriesView): EntriesView {
  return { sort: view.sort, dir: view.dir, page: 1 };
}

/** The `to` date is before the `from` date, which the API refuses with 400. Both are valid dates here. */
export function isRangeBackwards(view: EntriesFilters): boolean {
  return view.from !== undefined && view.to !== undefined && view.to < view.from;
}

/** The filters as `GET /entries` query parameters; absent filters are left out entirely. */
export function filterQuery(view: EntriesFilters): Pick<ListQuery, 'group' | 'client' | 'from' | 'to'> {
  return {
    ...(view.group !== undefined ? { group: view.group } : {}),
    ...(view.client !== undefined ? { client: view.client } : {}),
    ...(view.from !== undefined ? { from: view.from } : {}),
    ...(view.to !== undefined ? { to: view.to } : {}),
  };
}

/**
 * The view after the user clicks a column heading: the same column flips direction, a new column
 * starts ascending, and either way the table goes back to the first page. Filters are kept.
 */
export function sortedBy(view: EntriesView, field: EntrySortField): EntriesView {
  if (view.sort === field) return { ...view, dir: view.dir === 'asc' ? 'desc' : 'asc', page: 1 };
  return { ...view, sort: field, dir: 'asc', page: 1 };
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
