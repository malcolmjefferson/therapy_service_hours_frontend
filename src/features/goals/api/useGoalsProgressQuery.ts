import { useQuery } from '@tanstack/react-query';
import { ApiError, useApiClient, type components } from '../../../lib/api';
import { goalKeys } from './goalKeys';

export type GoalsProgress = components['schemas']['GoalsProgressResponse'];

/** The caller's four goals with approved and pending hours (FR-GOAL-01). */
export function useGoalsProgressQuery() {
  const client = useApiClient();
  return useQuery<GoalsProgress, ApiError>({
    queryKey: goalKeys.progress(),
    queryFn: async ({ signal }) => {
      let result;
      try {
        result = await client.GET('/goals/progress', { signal });
      } catch {
        throw new ApiError(undefined, undefined);
      }
      if (!result.data) {
        throw new ApiError(result.response.status, 'type' in result.error ? result.error : undefined);
      }
      return result.data;
    },
  });
}
