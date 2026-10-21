import { describe, expect, test } from 'vitest';
import {
  DEFAULT_VIEW,
  applyView,
  ariaSortFor,
  filterQuery,
  filteredBy,
  hasFilters,
  isIsoDate,
  isRangeBackwards,
  normalizeClientFilter,
  pageCount,
  parseView,
  sortedBy,
  withoutFilters,
  type EntriesView,
} from './viewState';

const params = (query: string) => new URLSearchParams(query);

describe('parseView', () => {
  test('no params means newest first on page 1', () => {
    expect(parseView(params(''))).toEqual({ sort: 'session_date', dir: 'desc', page: 1 });
  });

  test('reads a valid sort, direction and page', () => {
    expect(parseView(params('sort=hours&dir=asc&page=3'))).toEqual({ sort: 'hours', dir: 'asc', page: 3 });
  });

  test.each([
    ['an unknown sort column', 'sort=password', DEFAULT_VIEW],
    ['an inherited object key as the sort column', 'sort=constructor', DEFAULT_VIEW],
    ['an unknown direction', 'dir=sideways', DEFAULT_VIEW],
    ['page zero', 'page=0', DEFAULT_VIEW],
    ['a negative page', 'page=-2', DEFAULT_VIEW],
    ['a fractional page', 'page=1.5', DEFAULT_VIEW],
    ['a non-numeric page', 'page=abc', DEFAULT_VIEW],
    ['an absurd page', 'page=99999999', DEFAULT_VIEW],
  ])('falls back to the default for %s', (_name, query, expected) => {
    expect(parseView(params(query))).toEqual(expected);
  });
});

describe('applyView', () => {
  test('the default view leaves no params', () => {
    expect(applyView(params('sort=hours&dir=asc&page=2'), DEFAULT_VIEW).toString()).toBe('');
  });

  test('writes only what differs from the default', () => {
    const view: EntriesView = { sort: 'category', dir: 'desc', page: 2 };
    expect(applyView(params(''), view).toString()).toBe('sort=category&page=2');
  });

  test('keeps params it does not own', () => {
    expect(applyView(params('tab=notes'), { ...DEFAULT_VIEW, page: 2 }).toString()).toBe('tab=notes&page=2');
  });

  test('round-trips through parseView', () => {
    const view: EntriesView = { sort: 'on_site', dir: 'asc', page: 7 };
    expect(parseView(applyView(params(''), view))).toEqual(view);
  });
});

describe('sortedBy', () => {
  test('a new column starts ascending and returns to the first page', () => {
    expect(sortedBy({ sort: 'session_date', dir: 'desc', page: 4 }, 'category')).toEqual({
      sort: 'category',
      dir: 'asc',
      page: 1,
    });
  });

  test('the same column toggles direction both ways', () => {
    const asc = sortedBy({ sort: 'session_date', dir: 'desc', page: 2 }, 'session_date');
    expect(asc).toEqual({ sort: 'session_date', dir: 'asc', page: 1 });
    expect(sortedBy(asc, 'session_date').dir).toBe('desc');
  });
});

describe('ariaSortFor', () => {
  test('only the sorted column has a direction', () => {
    const view: EntriesView = { sort: 'hours', dir: 'asc', page: 1 };
    expect(ariaSortFor(view, 'hours')).toBe('ascending');
    expect(ariaSortFor({ ...view, dir: 'desc' }, 'hours')).toBe('descending');
    expect(ariaSortFor(view, 'client')).toBe('none');
  });
});

describe('pageCount', () => {
  test.each([
    [0, 1],
    [1, 1],
    [50, 1],
    [51, 2],
    [120, 3],
  ])('%i items on pages of 50 is %i page(s)', (total, pages) => {
    expect(pageCount(total, 50)).toBe(pages);
  });
});

describe('filters in the URL', () => {
  test('reads every filter', () => {
    expect(parseView(params('group=supervision&client=A.B.&from=2026-01-01&to=2026-02-01'))).toEqual({
      ...DEFAULT_VIEW,
      group: 'supervision',
      client: 'A.B.',
      from: '2026-01-01',
      to: '2026-02-01',
    });
  });

  test.each([
    ['an unknown group', 'group=everything'],
    ['an inherited object key as the group', 'group=constructor'],
    ['an empty group', 'group='],
    ['a blank client', 'client=%20%20'],
    ['a date that is not a date', 'from=yesterday'],
    ['a date that does not exist', 'to=2026-02-30'],
    ['a date with the wrong shape', 'from=1/5/2026'],
  ])('ignores %s', (_name, query) => {
    const view = parseView(params(query));
    expect(hasFilters(view)).toBe(false);
  });

  test('trims the client text and cuts it at the API limit', () => {
    expect(parseView(params('client=%20ab%20')).client).toBe('ab');
    expect(parseView(params(`client=${'x'.repeat(100)}`)).client).toBe('x'.repeat(64));
  });

  test('writes filters, drops cleared ones, and round-trips', () => {
    const view: EntriesView = { ...DEFAULT_VIEW, group: 'direct', client: 'A%B', from: '2026-01-01' };
    const written = applyView(params(''), view);
    expect(written.toString()).toBe('group=direct&client=A%25B&from=2026-01-01');
    expect(parseView(written)).toEqual(view);
    expect(applyView(written, { ...view, group: undefined, from: undefined }).toString()).toBe('client=A%25B');
  });

  test('hasFilters is true for any one filter', () => {
    expect(hasFilters(DEFAULT_VIEW)).toBe(false);
    expect(hasFilters({ ...DEFAULT_VIEW, to: '2026-01-01' })).toBe(true);
  });

  test('changing a filter goes back to page 1 and keeps the sort and other filters', () => {
    const view: EntriesView = { sort: 'hours', dir: 'asc', page: 4, group: 'direct' };
    expect(filteredBy(view, { client: 'ab' })).toEqual({
      sort: 'hours',
      dir: 'asc',
      page: 1,
      group: 'direct',
      client: 'ab',
    });
  });

  test('clearing removes every filter, goes to page 1 and keeps the sort', () => {
    const view: EntriesView = {
      sort: 'hours',
      dir: 'asc',
      page: 4,
      group: 'direct',
      client: 'ab',
      from: '2026-01-01',
      to: '2026-02-01',
    };
    expect(withoutFilters(view)).toEqual({ sort: 'hours', dir: 'asc', page: 1 });
  });

  test('sorting keeps the filters', () => {
    const view: EntriesView = { ...DEFAULT_VIEW, group: 'indirect', client: 'ab' };
    expect(sortedBy(view, 'hours')).toMatchObject({ sort: 'hours', group: 'indirect', client: 'ab', page: 1 });
  });

  test('a range that ends before it starts is backwards; one day or an open end is not', () => {
    expect(isRangeBackwards({ from: '2026-02-01', to: '2026-01-01' })).toBe(true);
    expect(isRangeBackwards({ from: '2026-01-01', to: '2026-01-01' })).toBe(false);
    expect(isRangeBackwards({ from: '2026-02-01' })).toBe(false);
    expect(isRangeBackwards({})).toBe(false);
  });

  test('the query has only the filters that are set', () => {
    expect(filterQuery({ group: 'direct', client: undefined, from: '2026-01-01' })).toEqual({
      group: 'direct',
      from: '2026-01-01',
    });
    expect(Object.keys(filterQuery({}))).toEqual([]);
  });
});

describe('isIsoDate and normalizeClientFilter', () => {
  test('accepts only real calendar dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-1-1')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  test('client text is trimmed, capped and absent when blank', () => {
    expect(normalizeClientFilter('  A.B. ')).toBe('A.B.');
    expect(normalizeClientFilter('   ')).toBeUndefined();
    expect(normalizeClientFilter(null)).toBeUndefined();
    expect(normalizeClientFilter('x'.repeat(70))).toHaveLength(64);
  });
});
