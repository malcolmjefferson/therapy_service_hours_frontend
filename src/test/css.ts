/** Small helpers for tests that read CSS source (contrast, focus-ring and reduced-motion checks). */

export interface CssRule {
  selector: string;
  declarations: Record<string, string>;
}

/** Innermost `selector { declarations }` blocks, including those inside `@media`. Comments are ignored. */
export function parseRules(css: string): CssRule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations: Record<string, string> = {};
    for (const declaration of (match[2] ?? '').split(';')) {
      const colon = declaration.indexOf(':');
      if (colon > 0) {
        declarations[declaration.slice(0, colon).trim().toLowerCase()] = declaration.slice(colon + 1).trim();
      }
    }
    rules.push({ selector: (match[1] ?? '').trim(), declarations });
  }
  return rules;
}

/** `var(--color-ink)` becomes `color-ink`; anything else (a keyword, a color-mix) becomes null. */
export function colorTokenName(value: string | undefined): string | null {
  const match = /^var\(--(color-[a-z-]+)\)$/.exec(value?.trim() ?? '');
  return match?.[1] ?? null;
}

/** Removes every `@media <query> { ... }` block whose query contains `queryText`, matching braces. */
export function withoutMediaBlocks(css: string, queryText: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf('@media', i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    const open = css.indexOf('{', at);
    if (open === -1) {
      out += css.slice(i);
      break;
    }
    if (!css.slice(at, open).includes(queryText)) {
      out += css.slice(i, open + 1);
      i = open + 1;
      continue;
    }
    out += css.slice(i, at);
    let depth = 1;
    i = open + 1;
    while (i < css.length && depth > 0) {
      depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
      i += 1;
    }
  }
  return out;
}
