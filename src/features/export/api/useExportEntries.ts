import { useMutation } from '@tanstack/react-query';
import { ApiError, useApiClient, type ApiClient, type components } from '../../../lib/api';

type Entry = components['schemas']['Entry'];

/** The endpoint's page-size cap (GO-56). */
export const EXPORT_PAGE_SIZE = 200;
// Imports are capped at 5000 rows, so a ledger this long is not real; the cap only stops a
// misbehaving server looping the client.
const MAX_PAGES = 100;

/** Reads every page of `GET /export/entries`: the caller's whole ledger, oldest first. */
export async function fetchExportEntries(client: ApiClient): Promise<Entry[]> {
  const entries: Entry[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let result;
    try {
      result = await client.GET('/export/entries', {
        params: { query: { page, page_size: EXPORT_PAGE_SIZE } },
      });
    } catch {
      throw new ApiError(undefined, undefined);
    }
    if (!result.data) {
      throw new ApiError(result.response.status, 'type' in result.error ? result.error : undefined);
    }
    // An entry added while the export runs can move one across a page boundary; keep it once.
    for (const entry of result.data.items) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      entries.push(entry);
    }
    if (result.data.items.length === 0 || page * EXPORT_PAGE_SIZE >= result.data.page.total_items) break;
  }
  return entries;
}

/**
 * Loads the caller's whole ledger for an export. It is a mutation, not a query: the data is read on
 * demand when the user asks for a file and is never cached or shown. Markdown, CSV and PDF all start here.
 */
export function useExportEntries() {
  const client = useApiClient();
  return useMutation<Entry[], ApiError>({ mutationFn: () => fetchExportEntries(client) });
}
