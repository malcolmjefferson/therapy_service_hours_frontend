import { describe, expect, test } from 'vitest';
import { contrastRatio } from '../theme/contrast';
import { colorTokens } from '../theme/tokenValues';
import tokensCss from '../theme/tokens.css?raw';
import globalCss from '../theme/global.css?raw';
import { colorTokenName, parseRules, withoutMediaBlocks } from '../test/css';

const componentCss = import.meta.glob<string>('./**/*.module.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const files = Object.entries(componentCss);

describe('component stylesheets', () => {
  test('are found, so the checks below are not vacuous', () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });
});

describe('text and background pairs meet WCAG AA 4.5:1 (FE-44)', () => {
  const t = colorTokens();
  // Text with no background of its own sits on the page or a raised surface; a background with no
  // text color of its own holds the default ink text.
  const surfaces = ['color-paper', 'color-raised'];
  const pairs = new Map<string, [string, string]>();
  for (const [file, css] of files) {
    for (const { selector, declarations } of parseRules(css)) {
      const fg = colorTokenName(declarations.color);
      const bg = colorTokenName(declarations.background ?? declarations['background-color']);
      const key = `${file} ${selector}`;
      if (fg && bg) {
        pairs.set(key, [fg, bg]);
      } else if (fg) {
        surfaces.forEach((surface) => pairs.set(`${key} on ${surface}`, [fg, surface]));
      } else if (bg) {
        pairs.set(`${key} (default ink text)`, ['color-ink', bg]);
      }
    }
  }

  test('every color the components set is covered', () => {
    expect(pairs.size).toBeGreaterThanOrEqual(15);
  });

  test.each([...pairs])('%s', (_name, [fg, bg]) => {
    expect(t[fg], `${fg} is a hex token`).toBeDefined();
    expect(t[bg], `${bg} is a hex token`).toBeDefined();
    expect(contrastRatio(t[fg] ?? '', t[bg] ?? '')).toBeGreaterThanOrEqual(4.5);
  });

  // The dialog scrim is a translucent wash that holds only the panel, never text of its own.
  const noTextOnIt = new Set(['./Dialog/Dialog.module.css .overlay']);

  test('a color the tests cannot resolve is rejected, not skipped', () => {
    const unresolved = files.flatMap(([file, css]) =>
      parseRules(css).flatMap(({ selector, declarations }) =>
        noTextOnIt.has(`${file} ${selector}`)
          ? []
          : (['color', 'background', 'background-color'] as const)
              .map((property) => [property, declarations[property]] as const)
              .filter(([, value]) => value && /(#|rgb|hsl|color-mix)/i.test(value))
              .map(([property]) => `${file} ${selector} ${property}`),
      ),
    );
    expect(unresolved).toEqual([]);
  });
});

describe('non-text contrast is at least 3:1 (WCAG 1.4.11)', () => {
  const t = colorTokens();
  test.each([
    ['focus ring on the page', 'color-red-deep', 'color-paper'],
    ['focus ring on a raised surface', 'color-red-deep', 'color-raised'],
    ['control border', 'color-ink-soft', 'color-raised'],
    ['error border', 'color-red-deep', 'color-raised'],
  ])('%s', (_name, fg, bg) => {
    expect(contrastRatio(t[fg] ?? '', t[bg] ?? '')).toBeGreaterThanOrEqual(3);
  });
});

describe('focus ring is red-deep, 2px', () => {
  test('the token is 2px solid red-deep', () => {
    expect(tokensCss).toMatch(/--focus-ring:\s*2px solid var\(--color-red-deep\);/);
  });

  test('every focusable element gets it through :focus-visible', () => {
    const rule = parseRules(globalCss).find((r) => r.selector === ':focus-visible');
    expect(rule?.declarations.outline).toBe('var(--focus-ring)');
  });

  test.each(files)('%s never removes the outline', (_file, css) => {
    for (const { selector, declarations } of parseRules(css)) {
      const outline = declarations.outline ?? declarations['outline-style'] ?? '';
      expect(outline, selector).not.toMatch(/^(none|0)\b/);
    }
  });
});

describe('prefers-reduced-motion is respected (FE-51)', () => {
  test('global styles switch animation and transition off', () => {
    const reduced = parseRules(globalCss).find(
      (r) => r.selector.includes('*') && r.declarations['transition-duration'],
    );
    expect(globalCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(reduced?.declarations['animation-duration']).toBe('0.01ms !important');
    expect(reduced?.declarations['transition-duration']).toBe('0.01ms !important');
  });

  test.each(files)('%s only animates when the user has no motion preference', (_file, css) => {
    const unguarded = withoutMediaBlocks(css, 'prefers-reduced-motion: no-preference');
    expect(unguarded).not.toMatch(/\b(animation|transition)(-[a-z]+)?\s*:/);
    expect(unguarded).not.toMatch(/@keyframes/);
  });

  test('the components that do animate guard it', () => {
    const guarded = files.filter(([, css]) => css.includes('@media (prefers-reduced-motion: no-preference)'));
    expect(guarded.map(([file]) => file).sort()).toEqual([
      './Button/Button.module.css',
      './Dialog/Dialog.module.css',
      './Toast/Toast.module.css',
    ]);
  });
});
