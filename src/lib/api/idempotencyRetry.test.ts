import { describe, expect, test, vi } from 'vitest';
import { ApiError } from './client';
import {
  IDEMPOTENCY_IN_PROGRESS,
  IN_PROGRESS_RETRIES,
  isInProgress,
  isInProgressError,
  retryDelayMs,
  retryWhileInProgress,
} from './idempotencyRetry';

const inProgress = (retryAfter?: string) => ({
  response: new Response(null, { status: 409, headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter } }),
  error: { type: IDEMPOTENCY_IN_PROGRESS, title: 'Request still in progress', status: 409 },
});
const created = { response: new Response(null, { status: 201 }), data: { id: 'x' } };

describe('isInProgress', () => {
  test('is true only for the in-progress 409', () => {
    expect(isInProgress(inProgress())).toBe(true);
    expect(
      isInProgress({
        response: new Response(null, { status: 409 }),
        error: { type: 'urn:therapy-service-hours:problem:idempotency-key-reused' },
      }),
    ).toBe(false);
    expect(isInProgress({ response: new Response(null, { status: 409 }), error: undefined })).toBe(false);
    expect(isInProgress(created)).toBe(false);
  });
});

describe('isInProgressError', () => {
  test('recognises the ApiError built from the in-progress 409', () => {
    expect(isInProgressError(new ApiError(409, inProgress().error))).toBe(true);
    expect(isInProgressError(new ApiError(500, inProgress().error))).toBe(false);
    expect(isInProgressError(new ApiError(409, undefined))).toBe(false);
    expect(isInProgressError(new Error('x'))).toBe(false);
  });
});

describe('retryDelayMs', () => {
  test.each([
    ['1', 1000],
    ['0', 0],
    ['2', 2000],
    ['600', 5000],
    ['soon', 1000],
    ['-3', 1000],
    ['', 1000],
  ])('Retry-After %j waits %i ms', (header, expected) => {
    expect(retryDelayMs(inProgress(header).response)).toBe(expected);
  });

  test('waits one second when the header is missing', () => {
    expect(retryDelayMs(inProgress().response)).toBe(1000);
  });
});

describe('retryWhileInProgress', () => {
  test('returns a first answer that is not in progress without waiting', async () => {
    const send = vi.fn(() => Promise.resolve(created));
    const sleep = vi.fn(() => Promise.resolve());
    expect(await retryWhileInProgress(send, sleep)).toBe(created);
    expect(send).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test('waits for Retry-After and sends again until the first request finishes', async () => {
    const send = vi
      .fn<() => Promise<typeof created | ReturnType<typeof inProgress>>>()
      .mockResolvedValueOnce(inProgress('2'))
      .mockResolvedValueOnce(inProgress('1'))
      .mockResolvedValueOnce(created);
    const sleep = vi.fn(() => Promise.resolve());
    expect(await retryWhileInProgress(send, sleep)).toBe(created);
    expect(send).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[2000], [1000]]);
  });

  test('gives up after the allowed retries and returns the last in-progress answer', async () => {
    const send = vi.fn(() => Promise.resolve(inProgress('1')));
    const sleep = vi.fn(() => Promise.resolve());
    const result = await retryWhileInProgress(send, sleep);
    expect(isInProgress(result)).toBe(true);
    expect(send).toHaveBeenCalledTimes(IN_PROGRESS_RETRIES + 1);
    expect(sleep).toHaveBeenCalledTimes(IN_PROGRESS_RETRIES);
  });

  test('does not send again after another conflict or a server error', async () => {
    const reused = {
      response: new Response(null, { status: 409 }),
      error: { type: 'urn:therapy-service-hours:problem:idempotency-key-reused' },
    };
    const send = vi.fn(() => Promise.resolve(reused));
    expect(await retryWhileInProgress(send, vi.fn())).toBe(reused);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
