#!/usr/bin/env node
// Updates the pinned API spec from a backend checkout and regenerates the types (ADR-0006).
//   npm run api:sync                          # from ../therapy_service_hours_backend
//   npm run api:sync -- --from <backend dir>  # another checkout
// The backend checkout should be at the commit being released; its HEAD SHA is recorded.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PINNED_SPEC, SOURCE_FILE } from './api-drift.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const i = process.argv.indexOf('--from');
const backendDir = resolve(root, i === -1 ? '../therapy_service_hours_backend' : process.argv[i + 1]);
const spec = join(backendDir, 'api', 'openapi.yaml');

if (!existsSync(spec)) {
  console.error(`No backend spec at ${spec}. Pass --from <backend checkout>.`);
  process.exit(1);
}

const git = (...args) => execFileSync('git', ['-C', backendDir, ...args], { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
if (git('status', '--porcelain', '--', 'api/openapi.yaml') !== '') {
  console.error('The backend spec has uncommitted changes. Commit it first so the pinned copy records a real commit.');
  process.exit(1);
}

copyFileSync(spec, join(root, PINNED_SPEC));
const source = { repository: 'malcolmjefferson/therapy_service_hours_backend', path: 'api/openapi.yaml', commit };
writeFileSync(join(root, SOURCE_FILE), `${JSON.stringify(source, null, 2)}\n`);
execFileSync('npx', ['openapi-typescript', PINNED_SPEC, '-o', 'src/lib/api/schema.d.ts'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
console.log(`Pinned the backend spec at ${commit}. Review the diff, run npm run typecheck, and commit.`);
