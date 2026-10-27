import { describe, expect, test } from 'vitest';
import { layoutRows, paginateRows, wrapText, type LaidOutRow } from './pdfLayout';

/** Every character is 1 point wide, so widths are easy to reason about. */
const measure = (text: string) => text.length;

describe('wrapText', () => {
  test('keeps short text on one line', () => {
    expect(wrapText('one two', 20, measure)).toEqual(['one two']);
  });

  test('wraps at word boundaries', () => {
    expect(wrapText('aaa bbb ccc ddd', 7, measure)).toEqual(['aaa bbb', 'ccc ddd']);
  });

  test('cuts a word wider than the column so no text is lost', () => {
    const lines = wrapText('abcdefghijkl', 5, measure);
    expect(lines.join('')).toBe('abcdefghijkl');
    expect(lines.every((l) => l.length <= 5)).toBe(true);
  });

  test('empty text is one empty line', () => {
    expect(wrapText('', 10, measure)).toEqual(['']);
  });
});

describe('layoutRows', () => {
  test('a row is as tall as its tallest cell', () => {
    const [row] = layoutRows([['a', 'aaa bbb ccc']], [5, 5], measure);
    expect(row?.cells).toEqual([['a'], ['aaa', 'bbb', 'ccc']]);
    expect(row?.lineCount).toBe(3);
  });
});

const rowOf = (lineCount: number): LaidOutRow => ({
  cells: [Array.from({ length: lineCount }, (_, i) => String(i))],
  lineCount,
});
// 10-point lines, 2 points under each row.
const space = { firstPageHeight: 62, otherPageHeight: 102, lineHeight: 10, rowPad: 2 };

describe('paginateRows', () => {
  test('an empty ledger still has a first page', () => {
    expect(paginateRows([], space)).toEqual([[]]);
  });

  test('rows that fit stay on the first page', () => {
    const pages = paginateRows([rowOf(1), rowOf(2), rowOf(2)], space);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(3);
  });

  test('a table longer than a page continues on the next and repeats nothing', () => {
    const rows = Array.from({ length: 30 }, () => rowOf(1));
    const pages = paginateRows(rows, space);
    expect(pages.length).toBeGreaterThan(2);
    expect(pages.flat()).toHaveLength(30);
    // 62 / 12 leaves room for 5 rows on page one, 102 / 12 for 8 on the others.
    expect(pages.map((p) => p.length)).toEqual([5, 8, 8, 8, 1]);
  });

  test('a row that does not fit in the space left moves whole to the next page', () => {
    const pages = paginateRows([rowOf(1), rowOf(1), rowOf(1), rowOf(3)], space);
    expect(pages[0]).toHaveLength(3);
    expect(pages[1]?.[0]).toMatchObject({ from: 0, to: 3 });
  });

  test('a row taller than a page is split by lines and loses none', () => {
    const pages = paginateRows([rowOf(30)], space);
    const slices = pages.flat();
    expect(slices.reduce((sum, s) => sum + (s.to - s.from), 0)).toBe(30);
    expect(slices[0]?.from).toBe(0);
    expect(slices.at(-1)?.to).toBe(30);
    slices.forEach((s, i) => {
      if (i > 0) expect(s.from).toBe(slices[i - 1]?.to);
    });
  });

  test('a page too short for one line still ends', () => {
    const pages = paginateRows([rowOf(3)], { ...space, firstPageHeight: 1, otherPageHeight: 1 });
    expect(pages.flat().reduce((sum, s) => sum + (s.to - s.from), 0)).toBe(3);
  });
});
