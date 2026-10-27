import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from 'vitest';
import type { components } from '../../../lib/api';
import { API, sampleEntries } from '../../../test/handlers';
import { renderWithProviders } from '../../../test/render';
import { server } from '../../../test/server';
import { ToastProvider } from '../../../components';
import { ExportCsvButton } from './ExportCsvButton';

type Entry = components['schemas']['Entry'];

let blobs: Blob[];
let saved: string[];
let revoke: Mock<(url: string) => void>;

const template: Entry = sampleEntries[1] ?? failMissing();

function failMissing(): never {
  throw new Error('sampleEntries is empty');
}

beforeEach(() => {
  blobs = [];
  saved = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return 'blob:test';
  });
  revoke = vi.fn<(url: string) => void>();
  URL.revokeObjectURL = revoke;
  // jsdom does not navigate; the click is how the test sees the file name.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderButton() {
  renderWithProviders(
    <ToastProvider>
      <ExportCsvButton />
    </ToastProvider>,
  );
  return userEvent.setup();
}

/** Serves `total` entries over the export endpoint 200 at a time and records each page asked for. */
function serveExport(total: number) {
  const pages: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/export/entries`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      pages.push(query);
      const page = Number(query.get('page'));
      const size = Number(query.get('page_size'));
      const items: Entry[] = Array.from({ length: Math.max(0, Math.min(size, total - (page - 1) * size)) }, (_, i) => ({
        ...template,
        id: `00000000-0000-4000-8000-${String((page - 1) * size + i).padStart(12, '0')}`,
      }));
      return HttpResponse.json({ items, page: { page, page_size: size, total_items: total } });
    }),
  );
  return pages;
}

describe('ExportCsvButton', () => {
  test('downloads the ledger as a CSV file and says so', async () => {
    const user = renderButton();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(await screen.findByText('Exported 2 entries to CSV.')).toBeInTheDocument();
    expect(saved).toEqual([expect.stringMatching(/^therapy-hours-\d{4}-\d{2}-\d{2}\.csv$/)]);
    const blob = blobs[0];
    expect(blob?.type).toBe('text/csv;charset=utf-8');
    const text = await blob?.text();
    expect(text?.startsWith('﻿"Date","Start"')).toBe(false); // the BOM is stripped by Blob.text()
    expect(text).toContain('"2026-01-05","09:00","10:00","Indirect Service","Staff Meetings"');
    expect(text?.indexOf('2026-01-05')).toBeLessThan(text?.indexOf('2026-01-12') ?? -1); // oldest first
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });

  test('starts the file with a byte-order mark', async () => {
    const user = renderButton();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    await screen.findByText('Exported 2 entries to CSV.');
    const bytes = new Uint8Array((await blobs[0]?.arrayBuffer()) ?? []);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  test('reads every page of a ledger longer than one page', async () => {
    const pages = serveExport(450);
    const user = renderButton();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(await screen.findByText('Exported 450 entries to CSV.')).toBeInTheDocument();
    expect(pages.map((query) => query.get('page'))).toEqual(['1', '2', '3']);
    for (const query of pages) expect(query.get('page_size')).toBe('200');
    const lines = (await blobs[0]?.text())?.trimEnd().split('\r\n');
    expect(lines).toHaveLength(451);
  });

  test('exports an empty ledger as a header row', async () => {
    serveExport(0);
    const user = renderButton();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText('Exported 0 entries to CSV.')).toBeInTheDocument();
    expect((await blobs[0]?.text())?.trimEnd().split('\r\n')).toHaveLength(1);
  });

  test('says "1 entry" for a single entry', async () => {
    serveExport(1);
    const user = renderButton();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText('Exported 1 entry to CSV.')).toBeInTheDocument();
  });

  test('is disabled and says Exporting… while it reads the ledger', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API}/export/entries`, async () => {
        await gate;
        return HttpResponse.json({ items: [...sampleEntries], page: { page: 1, page_size: 200, total_items: 2 } });
      }),
    );
    const user = renderButton();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(screen.getByRole('button', { name: 'Exporting…' })).toBeDisabled();
    release();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
    });
  });

  test('saves nothing and explains when the ledger cannot be read', async () => {
    server.use(http.get(`${API}/export/entries`, () => HttpResponse.json({}, { status: 500 })));
    const user = renderButton();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(await screen.findByText(/could not be exported/)).toBeInTheDocument();
    expect(saved).toEqual([]);
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
  });

  test('saves nothing when a later page fails', async () => {
    server.use(
      http.get(`${API}/export/entries`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        if (page === 2) return HttpResponse.error();
        return HttpResponse.json({ items: [], page: { page, page_size: 200, total_items: 400 } });
      }),
    );
    const user = renderButton();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText(/could not be exported/)).toBeInTheDocument();
    expect(saved).toEqual([]);
  });
});
