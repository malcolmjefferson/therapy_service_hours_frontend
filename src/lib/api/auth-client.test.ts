import { expect, test, vi } from 'vitest';
import { createApiClient } from './client';

test('sends only memory ID token and handles Gateway JSON 401 without a Problem', async () => {
  const invalidate = vi.fn();
  const getIdToken = vi.fn<() => Promise<string | undefined>>().mockResolvedValue('fictional-id-token');
  const request = vi.fn<typeof fetch>().mockImplementation((input) => {
    expect(input).toBeInstanceOf(Request);
    if (input instanceof Request) expect(input.headers.get('Authorization')).toBe('Bearer fictional-id-token');
    return Promise.resolve(Response.json({ message: 'Unauthorized' }, { status: 401 }));
  });
  await createApiClient(window.location.origin, request, { getIdToken, invalidate }).GET('/me');
  expect(invalidate).toHaveBeenCalledOnce();
});

test('health never requests or sends an identity token', async () => {
  const getIdToken = vi.fn<() => Promise<string | undefined>>();
  const request = vi.fn<typeof fetch>().mockImplementation((input) => {
    if (input instanceof Request) expect(input.headers.has('Authorization')).toBe(false);
    return Promise.resolve(Response.json({ status: 'ok', version: 'test' }));
  });
  await createApiClient(window.location.origin, request, { getIdToken, invalidate: vi.fn() }).GET('/healthz');
  expect(getIdToken).not.toHaveBeenCalled();
});
