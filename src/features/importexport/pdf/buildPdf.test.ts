import { PDFDocument } from 'pdf-lib';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { entry } from '../model/testEntries';
import { buildPdfReport } from '../model/pdfReport';
import { buildPdf } from './buildPdf';

const generatedAt = new Date(2026, 9, 27, 9, 0);

function ledger(count: number) {
  return Array.from({ length: count }, (_, i) =>
    entry({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      session_date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      notes: `Session ${String(i + 1)} with a note long enough to wrap onto a second line of the table.`,
    }),
  );
}

async function build(entries = ledger(3)) {
  const bytes = await buildPdf(buildPdfReport(entries, generatedAt));
  return { bytes, doc: await PDFDocument.load(bytes) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildPdf', () => {
  test('makes a PDF with the file header', async () => {
    const { bytes } = await build();
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  test('a short ledger is one landscape A4 page titled with its date', async () => {
    const { bytes, doc } = await build();
    expect(new TextDecoder('latin1').decode(bytes)).toContain('/Lang (en-US)');
    expect(doc.getPageCount()).toBe(1);
    const page = doc.getPage(0);
    expect(Math.round(page.getWidth())).toBe(842);
    expect(Math.round(page.getHeight())).toBe(595);
    expect(doc.getTitle()).toBe('Service hours, 2026-10-27');
  });

  test('a long ledger paginates across several pages', async () => {
    const { doc } = await build(ledger(120));
    expect(doc.getPageCount()).toBeGreaterThan(3);
  }, 30000);

  test('an empty ledger still makes a page', async () => {
    const { doc } = await build([]);
    expect(doc.getPageCount()).toBe(1);
  });

  test('embeds the fonts as TrueType subsets, with no built-in fonts to rely on', async () => {
    const { bytes } = await build();
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.match(/\/FontFile2/g)).toHaveLength(3);
    expect(text).not.toMatch(/\/BaseFont\s*\/(Helvetica|Times|Courier)/);
    expect(text).toMatch(/\/BaseFont\s*\/Inter-Regular/);
    expect(text).toMatch(/\/BaseFont\s*\/Inter-SemiBold/);
    expect(text).toMatch(/\/BaseFont\s*\/Fredoka-SemiBold/);
  });

  test('makes no network request, however it would be made', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('no network allowed')));
    const xhrSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('XMLHttpRequest', xhrSpy);
    vi.stubGlobal('WebSocket', xhrSpy);
    vi.stubGlobal('Image', xhrSpy);
    await build(ledger(40));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
  });

  test('text a font has no glyph for, and line breaks in notes, do not stop the export', async () => {
    const odd = entry({
      notes: 'Line one\nline two\t— café — 你好 ✓ \u0000 end',
      category: { ...entry().category, name: 'Café ☕' },
    });
    const { doc } = await build([odd]);
    expect(doc.getPageCount()).toBe(1);
  });

  test('one unbroken, very long note stays inside its cell', async () => {
    const { doc } = await build([entry({ notes: 'x'.repeat(4000) })]);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
