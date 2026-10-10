#!/usr/bin/env node
// Drift gate (ADR-0006): fails when the pinned spec differs from the backend spec being released.
// The pipeline runs it with the backend source at the release commit:
//   node scripts/api-drift.mjs --backend-spec <backend>/api/openapi.yaml
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PINNED_SPEC = 'src/lib/api/openapi.yaml';
export const SOURCE_FILE = 'src/lib/api/openapi.source.json';

/** Line endings differ between Windows and Linux checkouts; content must not. */
export function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

/** Returns null when the specs match, or a short description of the first difference. */
export function compareSpecs(pinned, backend) {
  const a = normalize(pinned).split('\n');
  const b = normalize(backend).split('\n');
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) {
      return `first difference at line ${i + 1}:\n  pinned:  ${a[i] ?? '<end of file>'}\n  backend: ${b[i] ?? '<end of file>'}`;
    }
  }
  return null;
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const backendSpec = argValue('--backend-spec');
  if (!backendSpec) {
    console.error('usage: api-drift.mjs --backend-spec <path to backend api/openapi.yaml>');
    process.exit(2);
  }
  const source = JSON.parse(readFileSync(join(root, SOURCE_FILE), 'utf8'));
  const diff = compareSpecs(readFileSync(join(root, PINNED_SPEC), 'utf8'), readFileSync(backendSpec, 'utf8'));
  if (diff) {
    console.error(
      `API drift: ${PINNED_SPEC} (pinned from backend ${source.commit}) differs from ${backendSpec}.\n` +
        `${diff}\nRun \`npm run api:sync\` against the backend commit being released and commit the result (ADR-0006).`,
    );
    process.exit(1);
  }
  console.log(`No API drift: the pinned spec matches ${backendSpec} (pinned from backend ${source.commit}).`);
}
