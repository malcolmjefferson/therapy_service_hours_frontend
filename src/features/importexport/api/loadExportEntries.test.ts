import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { ApiError, createApiClient } from '../../../lib/api';
import { API } from '../../../test/handlers';
import { server } from '../../../test/server';
import { entry } from '../model/testEntries';
import { EXPORT_PAGE_SIZE, loadExportEntries } from './loadExportEntries';

// Made per call: the client captures `fetch` when it is created, and MSW swaps it in when the suite starts.
const makeClient = () => createApiClient(window.location.origin);

/** Serves `total` entries, `page_size` at a time, and records every query string. */
function serve(total: number) {
  const calls: URLSearchParams[] = [];
  const all = Array.from({ length: total }, (_, i) =>
    entry({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` }),
  );
  server.use(
    http.get(`${API}/export/entries`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      calls.push(query);
      const page = Number(query.get('page'));
      const size = Number(query.get('page_size'));
      return HttpResponse.json({
        items: all.slice((page - 1) * size, page * size),
        page: { page, page_size: size, total_items: total },
      });
    }),
  );
  return { calls, all };
}

describe('loadExportEntries', () => {
  test('reads every page at the largest page size and returns the ledger in order', async () => {
    const { calls, all } = serve(450);
    const result = await loadExportEntries(makeClient());
    expect(result).toEqual(all);
    expect(calls.map((q) => [q.get('page'), q.get('page_size')])).toEqual([
      ['1', String(EXPORT_PAGE_SIZE)],
      ['2', String(EXPORT_PAGE_SIZE)],
      ['3', String(EXPORT_PAGE_SIZE)],
    ]);
  });

  test('an empty ledger is one request and no entries', async () => {
    const { calls } = serve(0);
    expect(await loadExportEntries(makeClient())).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  test('a ledger of exactly one full page does not ask for a second', async () => {
    const { calls } = serve(EXPORT_PAGE_SIZE);
    expect(await loadExportEntries(makeClient())).toHaveLength(EXPORT_PAGE_SIZE);
    expect(calls).toHaveLength(1);
  });

  test('a failed page rejects with its status and returns nothing partial', async () => {
    server.use(
      http.get(`${API}/export/entries`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        if (page === 2) return HttpResponse.json({ status: 503 }, { status: 503 });
        return HttpResponse.json({ items: [entry()], page: { page, page_size: 200, total_items: 400 } });
      }),
    );
    await expect(loadExportEntries(makeClient())).rejects.toMatchObject({ name: 'ApiError', status: 503 });
  });

  test('a network failure is an ApiError without a status', async () => {
    server.use(http.get(`${API}/export/entries`, () => HttpResponse.error()));
    const error = await loadExportEntries(makeClient()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: undefined });
  });

  test('stops when a page comes back empty even if the total says there is more', async () => {
    server.use(
      http.get(`${API}/export/entries`, () =>
        HttpResponse.json({ items: [], page: { page: 1, page_size: 200, total_items: 999 } }),
      ),
    );
    expect(await loadExportEntries(makeClient())).toEqual([]);
  });
});
