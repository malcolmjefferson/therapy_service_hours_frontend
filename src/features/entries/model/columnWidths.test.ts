import { describe, expect, test } from 'vitest';
import { DEFAULT_WIDTHS, KEY_STEP, MIN_WIDTH, TOTAL_WIDTH, resizeEdge, toPercent } from './columnWidths';

const sum = (widths: readonly number[]) => widths.reduce((a, b) => a + b, 0);

describe('column widths', () => {
  test('the defaults fill exactly 100%', () => {
    expect(sum(DEFAULT_WIDTHS)).toBe(TOTAL_WIDTH);
  });

  test('dragging an edge right widens the left column by what the right one loses', () => {
    const next = resizeEdge(DEFAULT_WIDTHS, 2, 40);
    expect(next[2]).toBe(200);
    expect(next[3]).toBe(100);
    expect(sum(next)).toBe(TOTAL_WIDTH);
  });

  test('dragging left does the reverse', () => {
    const next = resizeEdge(DEFAULT_WIDTHS, 1, -15);
    expect(next.slice(1, 3)).toEqual([105, 175]);
    expect(sum(next)).toBe(TOTAL_WIDTH);
  });

  test('stops at the minimum on either side', () => {
    expect(resizeEdge(DEFAULT_WIDTHS, 2, 500).slice(2, 4)).toEqual([200, MIN_WIDTH]);
    expect(resizeEdge(DEFAULT_WIDTHS, 2, -500).slice(2, 4)).toEqual([MIN_WIDTH, 200]);
  });

  test('two columns already at the minimum cannot trade width', () => {
    expect(resizeEdge(DEFAULT_WIDTHS, 4, 50)).toBe(DEFAULT_WIDTHS);
  });

  test('only the two columns at the edge change', () => {
    const next = resizeEdge(DEFAULT_WIDTHS, 1, KEY_STEP);
    expect(next.filter((width, i) => width !== DEFAULT_WIDTHS[i])).toHaveLength(2);
  });

  test('a fractional move is rounded to a whole tenth, so the total stays exact', () => {
    const next = resizeEdge(DEFAULT_WIDTHS, 3, 12.7);
    expect(Number.isInteger(next[3])).toBe(true);
    expect(sum(next)).toBe(TOTAL_WIDTH);
  });

  test('the last column has no edge to move, and a zero move changes nothing', () => {
    expect(resizeEdge(DEFAULT_WIDTHS, DEFAULT_WIDTHS.length - 1, 50)).toBe(DEFAULT_WIDTHS);
    expect(resizeEdge(DEFAULT_WIDTHS, 0, 0)).toBe(DEFAULT_WIDTHS);
  });

  test('many moves in a row still add up to 100%', () => {
    let widths = DEFAULT_WIDTHS;
    for (let i = 0; i < 200; i += 1) widths = resizeEdge(widths, i % 6, ((i * 37) % 91) - 45);
    expect(sum(widths)).toBe(TOTAL_WIDTH);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(MIN_WIDTH);
  });

  test('converts to percent', () => {
    expect(toPercent(125)).toBe(12.5);
  });
});
