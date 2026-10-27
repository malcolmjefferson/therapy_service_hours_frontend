import { ApiError } from './client';

/** `type` of the 409 the API sends while a request with the same Idempotency-Key is still running. */
export const IDEMPOTENCY_IN_PROGRESS = 'urn:therapy-service-hours:problem:idempotency-key-in-progress';

/** How many times the same request is sent again after an in-progress answer, before the person is told. */
export const IN_PROGRESS_RETRIES = 3;

const DEFAULT_DELAY_MS = 1000;
const MAX_DELAY_MS = 5000;

/** The part of an openapi-fetch result this module reads. */
interface Sent {
  response: Response;
  error?: unknown;
}

/** Whether a failed response is the in-progress 409. Any other 409 is not a reason to send the request again. */
export function isInProgress({ response, error }: Sent): boolean {
  return (
    response.status === 409 &&
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === IDEMPOTENCY_IN_PROGRESS
  );
}

/** Whether a failure the hook threw is the in-progress 409, once the retries ran out. */
export function isInProgressError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.problem?.type === IDEMPOTENCY_IN_PROGRESS;
}

/** The wait the server asked for in `Retry-After` (seconds), kept within sane bounds; one second if absent. */
export function retryDelayMs(response: Response): number {
  const header = response.headers.get('Retry-After');
  const seconds = header === null || header.trim() === '' ? Number.NaN : Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_DELAY_MS;
  return Math.min(seconds * 1000, MAX_DELAY_MS);
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Sends a keyed create and, while the server says the first request with that key is still running,
 * sends it again after `Retry-After`. `send` must reuse the same Idempotency-Key and body, so the server
 * replays the first result instead of creating twice (FE-34). Gives up after `IN_PROGRESS_RETRIES` and
 * returns the last in-progress answer for the caller to report. Everything else is returned at once.
 */
export async function retryWhileInProgress<T extends Sent>(send: () => Promise<T>, sleep = wait): Promise<T> {
  let result = await send();
  for (let retry = 0; retry < IN_PROGRESS_RETRIES && isInProgress(result); retry += 1) {
    await sleep(retryDelayMs(result.response));
    result = await send();
  }
  return result;
}
