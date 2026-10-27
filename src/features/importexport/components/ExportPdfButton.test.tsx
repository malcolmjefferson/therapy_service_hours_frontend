import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { API } from '../../../test/handlers';
import { renderWithProviders } from '../../../test/render';
import { server } from '../../../test/server';
import { entry } from '../model/testEntries';
import { ExportPdfButton } from './ExportPdfButton';

const saved: Blob[] = [];
const names: string[] = [];

beforeEach(() => {
  saved.length = 0;
  names.length = 0;
  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
    saved.push(blob as Blob);
    return 'blob:test';
  });
  URL.revokeObjectURL = vi.fn();
  // jsdom cannot save a file: record the name the link asks for instead of navigating.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    names.push(this.download);
  });
});

// Building a PDF takes longer than the default one second a `findBy` waits.
const SLOW = { timeout: 15000 };

afterEach(() => {
  server.events.removeAllListeners();
  vi.restoreAllMocks();
});

/** Serves `total` entries and records the path of every request the page makes. */
function serve(total: number) {
  const requests: string[] = [];
  const all = Array.from({ length: total }, (_, i) =>
    entry({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, notes: `Pseudonym note ${String(i)}` }),
  );
  server.events.on('request:start', ({ request }) => {
    requests.push(new URL(request.url).pathname);
  });
  server.use(
    http.get(`${API}/export/entries`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      const page = Number(query.get('page'));
      const size = Number(query.get('page_size'));
      return HttpResponse.json({
        items: all.slice((page - 1) * size, page * size),
        page: { page, page_size: size, total_items: total },
      });
    }),
  );
  return requests;
}

describe('ExportPdfButton', () => {
  test('reads the whole ledger, makes the PDF in the browser and saves it with no further request', async () => {
    const requests = serve(260);
    renderWithProviders(<ExportPdfButton now={() => new Date(2026, 9, 27, 9, 0)} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Export PDF' }));

    expect(await screen.findByText('Saved service-hours-2026-10-27.pdf.', undefined, SLOW)).toBeInTheDocument();
    expect(names).toEqual(['service-hours-2026-10-27.pdf']);
    // Only the two pages of the ledger: the fonts and the library cost no request while it generates.
    expect(requests).toEqual(['/api/v1/export/entries', '/api/v1/export/entries']);

    const [blob] = saved;
    if (!blob) throw new Error('nothing was saved');
    expect(blob.type).toBe('application/pdf');
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBeGreaterThan(5);
  });

  test('shows that it is working and ignores a second click meanwhile', async () => {
    serve(3);
    const user = userEvent.setup();
    renderWithProviders(<ExportPdfButton />);
    const button = screen.getByRole('button', { name: 'Export PDF' });
    await user.click(button);
    const busy = await screen.findByRole('button', { name: 'Making PDF…' });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    expect(busy).toHaveFocus();
    await user.click(busy);
    await screen.findByText(/^Saved service-hours-/, undefined, SLOW);
    expect(names).toHaveLength(1);
    expect(await screen.findByRole('button', { name: 'Export PDF' })).toHaveAttribute('aria-disabled', 'false');
  });

  test('says why when the ledger cannot be loaded, and saves nothing', async () => {
    server.use(http.get(`${API}/export/entries`, () => HttpResponse.error()));
    renderWithProviders(<ExportPdfButton />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Export PDF' }));
    expect(await screen.findByText(/could not be loaded\. Check your connection/)).toBeInTheDocument();
    expect(names).toEqual([]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Export PDF' })).toBeInTheDocument();
    });
  });

  test('asks the person to wait when the server says too many requests', async () => {
    server.use(http.get(`${API}/export/entries`, () => HttpResponse.json({ status: 429 }, { status: 429 })));
    renderWithProviders(<ExportPdfButton />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Export PDF' }));
    expect(await screen.findByText('Too many requests. Wait a moment and try again.')).toBeInTheDocument();
  });
});
