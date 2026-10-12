import { useQuery } from '@tanstack/react-query';
import { ApiError, useApiClient, type components } from '../../../lib/api';

export type Profile = components['schemas']['MeResponse'];
export function useProfileQuery() {
  const client = useApiClient();
  return useQuery<Profile, ApiError>({
    queryKey: ['identity', 'me'],
    retry: false,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      let result;
      try {
        result = await client.GET('/me', { signal });
      } catch {
        throw new ApiError(undefined, undefined);
      }
      if (result.data) return result.data;
      const problem = 'type' in result.error ? result.error : undefined;
      throw new ApiError(result.response.status, problem);
    },
  });
}
