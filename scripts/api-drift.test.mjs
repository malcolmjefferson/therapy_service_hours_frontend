// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { compareSpecs, PINNED_SPEC } from './api-drift.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const pinned = readFileSync(join(root, PINNED_SPEC), 'utf8');

function runGate(backendSpecText) {
  const file = join(mkdtempSync(join(tmpdir(), 'api-drift-')), 'openapi.yaml');
  writeFileSync(file, backendSpecText);
  try {
    execFileSync(process.execPath, [join(root, 'scripts/api-drift.mjs'), '--backend-spec', file], { stdio: 'pipe' });
    return 0;
  } catch (e) {
    return e.status;
  }
}

describe('API drift gate (ADR-0006)', () => {
  test('identical specs pass, regardless of line endings', () => {
    expect(compareSpecs(pinned, pinned)).toBeNull();
    expect(compareSpecs(pinned, pinned.replace(/\n/g, '\r\n'))).toBeNull();
    expect(runGate(pinned)).toBe(0);
  });

  test('a backend spec changed without syncing fails the gate', () => {
    const changed = pinned.replace('/healthz:', '/health:');
    expect(compareSpecs(pinned, changed)).toMatch(/first difference at line \d+/);
    expect(runGate(changed)).toBe(1);
  });

  test('the pinned copy records the backend commit', () => {
    const source = JSON.parse(readFileSync(join(root, 'src/lib/api/openapi.source.json'), 'utf8'));
    expect(source.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(source.path).toBe('api/openapi.yaml');
  });
});
