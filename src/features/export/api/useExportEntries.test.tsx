import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { AppProviders, createQueryClient } from '../../../app/AppProviders';
import { ApiError, createApiClient, type components } from '../../../lib/api';
import { API, problemResponse, sampleEntries } from '../../../test/handlers';
import { server } from '../../../test/server';
import { EXPORT_PAGE_SIZE, useExportEntries } from './useExportEntries';

type Entry = components['schemas']['Entry'];

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AppProviders apiClient={createApiClient(window.location.origin)} queryClient={createQueryClient({ retry: false })}>
      {children}
    </AppProviders>
  );
}

function manyEntries(count: number): Entry[] {
  const [template] = sampleEntries;
  if (!template) throw new Error('sampleEntries is empty');
  return Array.from({ length: count }, (_, i) => ({
    ...template,
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  }));
}

describe('useExportEntries', () => {
  test('returns the whole ledger from the default handler, oldest first', async () => {
    const { result } = renderHook(() => useExportEntries(), { wrapper });
    result.current.mutate();
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.map((entry) => entry.session_date)).toEqual(['2026-01-05', '2026-01-12']);
  });

  test('reads every page at the capped page size', async () => {
    const all = manyEntries(EXPORT_PAGE_SIZE * 2 + 5);
    const requested: string[] = [];
    server.use(
      http.get(`${API}/export/entries`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        const page = Number(params.get('page'));
        requested.push(`${String(page)}:${params.get('page_size') ?? ''}`);
        return HttpResponse.json({
          items: all.slice((page - 1) * EXPORT_PAGE_SIZE, page * EXPORT_PAGE_SIZE),
          page: { page, page_size: EXPORT_PAGE_SIZE, total_items: all.length },
        });
      }),
    );
    const { result } = renderHook(() => useExportEntries(), { wrapper });
    result.current.mutate();
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(all);
    expect(requested).toEqual(['1:200', '2:200', '3:200']);
  });

  test('keeps an entry once when it moves across a page boundary during the export', async () => {
    const all = manyEntries(EXPORT_PAGE_SIZE + 1);
    server.use(
      http.get(`${API}/export/entries`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        // Page 2 repeats the last entry of page 1, as if a new entry had shifted everything by one.
        const items = page === 1 ? all.slice(0, EXPORT_PAGE_SIZE) : all.slice(EXPORT_PAGE_SIZE - 1);
        return HttpResponse.json({ items, page: { page, page_size: EXPORT_PAGE_SIZE, total_items: all.length } });
      }),
    );
    const { result } = renderHook(() => useExportEntries(), { wrapper });
    result.current.mutate();
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(all);
  });

  test('fails with the server problem when a page is refused', async () => {
    server.use(
      http.get(`${API}/export/entries`, () =>
        problemResponse({ type: 'about:blank', title: 'Forbidden', status: 403, request_id: 'req-1' }),
      ),
    );
    const { result } = renderHook(() => useExportEntries(), { wrapper });
    result.current.mutate();
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.status).toBe(403);
  });

  test('fails with a network error when the server cannot be reached', async () => {
    server.use(http.get(`${API}/export/entries`, () => HttpResponse.error()));
    const { result } = renderHook(() => useExportEntries(), { wrapper });
    result.current.mutate();
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.status).toBeUndefined();
  });
});
