import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, retryWhileInProgress, useApiClient, type components } from '../../../lib/api';
import { entryConflict, entryProblem, type EntryConflict } from './entryOutcome';
import { entryKeys } from './entryKeys';

type Entry = components['schemas']['Entry'];
type EntryRequest = components['schemas']['EntryRequest'];

export type SaveEntryOutcome = { kind: 'saved'; entry: Entry } | EntryConflict;

export interface CreateEntryInput {
  body: EntryRequest;
  /** One key per user action, reused when the same action is retried (FE-34). */
  idempotencyKey: string;
}

export interface UpdateEntryInput {
  id: string;
  body: EntryRequest;
}

/** Logs a new entry. An overlap or lock is an outcome the form explains, not an error (FR-LOG-04). */
export function useCreateEntry() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<SaveEntryOutcome, ApiError, CreateEntryInput>({
    mutationFn: async ({ body, idempotencyKey }) => {
      let result;
      try {
        // The same key and body go out again while the server still runs the first request (FE-34).
        result = await retryWhileInProgress(() =>
          client.POST('/entries', { body, params: { header: { 'Idempotency-Key': idempotencyKey } } }),
        );
      } catch {
        throw new ApiError(undefined, undefined);
      }
      if (result.data) return { kind: 'saved', entry: result.data };
      const problem = entryProblem(result.error);
      const conflict = result.response.status === 409 ? entryConflict(problem) : undefined;
      if (conflict) return conflict;
      throw new ApiError(result.response.status, problem);
    },
    // Waiting for the refetch means the table already shows the new entry when the form reports success.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entryKeys.lists() }),
  });
}

/** Replaces the editable fields of one pending or rejected entry (FR-LOG-05). */
export function useUpdateEntry() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<SaveEntryOutcome, ApiError, UpdateEntryInput>({
    mutationFn: async ({ id, body }) => {
      let result;
      try {
        result = await client.PUT('/entries/{entryId}', { body, params: { path: { entryId: id } } });
      } catch {
        throw new ApiError(undefined, undefined);
      }
      if (result.data) return { kind: 'saved', entry: result.data };
      const problem = entryProblem(result.error);
      const conflict = result.response.status === 409 ? entryConflict(problem) : undefined;
      if (conflict) return conflict;
      throw new ApiError(result.response.status, problem);
    },
    // An overlap changes nothing; a lock means the list on screen is stale, so it refreshes too.
    onSuccess: ({ kind }) =>
      kind === 'overlap' ? undefined : queryClient.invalidateQueries({ queryKey: entryKeys.lists() }),
  });
}
