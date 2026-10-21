import { describe, expect, test } from 'vitest';
import { DEFAULT_VIEW, applyView, ariaSortFor, pageCount, parseView, sortedBy, type EntriesView } from './viewState';

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
    expect(applyView(params('from=2026-01-01'), { ...DEFAULT_VIEW, page: 2 }).toString()).toBe(
      'from=2026-01-01&page=2',
    );
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
