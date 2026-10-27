import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, retryWhileInProgress, useApiClient, type components } from '../../../lib/api';
import { clientKeys } from './clientKeys';

type Client = components['schemas']['Client'];
type ClientProblem = components['schemas']['ClientConflictProblem'];

const NAME_TAKEN = 'urn:therapy-service-hours:problem:client-name-taken';

/** `existing` means the server already had a client with that name (ignoring case) and returned it. */
export type CreateClientResult = { kind: 'created'; client: Client } | { kind: 'existing'; client: Client };

export interface CreateClientInput {
  name: string;
  /** One key per user action, reused when the same action is retried (FE-34). */
  idempotencyKey: string;
}

/** Saves a client. A name-taken conflict is a normal outcome for the picker, not an error (FR-LOG-06). */
export function useCreateClient() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<CreateClientResult, ApiError, CreateClientInput>({
    mutationFn: async ({ name, idempotencyKey }) => {
      let result;
      try {
        // The same key and name go out again while the server still runs the first request (FE-34).
        result = await retryWhileInProgress(() =>
          client.POST('/clients', {
            body: { name },
            params: { header: { 'Idempotency-Key': idempotencyKey } },
          }),
        );
      } catch {
        throw new ApiError(undefined, undefined);
      }
      if (result.data) return { kind: 'created', client: result.data };
      const problem: ClientProblem | undefined = 'type' in result.error ? result.error : undefined;
      if (problem?.type === NAME_TAKEN && problem.existing_client) {
        return { kind: 'existing', client: problem.existing_client };
      }
      throw new ApiError(result.response.status, problem);
    },
    onSuccess: ({ client: saved }) => {
      // Show the client at once, then let the refetch confirm the server's list.
      queryClient.setQueryData<Client[]>(clientKeys.list(), (current) =>
        current === undefined || current.some((existing) => existing.id === saved.id)
          ? current
          : [...current, saved].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
      );
      return queryClient.invalidateQueries({ queryKey: clientKeys.list() });
    },
  });
}
