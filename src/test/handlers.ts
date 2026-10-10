import { http, HttpResponse, type HttpHandler } from 'msw';
import type { components } from '../lib/api';

type Health = components['schemas']['HealthResponse'];
type Problem = components['schemas']['Problem'];

/** Absolute base URL the tests' API client uses (jsdom's origin plus the API base path). */
export const API = 'http://localhost:3000/api/v1';

/**
 * Default handlers, one per spec path, typed from the generated schema (FE-24, FE-66).
 * Keyed by the spec path so the coverage test can compare them with api/openapi.yaml.
 */
export const defaultHandlers: Record<string, HttpHandler> = {
  '/healthz': http.get<never, never, Health>(`${API}/healthz`, () =>
    HttpResponse.json({ status: 'ok', version: 'test-build-1' }),
  ),
};

/** Spec paths that intentionally have no default handler, each with a reason. */
export const handlerExemptions: Record<string, string> = {};

/** A problem+json response, typed against the spec's Problem schema. */
export function problemResponse(problem: Problem) {
  return HttpResponse.json(problem, {
    status: problem.status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}
