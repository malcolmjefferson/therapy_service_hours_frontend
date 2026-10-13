import { http, HttpResponse, type HttpHandler } from 'msw';
import type { components } from '../lib/api';

type Health = components['schemas']['HealthResponse'];
type Problem = components['schemas']['Problem'];
type Me = components['schemas']['MeResponse'];

/** Absolute base URL the tests' API client uses (jsdom's origin plus the API base path). */
export const API = 'http://localhost:3000/api/v1';

/**
 * Default handlers, one per spec path, typed from the generated schema (FE-24, FE-66).
 * Keyed by the spec path so the coverage test can compare them with api/openapi.yaml.
 */
export const defaultHandlers: Record<string, HttpHandler> = {
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
};

/** Spec paths that intentionally have no default handler, each with a reason. */
export const handlerExemptions: Record<string, string> = {
  // Pinned with backend S2-03. Each gets a typed handler in the story whose code first calls it.
  '/categories':
    'No frontend code calls it yet; the category query lands with the entry form wiring (S2-11 follow-up).',
  '/clients': 'No frontend code calls it yet; the client picker (S2-12) adds the handler.',
  '/clients/{clientId}': 'No frontend code calls it yet; the client picker (S2-12) adds the handler.',
  '/entries':
    'No frontend code calls it yet; the entry form wiring (S2-11 follow-up) and the table (S2-13) add the handler.',
  '/entries/{entryId}': 'No frontend code calls it yet; edit and delete (S2-15) add the handler.',
};

/** A problem+json response, typed against the spec's Problem schema. */
export function problemResponse(problem: Problem) {
  return HttpResponse.json(problem, {
    status: problem.status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}
