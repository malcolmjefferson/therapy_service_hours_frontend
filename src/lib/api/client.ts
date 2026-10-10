import createClient from 'openapi-fetch';
import type { components, paths } from './schema';

/** Typed client for the backend API, generated from the pinned spec (ADR-0006). */
export type ApiClient = ReturnType<typeof createClient<paths>>;

/** RFC 7807 problem body, as defined in the spec. */
export type Problem = components['schemas']['Problem'];

/** The API's base path. The SPA only ever calls its own origin (FE-62, ADR-0004). */
export const API_BASE_PATH = '/api/v1';

/**
 * Creates the API client for `origin`, which is always the page's own origin in the app.
 * openapi-fetch needs an absolute base URL to build requests, so the origin is passed in.
 */
export function createApiClient(origin: string, fetchImpl?: typeof fetch): ApiClient {
  const options: Parameters<typeof createClient<paths>>[0] = { baseUrl: new URL(API_BASE_PATH, origin).toString() };
  if (fetchImpl) {
    options.fetch = fetchImpl;
  }
  return createClient<paths>(options);
}

/** An API call that failed with a problem response, or could not reach the server at all. */
export class ApiError extends Error {
  readonly status: number | undefined;
  readonly problem: Problem | undefined;

  constructor(status: number | undefined, problem: Problem | undefined) {
    super(problem?.title ?? (status === undefined ? 'Network error' : `HTTP ${String(status)}`));
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }

  /** The server's request ID, which users can quote when reporting a problem. */
  get requestId(): string | undefined {
    return this.problem?.request_id;
  }
}
