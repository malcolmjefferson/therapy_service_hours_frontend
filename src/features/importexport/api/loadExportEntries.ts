import { ApiError, type ApiClient, type components } from '../../../lib/api';

type Entry = components['schemas']['Entry'];

/** The largest page `GET /export/entries` serves. */
export const EXPORT_PAGE_SIZE = 200;

/** A stop for a runaway loop if the server ever reports a page count that never ends (200 000 entries). */
const MAX_PAGES = 1000;

/**
 * Reads the caller's whole ledger from `GET /export/entries`, oldest first, one page at a time. Every export
 * format builds its file from this one list, so a PDF needs no second call (FR-IO-06). A failed page rejects with
 * an `ApiError`; nothing partial is returned, because a short ledger in a file the person keeps is worse than none.
 */
export async function loadExportEntries(client: ApiClient, signal?: AbortSignal): Promise<Entry[]> {
  const entries: Entry[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let result;
    try {
      result = await client.GET('/export/entries', {
        params: { query: { page, page_size: EXPORT_PAGE_SIZE } },
        ...(signal ? { signal } : {}),
      });
    } catch {
      throw new ApiError(undefined, undefined);
    }
    if (!result.data) {
      throw new ApiError(result.response.status, 'type' in result.error ? result.error : undefined);
    }
    entries.push(...result.data.items);
    if (result.data.items.length === 0 || entries.length >= result.data.page.total_items) return entries;
  }
  throw new ApiError(undefined, undefined);
}
