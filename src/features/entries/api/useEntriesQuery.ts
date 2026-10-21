import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError, useApiClient, type components } from '../../../lib/api';
import { PAGE_SIZE, filterQuery, type EntriesView } from '../model/viewState';
import { entryKeys } from './entryKeys';

type EntryList = components['schemas']['EntryListResponse'];

/**
 * One page of the caller's own entries that match the filters, in the chosen order. The previous
 * page stays on screen while the next one loads, so sorting, filtering and paging do not blank the
 * table. Pass `enabled: false` while the filters cannot be sent, such as a date range that runs backwards.
 */
export function useEntriesQuery(view: EntriesView, enabled = true) {
  const client = useApiClient();
  return useQuery<EntryList, ApiError>({
    queryKey: entryKeys.list(view),
    queryFn: async ({ signal }) => {
      let result;
      try {
        result = await client.GET('/entries', {
          params: {
            query: { ...filterQuery(view), sort: view.sort, dir: view.dir, page: view.page, page_size: PAGE_SIZE },
          },
          signal,
        });
      } catch {
        throw new ApiError(undefined, undefined);
      }
      if (!result.data) {
        throw new ApiError(result.response.status, 'type' in result.error ? result.error : undefined);
      }
      return result.data;
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}
