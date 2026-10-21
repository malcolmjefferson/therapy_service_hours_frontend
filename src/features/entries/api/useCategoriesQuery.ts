import { useQuery } from '@tanstack/react-query';
import type { SelectGroup } from '../../../components';
import { ApiError, useApiClient, type components } from '../../../lib/api';
import { entryKeys } from './entryKeys';

type CategoryList = components['schemas']['CategoryListResponse'];

const ONE_HOUR_MS = 60 * 60 * 1000;

/** The categories under their group headings, in the API's display order, as the form's select wants them. */
export function toSelectGroups(list: CategoryList): SelectGroup[] {
  return list.groups.map((group) => ({
    label: group.label,
    options: group.categories.map((category) => ({ value: category.id, label: category.name })),
  }));
}

/** The 12 service categories. They change rarely, so they are kept for an hour like the API's `Cache-Control`. */
export function useCategoriesQuery() {
  const client = useApiClient();
  return useQuery<SelectGroup[], ApiError>({
    queryKey: entryKeys.categories(),
    staleTime: ONE_HOUR_MS,
    queryFn: async ({ signal }) => {
      let result;
      try {
        result = await client.GET('/categories', { signal });
      } catch {
        throw new ApiError(undefined, undefined);
      }
      if (!result.data) {
        throw new ApiError(result.response.status, 'type' in result.error ? result.error : undefined);
      }
      return toSelectGroups(result.data);
    },
  });
}
