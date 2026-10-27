import { useMutation } from '@tanstack/react-query';
import { ApiError, useApiClient, type components } from '../../../lib/api';

type Entry = components['schemas']['Entry'];

/** The largest page the export endpoint allows, so a ledger takes as few requests as possible. */
const EXPORT_PAGE_SIZE = 200;

/**
 * Reads every one of the caller's own entries, oldest first, by walking the export pages (FR-IO-04).
 * The file is built from the result, so every export format shares this one read. Nothing is cached:
 * an export must show the ledger as it is now.
 */
export function useExportEntries() {
  const client = useApiClient();
  return useMutation<Entry[], ApiError>({
    mutationFn: async () => {
      const entries: Entry[] = [];
      let lastPage = 1;
      for (let page = 1; page <= lastPage; page += 1) {
        let result;
        try {
          result = await client.GET('/export/entries', { params: { query: { page, page_size: EXPORT_PAGE_SIZE } } });
        } catch {
          throw new ApiError(undefined, undefined);
        }
        if (!result.data) {
          throw new ApiError(result.response.status, 'type' in result.error ? result.error : undefined);
        }
        entries.push(...result.data.items);
        lastPage = Math.ceil(result.data.page.total_items / EXPORT_PAGE_SIZE);
      }
      return entries;
    },
  });
}
