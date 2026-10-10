#!/usr/bin/env node
// FE-43: colors come from theme tokens. Fails if a hex color appears in src/ outside src/theme.
// A dependency-free stand-in for stylelint's color-no-hex (stylelint pulled in a dependency
// with an unfixed high-severity advisory, which would fail npm audit).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const CHECKED = /\.(css|tsx?|jsx?)$/;

/** Returns "file:line: match" for every hex color in `files` (paths relative to `root`). */
export function findHexColors(root, files) {
  const hits = [];
  for (const file of files) {
    const lines = readFileSync(join(root, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(HEX)) {
        hits.push(`${file}:${i + 1}: ${m[0]}`);
      }
    });
  }
  return hits;
}

/** Lists checkable files under src/, excluding src/theme and tests. */
export function sourceFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(root, full).split(sep).join('/');
      if (statSync(full).isDirectory()) {
        if (rel !== 'src/theme') walk(full);
      } else if (CHECKED.test(name) && !/\.test\.[jt]sx?$/.test(name)) {
        out.push(rel);
      }
    }
  };
  walk(join(root, 'src'));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const hits = findHexColors(root, sourceFiles(root));
  if (hits.length > 0) {
    console.error(`FE-43: use theme tokens instead of hex colors:\n${hits.map((h) => `  ${h}`).join('\n')}`);
    process.exit(1);
  }
  console.log('FE-43: no hex colors outside src/theme');
}
