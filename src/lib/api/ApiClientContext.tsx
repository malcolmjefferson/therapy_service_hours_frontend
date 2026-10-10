import { createContext, useContext, type ReactNode } from 'react';
import type { ApiClient } from './client';

const ApiClientContext = createContext<ApiClient | null>(null);

/** Provides the API client to feature hooks (FE-23). Tests provide their own instance. */
export function ApiClientProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

/** Returns the API client. Only `features/*\/api` hooks call this (FE-03). */
export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (client === null) {
    throw new Error('useApiClient must be used inside <ApiClientProvider>.');
  }
  return client;
}
