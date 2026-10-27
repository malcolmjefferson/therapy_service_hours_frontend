import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from 'pdf-lib';
import { colorTokens } from '../../../theme/tokenValues';
import type { GoalLine } from '../model/goalSummary';
import { layoutRows, paginateRows, type Measure, type RowSlice } from '../model/pdfLayout';
import type { PdfReport } from '../model/pdfReport';
import { FONT_FILES, dataUrlBytes } from './fonts';

// A4 landscape: the entries table has eight columns.
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const FOOTER_HEIGHT = 26;
const CELL_PAD = 4;
const BODY_SIZE = 8.5;
const LINE_HEIGHT = 11;
const ROW_PAD = 5;
const HEADER_HEIGHT = 20;
const GOAL_ROW_HEIGHT = 18;

function hexToRgb(hex: string): Color {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function palette() {
  const tokens = colorTokens();
  const color = (name: string) => {
    const hex = tokens[`color-${name}`];
    if (hex === undefined) throw new Error(`Theme token color-${name} is missing`);
    return hexToRgb(hex);
  };
  return {
    ink: color('ink'),
    soft: color('ink-soft'),
    headerFill: color('gold-tint'),
    approved: color('lime'),
    pending: color('lime-tint'),
  };
}

/** Text the font can draw: whitespace runs (including line breaks in notes) become one space, and anything the font has no glyph for becomes `?`. */
function drawable(text: string, supported: ReadonlySet<number>): string {
  let out = '';
  for (const char of text.normalize('NFC').replace(/\s+/g, ' ').trim()) {
    const code = char.codePointAt(0) ?? 0;
    out += code < 0x20 || !supported.has(code) ? '?' : char;
  }
  return out;
}

const hours = (value: number) => value.toFixed(2);

function goalText(goal: GoalLine): string {
  const target = goal.targetHours === null ? 'no target' : `${hours(goal.targetHours)} h target`;
  return `${hours(goal.approvedHours)} h approved, ${hours(goal.pendingHours)} h pending, ${target}`;
}

/**
 * Writes the report as a PDF and returns its bytes. Everything it needs is in this chunk (SEC-38): the fonts are
 * embedded as subsets, nothing is fetched, and the data is only what the caller already holds. It is loaded with
 * a dynamic `import()` the first time someone exports a PDF (FE-55).
 */
export async function buildPdf(report: PdfReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${report.title}, ${report.generatedOn}`);
  doc.setCreator('Therapy Service Hours');
  doc.setProducer('Therapy Service Hours');
  doc.setLanguage('en-US');
  doc.setCreationDate(new Date(`${report.generatedOn}T00:00:00Z`));

  const body = await doc.embedFont(dataUrlBytes(FONT_FILES.body), { subset: true });
  const bold = await doc.embedFont(dataUrlBytes(FONT_FILES.bodyBold), { subset: true });
  const heading = await doc.embedFont(dataUrlBytes(FONT_FILES.heading), { subset: true });
  const colors = palette();
  const supported = new Set(body.getCharacterSet());
  const clean = (text: string) => drawable(text, supported);

  const tableWidth = PAGE_WIDTH - 2 * MARGIN;
  const columnWidths = report.columns.map((column) => column.share * tableWidth);
  const textWidths = columnWidths.map((width) => width - 2 * CELL_PAD);
  const measureBody: Measure = (text) => body.widthOfTextAtSize(text, BODY_SIZE);
  const laidOut = layoutRows(
    report.rows.map((row) => row.map(clean)),
    textWidths,
    measureBody,
  );

  // Title block and goal summary sit above the table on the first page.
  const summaryHeight = 30 + 22 + (report.goals.length + 1) * GOAL_ROW_HEIGHT + 16;
  const bodyTop = PAGE_HEIGHT - MARGIN;
  const bodyBottom = MARGIN + FOOTER_HEIGHT;
  const pages = paginateRows(laidOut, {
    firstPageHeight: bodyTop - summaryHeight - HEADER_HEIGHT - bodyBottom,
    otherPageHeight: bodyTop - HEADER_HEIGHT - bodyBottom,
    lineHeight: LINE_HEIGHT,
    rowPad: ROW_PAD,
  });

  const drawText = (
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    font: PDFFont,
    size = BODY_SIZE,
    color = colors.ink,
  ) => {
    if (text !== '') page.drawText(text, { x, y, size, font, color });
  };

  const drawHeadings = (page: PDFPage, top: number) => {
    page.drawRectangle({
      x: MARGIN,
      y: top - HEADER_HEIGHT,
      width: tableWidth,
      height: HEADER_HEIGHT,
      color: colors.headerFill,
    });
    let x = MARGIN;
    report.columns.forEach((column, i) => {
      const width = columnWidths[i] ?? 0;
      const label = column.heading;
      const textX =
        column.align === 'right' ? x + width - CELL_PAD - bold.widthOfTextAtSize(label, BODY_SIZE) : x + CELL_PAD;
      drawText(page, label, textX, top - 13.5, bold);
      x += width;
    });
  };

  const drawSlices = (page: PDFPage, slices: readonly RowSlice[], top: number) => {
    let y = top;
    for (const { row, from, to } of slices) {
      let x = MARGIN;
      report.columns.forEach((column, i) => {
        const width = columnWidths[i] ?? 0;
        (row.cells[i] ?? []).slice(from, to).forEach((line, n) => {
          const textX = column.align === 'right' ? x + width - CELL_PAD - measureBody(line) : x + CELL_PAD;
          drawText(page, line, textX, y - LINE_HEIGHT * (n + 1) + 2.5, body);
        });
        x += width;
      });
      y -= (to - from) * LINE_HEIGHT + ROW_PAD;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: MARGIN + tableWidth, y },
        thickness: 0.4,
        color: colors.soft,
        opacity: 0.5,
      });
    }
  };

  const drawSummary = (page: PDFPage): number => {
    let y = bodyTop;
    drawText(page, clean(report.title), MARGIN, y - 20, heading, 22);
    y -= 30;
    const count = `${String(report.entryCount)} ${report.entryCount === 1 ? 'entry' : 'entries'}`;
    drawText(
      page,
      clean(
        `Made on ${report.generatedOn}. ${count}, oldest first. Rejected entries are listed but count toward no goal.`,
      ),
      MARGIN,
      y - 10,
      body,
      9,
      colors.soft,
    );
    y -= 22;
    const barX = MARGIN + 430;
    const barWidth = 200;
    drawText(page, 'Goal', MARGIN, y - 11, bold);
    drawText(page, 'Hours', MARGIN + 130, y - 11, bold);
    drawText(page, 'Progress (approved, then pending)', barX, y - 11, bold);
    y -= GOAL_ROW_HEIGHT;
    for (const goal of report.goals) {
      drawText(page, goal.label, MARGIN, y - 11, bold);
      drawText(page, goalText(goal), MARGIN + 130, y - 11, body);
      if (goal.targetHours !== null && goal.targetHours > 0) {
        const approvedShare = Math.min(1, goal.approvedHours / goal.targetHours);
        const pendingShare = Math.min(1 - approvedShare, goal.pendingHours / goal.targetHours);
        page.drawRectangle({
          x: barX,
          y: y - 13,
          width: barWidth,
          height: 9,
          borderColor: colors.soft,
          borderWidth: 0.6,
        });
        page.drawRectangle({ x: barX, y: y - 13, width: barWidth * approvedShare, height: 9, color: colors.approved });
        page.drawRectangle({
          x: barX + barWidth * approvedShare,
          y: y - 13,
          width: barWidth * pendingShare,
          height: 9,
          color: colors.pending,
        });
        const percent = `${String(Math.floor((goal.approvedHours / goal.targetHours) * 100))}%`;
        drawText(page, percent, barX + barWidth + 8, y - 11, body);
      }
      y -= GOAL_ROW_HEIGHT;
    }
    return y - 16;
  };

  pages.forEach((slices, index) => {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const top = index === 0 ? drawSummary(page) : bodyTop;
    drawHeadings(page, top);
    drawSlices(page, slices, top - HEADER_HEIGHT);
    if (report.rows.length === 0)
      drawText(page, 'No entries to list.', MARGIN + CELL_PAD, top - HEADER_HEIGHT - 14, body);
    const footer = `Page ${String(index + 1)} of ${String(pages.length)}`;
    drawText(page, footer, PAGE_WIDTH - MARGIN - body.widthOfTextAtSize(footer, 8), MARGIN, body, 8, colors.soft);
    drawText(page, clean(`${report.title}, ${report.generatedOn}`), MARGIN, MARGIN, body, 8, colors.soft);
  });

  // Plain objects rather than compressed object streams: smaller risk with older viewers and the fonts stay checkable.
  return doc.save({ useObjectStreams: false });
}
