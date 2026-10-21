import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, useApiClient } from '../../../lib/api';
import { entryConflict, entryProblem } from './entryOutcome';
import { entryKeys } from './entryKeys';

/** `gone` means the entry was already deleted elsewhere, which is the state the person wanted. */
export type DeleteEntryOutcome = 'deleted' | 'gone' | 'locked';

/** Deletes one pending or rejected entry (FR-LOG-05). */
export function useDeleteEntry() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<DeleteEntryOutcome, ApiError, string>({
    mutationFn: async (id) => {
      let result;
      try {
        result = await client.DELETE('/entries/{entryId}', { params: { path: { entryId: id } } });
      } catch {
        throw new ApiError(undefined, undefined);
      }
      if (result.response.ok) return 'deleted';
      if (result.response.status === 404) return 'gone';
      const problem = entryProblem(result.error);
      if (result.response.status === 409 && entryConflict(problem)?.kind === 'locked') return 'locked';
      throw new ApiError(result.response.status, problem);
    },
    // Locked and gone entries mean the list on screen is stale, so every outcome but an error refreshes it.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entryKeys.lists() }),
  });
}
