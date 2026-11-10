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
type ImportReport = components['schemas']['ImportReport'];
type GoalsProgress = components['schemas']['GoalsProgressResponse'];
type GoalTarget = components['schemas']['GoalTarget'];
type GoalTargetRequest = components['schemas']['GoalTargetRequest'];

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

/** The four goals the default `GET /goals/progress` returns (fictional data, FE-70). */
export const sampleGoals: GoalsProgress = {
  goals: [
    {
      goal_type: 'direct',
      target_hours: 1200,
      approved_hours: 312.5,
      pending_hours: 20,
      approved_percent: 26,
      pending_percent: 1,
      last_celebrated_percent: 25,
    },
    {
      goal_type: 'supervision',
      target_hours: 100,
      approved_hours: 40,
      pending_hours: 3.5,
      approved_percent: 40,
      pending_percent: 3,
      last_celebrated_percent: 25,
      supervision_split: {
        group: { approved_hours: 15, pending_hours: 1.5 },
        individual: { approved_hours: 25, pending_hours: 2 },
      },
    },
    {
      goal_type: 'total_activity',
      target_hours: 3000,
      approved_hours: 900,
      pending_hours: 60,
      approved_percent: 30,
      pending_percent: 2,
      last_celebrated_percent: 25,
    },
    {
      goal_type: 'on_site',
      target_hours: null,
      approved_hours: 210,
      pending_hours: 12.25,
      approved_percent: null,
      pending_percent: null,
      last_celebrated_percent: 0,
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
  // The whole ledger oldest first, `page_size` at a time, as the export endpoint serves it.
  '/export/entries': http.get<never, never, EntryList>(`${API}/export/entries`, ({ request }) => {
    const query = new URL(request.url).searchParams;
    const page = Number(query.get('page') ?? '1');
    const pageSize = Number(query.get('page_size') ?? '50');
    const oldestFirst = [...sampleEntries].reverse();
    return HttpResponse.json({
      items: oldestFirst.slice((page - 1) * pageSize, page * pageSize),
      page: { page, page_size: pageSize, total_items: oldestFirst.length },
    });
  }),
  // A report for a file with one imported row and one duplicate; tests that need another report override it.
  '/import/markdown': http.post<never, never, ImportReport>(`${API}/import/markdown`, () =>
    HttpResponse.json({
      total_rows: 2,
      imported_count: 1,
      needs_time_count: 0,
      merged_clients: [],
      skipped_count: 1,
      skipped_rows: [{ row: 2, reason: 'duplicate', message: 'Same date, category, hours, notes and clients.' }],
    }),
  ),
  '/goals/progress': http.get<never, never, GoalsProgress>(`${API}/goals/progress`, () =>
    HttpResponse.json(sampleGoals),
  ),
  '/goals/{goalType}': http.put<{ goalType: GoalTarget['goal_type'] }, GoalTargetRequest, GoalTarget>(
    `${API}/goals/:goalType`,
    async ({ params, request }) =>
      HttpResponse.json({ goal_type: params.goalType, target_hours: (await request.json()).target_hours }),
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
  '/clients/{clientId}': 'No frontend code calls it yet; the client picker (S2-12) only lists and creates clients.',
  // Pinned with backend S3-03 along with the supervision, notification and admin contracts that
  // landed before it. Each gets a typed handler in the story whose code first calls it.
  '/supervisors': 'Supervisor search (S6) is not built in the frontend yet.',
  '/supervision-links': 'Supervision requests (S6) are not built in the frontend yet.',
  '/supervision-links/{linkId}/cancel': 'Supervision requests (S6) are not built in the frontend yet.',
  '/supervision-links/{linkId}/accept': 'The supervisor inbox (S6) is not built in the frontend yet.',
  '/supervision-links/{linkId}/decline': 'The supervisor inbox (S6) is not built in the frontend yet.',
  '/supervision-links/{linkId}/end': 'Ending a supervision link (S6) is not built in the frontend yet.',
  '/notifications': 'Notifications (S6) are not built in the frontend yet.',
  '/notifications/unread-count': 'Notifications (S6) are not built in the frontend yet.',
  '/notifications/read-all': 'Notifications (S6) are not built in the frontend yet.',
  '/notifications/{notificationId}/read': 'Notifications (S6) are not built in the frontend yet.',
  '/admin/organizations': 'The admin console (S5) is not built in the frontend yet.',
  '/admin/organizations/{organizationId}': 'The admin console (S5) is not built in the frontend yet.',
  '/admin/users': 'The admin console (S5) is not built in the frontend yet.',
  '/admin/users/{userId}': 'The admin console (S5) is not built in the frontend yet.',
  '/admin/users/{userId}/roles': 'The admin console (S5) is not built in the frontend yet.',
  '/admin/users/{userId}/email': 'The admin console (S5) is not built in the frontend yet.',
  '/admin/users/{userId}/organization': 'The admin console (S5) is not built in the frontend yet.',
  '/admin/users/{userId}/organization-change-preview': 'The admin console (S5) is not built in the frontend yet.',
  '/admin/users/{userId}/deactivate': 'The admin console (S5) is not built in the frontend yet.',
  '/admin/users/{userId}/reactivate': 'The admin console (S5) is not built in the frontend yet.',
  '/admin/audit': 'The admin console (S5) is not built in the frontend yet.',
};

/** A problem+json response, typed against the spec's Problem schema. */
export function problemResponse(problem: Problem) {
  return HttpResponse.json(problem, {
    status: problem.status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}
