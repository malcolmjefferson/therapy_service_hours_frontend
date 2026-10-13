import css from './tokens.css?raw';

/** Expands #rgb to #rrggbb. */
function expand(hex: string): string {
  const h = hex.toLowerCase();
  if (h.length !== 4) {
    return h;
  }
  const [r, g, b] = [h.charAt(1), h.charAt(2), h.charAt(3)];
  return `#${r}${r}${g}${g}${b}${b}`;
}

/** The `--color-*` tokens, read straight from tokens.css so tests follow the real palette. Keys omit the `--`. */
export function colorTokens(): Record<string, string> {
  const entries: [string, string][] = [...css.matchAll(/--(color-[a-z-]+):\s*(#[0-9a-f]{3,6});/gi)].map((m) => [
    m[1] ?? '',
    expand(m[2] ?? ''),
  ]);
  return Object.fromEntries(entries);
}
