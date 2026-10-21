import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { components } from '../../../lib/api';
import { API, sampleEntries } from '../../../test/handlers';
import { renderWithProviders } from '../../../test/render';
import { server } from '../../../test/server';
import { EntriesPanel } from './EntriesPanel';

type Entry = components['schemas']['Entry'];

/** Renders the entries panel on `/app/entries`, as the route does, at the given URL. */
export function renderPanel(path = '/app/entries') {
  const router = createMemoryRouter([{ path: '/app/entries', element: <EntriesPanel /> }], { initialEntries: [path] });
  renderWithProviders(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}

/** Serves `total` entries and records the query string of every request. */
export function serveEntries(total: number, items: readonly Entry[] = sampleEntries) {
  const calls: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/entries`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      calls.push(query);
      return HttpResponse.json({
        items: total === 0 ? [] : [...items],
        page: { page: Number(query.get('page') ?? '1'), page_size: 50, total_items: total },
      });
    }),
  );
  return calls;
}

/** A column heading by its accessible name. */
export const heading = (name: string) => screen.getByRole('columnheader', { name });
