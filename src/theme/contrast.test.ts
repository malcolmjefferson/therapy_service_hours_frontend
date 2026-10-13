import { describe, expect, test } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';
import { colorTokens } from './tokenValues';

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
  const t = colorTokens();
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
