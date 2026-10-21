import { http, HttpResponse, type HttpHandler } from 'msw';
import type { components } from '../lib/api';

type Health = components['schemas']['HealthResponse'];
type Problem = components['schemas']['ClientConflictProblem'];
type Me = components['schemas']['MeResponse'];
type Client = components['schemas']['Client'];
type ClientList = components['schemas']['ClientListResponse'];
type ClientRequest = components['schemas']['ClientRequest'];
type Entry = components['schemas']['Entry'];
type EntryList = components['schemas']['EntryListResponse'];

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
  // GET only; the create handler comes with the entry form wiring (S2-11 follow-up).
  '/entries': http.get<never, never, EntryList>(`${API}/entries`, () =>
    HttpResponse.json({
      items: [...sampleEntries],
      page: { page: 1, page_size: 50, total_items: sampleEntries.length },
    }),
  ),
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
  '/categories':
    'No frontend code calls it yet; the category query lands with the entry form wiring (S2-11 follow-up).',
  '/clients/{clientId}': 'No frontend code calls it yet; the client picker (S2-12) only lists and creates clients.',
  '/entries/{entryId}': 'No frontend code calls it yet; edit and delete (S2-15) add the handler.',
};

/** A problem+json response, typed against the spec's Problem schema. */
export function problemResponse(problem: Problem) {
  return HttpResponse.json(problem, {
    status: problem.status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}
