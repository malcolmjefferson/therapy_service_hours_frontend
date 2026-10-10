import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { findHexColors, sourceFiles } from './check-no-hex.mjs';

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'no-hex-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe('check-no-hex (FE-43)', () => {
  test('reports hex colors in components with file and line', () => {
    const root = fixture({ 'src/components/Badge.module.css': '.a {\n  color: #CF900B;\n}\n' });
    expect(findHexColors(root, sourceFiles(root))).toEqual(['src/components/Badge.module.css:2: #CF900B']);
  });

  test('allows hex colors in src/theme and in tests, and token references anywhere', () => {
    const root = fixture({
      'src/theme/tokens.css': ':root { --color-gold: #cf900b; }',
      'src/features/x/X.test.tsx': "const c = '#fff';",
      'src/features/x/X.module.css': '.a { color: var(--color-gold); }',
    });
    expect(findHexColors(root, sourceFiles(root))).toEqual([]);
  });
});
