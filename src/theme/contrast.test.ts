import { describe, expect, test } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';
import css from './tokens.css?raw';

/** Reads the token values straight from tokens.css, so the test follows the real palette. */
function tokens(): Record<string, string> {
  const entries: [string, string][] = [...css.matchAll(/--(color-[a-z-]+):\s*(#[0-9a-f]{3,6});/gi)].map((m) => [
    m[1] ?? '',
    expand(m[2] ?? ''),
  ]);
  return Object.fromEntries(entries);
}

/** Expands #rgb to #rrggbb. */
function expand(hex: string): string {
  const h = hex.toLowerCase();
  if (h.length !== 4) {
    return h;
  }
  const [r, g, b] = [h.charAt(1), h.charAt(2), h.charAt(3)];
  return `#${r}${r}${g}${g}${b}${b}`;
}

describe('contrast math', () => {
  test('black on white is 21:1 and a color on itself is 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#cf900b', '#cf900b')).toBeCloseTo(1, 5);
  });

  test('rejects anything but #rrggbb', () => {
    expect(() => relativeLuminance('red')).toThrow();
  });
});

describe('text token pairs meet WCAG AA 4.5:1 (FE-44)', () => {
  const t = tokens();
  const pairs: [string, string][] = [
    ['color-ink', 'color-paper'],
    ['color-ink', 'color-raised'],
    ['color-ink-soft', 'color-paper'],
    ['color-ink-soft', 'color-raised'],
    ['color-on-primary', 'color-primary'],
    ['color-lime-deep', 'color-raised'],
    ['color-red-deep', 'color-paper'],
    ['color-gold-deep', 'color-paper'],
  ];
  test.each(pairs)('%s on %s', (fg, bg) => {
    const ratio = contrastRatio(t[fg] ?? '', t[bg] ?? '');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
