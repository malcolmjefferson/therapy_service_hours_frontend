import { describe, expect, test } from 'vitest';
import { parseRules } from '../../../test/css';
import css from './ClientPicker.module.css?raw';

const rule = (selector: string) => parseRules(css).find((r) => r.selector === selector)?.declarations ?? {};

describe('client picker layout (nothing is clipped)', () => {
  test('the panel and the add input stay in the page flow', () => {
    for (const selector of ['.panel', '.add', '.field']) {
      const { position, 'overflow-x': overflowX, overflow } = rule(selector);
      expect(position, selector).toBeUndefined();
      expect(overflow, selector).toBeUndefined();
      expect(overflowX, selector).toBeUndefined();
    }
  });

  test('the add input spans the full width of the field and can shrink inside it', () => {
    expect(rule('.add')).toMatchObject({ width: '100%', 'min-width': '0' });
    expect(rule('.field > *')).toMatchObject({ 'grid-column': '1 / -1' });
  });

  test('the panel scrolls instead of growing past the screen', () => {
    expect(rule('.panel')).toMatchObject({ 'overflow-y': 'auto' });
    expect(rule('.panel')['max-height']).toBeDefined();
  });

  test('long names wrap rather than being cut off', () => {
    expect(rule('.trigger')['overflow-wrap']).toBe('anywhere');
    expect(rule('.option')['overflow-wrap']).toBe('anywhere');
  });
});
