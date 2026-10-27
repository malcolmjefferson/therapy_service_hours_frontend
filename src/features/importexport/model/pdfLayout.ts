/** Width of `text` in points, for the font and size the table uses. */
export type Measure = (text: string) => number;

/** The length of the longest prefix of `word` that fits `maxWidth`, at least 1 so a cut always makes progress. */
function widestPrefix(word: string, maxWidth: number, measure: Measure): number {
  let low = 1;
  let high = word.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(word.slice(0, mid)) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return low;
}

/**
 * Breaks `text` into lines no wider than `maxWidth`. Words stay whole; a word wider than the column on its own
 * (a long unbroken note) is cut at the last character that fits, so no text is ever lost or drawn outside its cell.
 */
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = '';
  const push = () => {
    lines.push(line);
    line = '';
  };
  for (const word of text.split(' ').filter((w) => w !== '')) {
    let rest = word;
    if (line !== '' && measure(`${line} ${rest}`) <= maxWidth) {
      line = `${line} ${rest}`;
      continue;
    }
    if (line !== '') push();
    // Look at no more than a line's worth of characters at a time, so a very long unbroken note stays cheap to measure.
    const reach = Math.max(2, Math.ceil(maxWidth * 2));
    while (rest.length > 1) {
      const chunk = rest.slice(0, reach);
      if (chunk.length === rest.length && measure(chunk) <= maxWidth) break;
      const cut = widestPrefix(chunk, maxWidth, measure);
      line = rest.slice(0, cut);
      push();
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line !== '' || lines.length === 0) push();
  return lines;
}

/** One table row after wrapping: the lines of each cell. */
export interface LaidOutRow {
  cells: string[][];
  lineCount: number;
}

/** Wraps every cell of every row to its column width. */
export function layoutRows(
  rows: readonly (readonly string[])[],
  widths: readonly number[],
  measure: Measure,
): LaidOutRow[] {
  return rows.map((row) => {
    const cells = widths.map((width, i) => wrapText(row[i] ?? '', width, measure));
    return { cells, lineCount: Math.max(1, ...cells.map((cell) => cell.length)) };
  });
}

/** Lines of a row that sit on one page. A row taller than a page continues on the next (`from` and `to` are line indexes). */
export interface RowSlice {
  row: LaidOutRow;
  from: number;
  to: number;
}

export interface PageSpace {
  /** Height in points left on the first page, below the title and goal summary. */
  firstPageHeight: number;
  /** Height in points left on every later page, below the repeated column headings. */
  otherPageHeight: number;
  lineHeight: number;
  /** Space added under each row (or each part of one) in points. */
  rowPad: number;
}

/**
 * Splits rows across pages. A row stays together when it fits on a page; when it does not fit in the space left,
 * it moves to a fresh page, and a row longer than a whole page is split by lines. Always returns at least one page
 * so an empty ledger still gets its title and summary.
 */
export function paginateRows(rows: readonly LaidOutRow[], space: PageSpace): RowSlice[][] {
  const { lineHeight, rowPad } = space;
  const height = (lines: number) => lines * lineHeight + rowPad;
  const pages: RowSlice[][] = [[]];
  let capacity = space.firstPageHeight;
  let used = 0;
  const nextPage = () => {
    pages.push([]);
    capacity = space.otherPageHeight;
    used = 0;
  };
  for (const row of rows) {
    const whole = height(row.lineCount);
    if (used > 0 && whole > capacity - used && whole <= space.otherPageHeight) nextPage();
    let from = 0;
    while (from < row.lineCount) {
      let fit = Math.floor((capacity - used - rowPad) / lineHeight);
      if (fit < 1) {
        if (used > 0) {
          nextPage();
          continue;
        }
        fit = 1; // A page too short for even one line still makes progress.
      }
      const to = Math.min(row.lineCount, from + fit);
      pages[pages.length - 1]?.push({ row, from, to });
      used += height(to - from);
      from = to;
    }
  }
  return pages;
}
