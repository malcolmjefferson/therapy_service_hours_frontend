import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders, createQueryClient } from '../app/AppProviders';
import { routes } from '../app/routes';
import { createApiClient } from '../lib/api';

/** Renders the real app routes at `path`, with the real API client talking to MSW. */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <AppProviders apiClient={createApiClient(window.location.origin)} queryClient={createQueryClient({ retry: false })}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}
