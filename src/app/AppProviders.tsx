import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiClientProvider, type ApiClient } from '../lib/api';

/** Builds the app's QueryClient. Tests pass `retry: false` to fail fast. */
export function createQueryClient(options: { retry?: boolean } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: options.retry === false ? false : 2,
        refetchOnWindowFocus: true,
        staleTime: 30_000,
      },
      // Writes are never retried automatically; retries reuse an Idempotency-Key (FE-34, ARC-39).
      mutations: { retry: false },
    },
  });
}

export interface AppProvidersProps {
  apiClient: ApiClient;
  queryClient?: QueryClient;
  children: ReactNode;
}

/** Cross-cutting services for the whole app (FE-23). */
export function AppProviders({ apiClient, queryClient, children }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>
    </QueryClientProvider>
  );
}
