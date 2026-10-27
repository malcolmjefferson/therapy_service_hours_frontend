import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

/** Every non-test source file under `src`, as `[path relative to src, text]`. */
function sources(dir = join(process.cwd(), 'src')): [string, string][] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [
          [relative(join(process.cwd(), 'src'), full).split(sep).join('/'), readFileSync(full, 'utf8')] as [
            string,
            string,
          ],
        ]
      : [];
  });
}

describe('the PDF library stays out of the initial bundle (FE-55)', () => {
  const files = sources();

  test('only the pdf folder imports the library or the fonts', () => {
    const offenders = files
      .filter(([path]) => !path.startsWith('features/importexport/pdf/'))
      .filter(([, text]) => /from ['"](pdf-lib|@pdf-lib\/fontkit)['"]/.test(text) || /\?inline['"]/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  test('the builder is reached only through a dynamic import()', () => {
    const importers = files.filter(
      ([path, text]) => !path.startsWith('features/importexport/pdf/') && text.includes('pdf/buildPdf'),
    );
    expect(importers.map(([path]) => path)).toEqual(['features/importexport/hooks/usePdfExport.ts']);
    for (const [, text] of importers) {
      expect(text).not.toMatch(/^import .*pdf\/buildPdf/m);
      expect(text).toMatch(/import\(['"]\.\.\/pdf\/buildPdf['"]\)/);
    }
  });
});
