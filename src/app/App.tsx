import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import type { ApiClient } from '../lib/api';
import { AppProviders } from './AppProviders';
import { routes } from './routes';

/** The application root: services plus the router. */
export function App({ apiClient }: { apiClient: ApiClient }) {
  const [router] = useState(() => createBrowserRouter(routes));
  return (
    <AppProviders apiClient={apiClient}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
