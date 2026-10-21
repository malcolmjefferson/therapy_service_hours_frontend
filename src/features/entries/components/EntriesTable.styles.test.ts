import { describe, expect, test } from 'vitest';
import { colorTokenName, parseRules } from '../../../test/css';
import { contrastRatio } from '../../../theme/contrast';
import { colorTokens } from '../../../theme/tokenValues';
import css from './EntriesTable.module.css?raw';

const rule = (selector: string) => parseRules(css).find((r) => r.selector === selector)?.declarations ?? {};

describe('entries table styles', () => {
  test('sort buttons show the 2px red-deep focus ring', () => {
    expect(rule('.sortButton:focus-visible')).toMatchObject({ outline: 'var(--focus-ring)' });
  });

  test('long client names and notes wrap instead of widening the table', () => {
    expect(rule('.table th,\n.table td')['overflow-wrap']).toBe('anywhere');
  });

  test('text colors are theme tokens', () => {
    for (const { selector, declarations } of parseRules(css)) {
      const color = declarations.color;
      if (color && color !== 'inherit') expect(colorTokenName(color), selector).not.toBeNull();
    }
  });

  test('text pairs meet WCAG AA 4.5:1 (FE-44)', () => {
    const t = colorTokens();
    const color = (name: string) => t[name] ?? '';
    const pairs: [string, string, string][] = [
      ['table text', 'color-ink', 'color-raised'],
      ['column headings', 'color-ink', 'color-paper'],
      ['sort button hover', 'color-ink', 'color-gold-tint'],
      ['"Needs time" and "No clients"', 'color-ink-soft', 'color-raised'],
      ['error message', 'color-red-deep', 'color-raised'],
    ];
    for (const [name, fg, bg] of pairs) {
      expect(contrastRatio(color(fg), color(bg)), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('the styles use exactly the pairs that test checks', () => {
    expect(rule('.muted')).toMatchObject({ color: 'var(--color-ink-soft)' });
    expect(rule('.error')).toMatchObject({ color: 'var(--color-red-deep)' });
    expect(rule('.sortButton:hover')).toMatchObject({ background: 'var(--color-gold-tint)' });
    expect(rule('.table th')).toMatchObject({ background: 'var(--color-paper)' });
    expect(rule('.panel')).toMatchObject({ background: 'var(--color-raised)' });
  });
});

describe('entries table layout', () => {
  test('columns take their width in percent from a CSS variable, so the CSP needs no inline widths (FE-46)', () => {
    expect(rule('.table')).toMatchObject({ 'table-layout': 'fixed' });
    expect(rule('.col')).toMatchObject({ width: 'var(--col-width)' });
  });

  test('the resize handle shows the 2px red-deep focus ring', () => {
    expect(rule('.resizer:focus-visible')).toMatchObject({ outline: 'var(--focus-ring)' });
  });

  test('a narrow screen scrolls the table sideways instead of squeezing the columns', () => {
    expect(rule('.scroll')).toMatchObject({ 'overflow-x': 'auto' });
  });
});
