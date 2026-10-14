import { useQuery } from '@tanstack/react-query';
import { ApiError, useApiClient, type ApiClient, type components } from '../../../lib/api';
import { clientKeys } from './clientKeys';

type Client = components['schemas']['Client'];

const PAGE_SIZE = 200;
// A user cannot realistically save this many; the cap only stops a misbehaving server looping the client.
const MAX_PAGES = 25;

async function fetchAllClients(client: ApiClient, signal: AbortSignal): Promise<Client[]> {
  const clients: Client[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let result;
    try {
      result = await client.GET('/clients', { params: { query: { page, page_size: PAGE_SIZE } }, signal });
    } catch {
      throw new ApiError(undefined, undefined);
    }
    if (!result.data) {
      throw new ApiError(result.response.status, 'type' in result.error ? result.error : undefined);
    }
    clients.push(...result.data.items);
    if (clients.length >= result.data.page.total_items || result.data.items.length === 0) break;
  }
  return clients;
}

/** The caller's saved clients, every page, in the order the API returns them (by name, ignoring case). */
export function useClientsQuery() {
  const client = useApiClient();
  return useQuery<Client[], ApiError>({
    queryKey: clientKeys.list(),
    queryFn: ({ signal }) => fetchAllClients(client, signal),
  });
}
