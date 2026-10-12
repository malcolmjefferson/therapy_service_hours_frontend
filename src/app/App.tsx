import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import type { ApiClient } from '../lib/api';
import { AppProviders } from './AppProviders';
import { routes } from './routes';
import type { AuthSession } from '../lib/auth/session';

/** The application root: services plus the router. */
export function App({ apiClient, session }: { apiClient: ApiClient; session?: AuthSession | undefined }) {
  const [router] = useState(() => createBrowserRouter(routes));
  return (
    <AppProviders apiClient={apiClient} session={session}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
