import { useQuery } from '@tanstack/react-query';
import { ApiError, useApiClient, type components } from '../../../lib/api';

export type Health = components['schemas']['HealthResponse'];

/** Query keys for the status feature (FE-32). */
export const statusKeys = {
  all: ['status'] as const,
  health: () => [...statusKeys.all, 'health'] as const,
};

/** Reads GET /api/v1/healthz. Failures surface as ApiError with the server's problem, if any. */
export function useHealthQuery() {
  const client = useApiClient();
  return useQuery<Health, ApiError>({
    queryKey: statusKeys.health(),
    queryFn: async ({ signal }) => {
      let result;
      try {
        result = await client.GET('/healthz', { signal });
      } catch {
        throw new ApiError(undefined, undefined);
      }
      if (result.data) {
        return result.data;
      }
      throw new ApiError(result.response.status, result.error);
    },
  });
}
