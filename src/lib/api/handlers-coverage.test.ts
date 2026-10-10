import { describe, expect, test } from 'vitest';
import { defaultHandlers, handlerExemptions } from '../../test/handlers';
import spec from './openapi.yaml?raw';

/** Path keys under `paths:` in the pinned spec (two-space indented keys starting with '/'). */
function specPaths(): string[] {
  const section = spec.split(/^paths:\s*$/m)[1]?.split(/^\S/m)[0] ?? '';
  return [...section.matchAll(/^ {2}(\/[^:\s]*):\s*$/gm)].map((m) => m[1] ?? '');
}

describe('MSW handler coverage (FE-66, ADR-0006)', () => {
  test('the pinned spec has paths to check', () => {
    expect(specPaths()).toContain('/healthz');
  });

  test('every spec path has a default handler or an explicit exemption', () => {
    const missing = specPaths().filter((p) => !(p in defaultHandlers) && !(p in handlerExemptions));
    expect(missing).toEqual([]);
  });

  test('no handler or exemption refers to a path the spec does not have', () => {
    const paths = new Set(specPaths());
    const stale = [...Object.keys(defaultHandlers), ...Object.keys(handlerExemptions)].filter((p) => !paths.has(p));
    expect(stale).toEqual([]);
  });
});
