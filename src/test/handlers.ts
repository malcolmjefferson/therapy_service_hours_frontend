import { http, HttpResponse, type HttpHandler } from 'msw';
import type { components } from '../lib/api';

type Health = components['schemas']['HealthResponse'];
type Problem = components['schemas']['ClientConflictProblem'] | components['schemas']['EntryConflictProblem'];
type Me = components['schemas']['MeResponse'];
type Client = components['schemas']['Client'];
type ClientList = components['schemas']['ClientListResponse'];
type ClientRequest = components['schemas']['ClientRequest'];
type Entry = components['schemas']['Entry'];
type EntryList = components['schemas']['EntryListResponse'];
type EntryRequest = components['schemas']['EntryRequest'];
type CategoryList = components['schemas']['CategoryListResponse'];

/** Absolute base URL the tests' API client uses (jsdom's origin plus the API base path). */
export const API = 'http://localhost:3000/api/v1';

/** Saved clients the default `GET /clients` returns (fictional initials, FE-70). */
export const sampleClients: readonly Client[] = [
  { id: '00000000-0000-4000-8000-0000000000a1', name: 'A.B.' },
  { id: '00000000-0000-4000-8000-0000000000a2', name: 'C.D.' },
  { id: '00000000-0000-4000-8000-0000000000a3', name: 'Group Alpha' },
];

/** Saved entries the default `GET /entries` returns, newest first (fictional pseudonyms, FE-70). */
export const sampleEntries: readonly Entry[] = [
  {
    id: '00000000-0000-4000-8000-0000000000e1',
    session_date: '2026-01-12',
    start_time: '13:00',
    end_time: '14:15',
    duration_minutes: 75,
    hours: 1.25,
    category: { id: '00000000-0000-4000-8000-0000000000c1', name: 'Individual Counseling', group: 'direct' },
    clients: [
      { id: sampleClients[0]?.id ?? '', name: 'A.B.' },
      { id: sampleClients[1]?.id ?? '', name: 'C.D.' },
    ],
    on_site: true,
    notes: 'Follow-up on coping plan.',
    status: 'pending',
    needs_time: false,
    created_at: '2026-01-12T20:00:00Z',
    updated_at: '2026-01-12T20:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-0000000000e2',
    session_date: '2026-01-05',
    start_time: '09:00',
    end_time: '10:00',
    duration_minutes: 60,
    hours: 1,
    category: { id: '00000000-0000-4000-8000-0000000000c2', name: 'Staff Meetings', group: 'indirect' },
    clients: [],
    on_site: false,
    status: 'pending',
    needs_time: false,
    created_at: '2026-01-05T17:00:00Z',
    updated_at: '2026-01-05T17:00:00Z',
  },
];

/** The category list the default `GET /categories` returns, grouped as the API does. */
export const sampleCategories: CategoryList = {
  groups: [
    {
      group: 'direct',
      label: 'Direct Service',
      categories: [
        { id: '00000000-0000-4000-8000-0000000000c1', name: 'Individual Counseling' },
        { id: '00000000-0000-4000-8000-0000000000c3', name: 'Group Counseling' },
      ],
    },
    {
      group: 'indirect',
      label: 'Indirect Service',
      categories: [{ id: '00000000-0000-4000-8000-0000000000c2', name: 'Staff Meetings' }],
    },
    {
      group: 'supervision',
      label: 'Supervision',
      categories: [{ id: '00000000-0000-4000-8000-0000000000c4', name: 'Individual Supervision' }],
    },
  ],
};

/** An entry the API would return for `request`, in the category and clients the sample data knows. */
export function entryFromRequest(request: EntryRequest, id = '00000000-0000-4000-8000-0000000000e9'): Entry {
  const categories = sampleCategories.groups.flatMap((group) =>
    group.categories.map((category) => ({ ...category, group: group.group })),
  );
  const category = categories.find((candidate) => candidate.id === request.category_id) ?? categories[0];
  if (!category) throw new Error('sampleCategories is empty');
  const [startH = 0, startM = 0] = request.start_time.split(':').map(Number);
  const [endH = 0, endM = 0] = request.end_time.split(':').map(Number);
  const minutes = endH * 60 + endM - (startH * 60 + startM);
  return {
    id,
    session_date: request.session_date,
    start_time: request.start_time,
    end_time: request.end_time,
    duration_minutes: minutes,
    hours: Math.round((minutes / 60) * 100) / 100,
    category,
    clients: sampleClients.filter((client) => request.client_ids?.includes(client.id)),
    on_site: request.on_site,
    ...(request.notes ? { notes: request.notes } : {}),
    status: 'pending',
    needs_time: false,
    created_at: '2026-01-12T20:00:00Z',
    updated_at: '2026-01-12T20:00:00Z',
  };
}

/**
 * Default handlers, one entry per spec path (an array when the path has several methods), typed from
 * the generated schema (FE-24, FE-66). Keyed by the spec path so the coverage test can compare them
 * with api/openapi.yaml.
 */
export const defaultHandlers: Record<string, HttpHandler | readonly HttpHandler[]> = {
  '/me': http.get<never, never, Me>(`${API}/me`, () =>
    HttpResponse.json({
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Pseudonym A',
      email: 'pseudonym-a@example.test',
      roles: ['admin'],
      organization: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Default Organization',
      },
    }),
  ),
  '/healthz': http.get<never, never, Health>(`${API}/healthz`, () =>
    HttpResponse.json({ status: 'ok', version: 'test-build-1' }),
  ),
  '/categories': http.get<never, never, CategoryList>(`${API}/categories`, () => HttpResponse.json(sampleCategories)),
  '/entries': [
    http.get<never, never, EntryList>(`${API}/entries`, () =>
      HttpResponse.json({
        items: [...sampleEntries],
        page: { page: 1, page_size: 50, total_items: sampleEntries.length },
      }),
    ),
    http.post<never, EntryRequest, Entry>(`${API}/entries`, async ({ request }) =>
      HttpResponse.json(entryFromRequest(await request.json()), { status: 201 }),
    ),
  ],
  // `GET /entries/{entryId}` has no frontend caller: the table lists whole entries.
  '/entries/{entryId}': [
    http.put<{ entryId: string }, EntryRequest, Entry>(`${API}/entries/:entryId`, async ({ params, request }) =>
      HttpResponse.json(entryFromRequest(await request.json(), params.entryId)),
    ),
    http.delete(`${API}/entries/:entryId`, () => new HttpResponse(null, { status: 204 })),
  ],
  '/clients': [
    http.get<never, never, ClientList>(`${API}/clients`, () =>
      HttpResponse.json({
        items: [...sampleClients],
        page: { page: 1, page_size: 200, total_items: sampleClients.length },
      }),
    ),
    http.post<never, ClientRequest, Client>(`${API}/clients`, async ({ request }) => {
      const { name } = await request.json();
      return HttpResponse.json({ id: '00000000-0000-4000-8000-0000000000b1', name }, { status: 201 });
    }),
  ],
};

/** Spec paths that intentionally have no default handler, each with a reason. */
export const handlerExemptions: Record<string, string> = {
  // Pinned with backend S2-03. Each gets a typed handler in the story whose code first calls it.
  '/clients/{clientId}': 'No frontend code calls it yet; the client picker (S2-12) only lists and creates clients.',
  // Pinned with backend S4-01. Each gets a typed handler in the story whose code first calls it.
  '/import/markdown': 'No frontend code calls it yet; the import dialog (S4-10) is the first caller.',
  '/export/entries': 'No frontend code calls it yet; the exporters (S4-07 to S4-09) are the first callers.',
};

/** A problem+json response, typed against the spec's Problem schema. */
export function problemResponse(problem: Problem) {
  return HttpResponse.json(problem, {
    status: problem.status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}
