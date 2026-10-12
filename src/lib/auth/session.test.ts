import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthSession, TRANSACTION_KEY, type SessionDependencies } from './session';
import { parseAuthConfig, type AuthConfig } from './config';

const config = {
  enabled: true,
  hostedUiOrigin: 'https://test.auth.us-west-2.amazoncognito.com',
  clientId: 'client123',
  issuer: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_Test',
  callbackUrl: 'http://localhost:3000/auth/callback',
  logoutUrl: 'http://localhost:3000/',
} satisfies AuthConfig;
let now = 1800000000000;
let request: ReturnType<typeof vi.fn<typeof fetch>>;
let deps: SessionDependencies;

function token(nonce: string | undefined, overrides: Record<string, unknown> = {}): Response {
  const claims = {
    iss: config.issuer,
    aud: config.clientId,
    token_use: 'id',
    exp: Math.floor(now / 1000) + 3600,
    ...(nonce ? { nonce } : {}),
    ...overrides,
  };
  const id = `${btoa(JSON.stringify({ alg: 'RS256' }))}.${btoa(JSON.stringify(claims))}.signature`;
  return Response.json({
    id_token: id,
    refresh_token: 'private-refresh-token',
    token_type: 'Bearer',
    expires_in: 3600,
  });
}
async function ready(session: AuthSession): Promise<void> {
  await session.signIn();
  const transaction = JSON.parse(sessionStorage.getItem(TRANSACTION_KEY) ?? '{}') as { state: string; nonce: string };
  request.mockResolvedValueOnce(token(transaction.nonce));
  await session.complete(`${config.callbackUrl}?code=private-code&state=${transaction.state}`);
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  now = 1800000000000;
  request = vi.fn<typeof fetch>();
  deps = {
    crypto: webcrypto as Crypto,
    storage: sessionStorage,
    fetch: request,
    now: () => now,
    navigate: vi.fn(),
    cleanCallback: vi.fn(),
  };
});

describe('PKCE session', () => {
  test('uses S256, random state/nonce, Google and only transient transaction storage', async () => {
    const session = new AuthSession(config, deps);
    await session.signIn();
    const txn = JSON.parse(sessionStorage.getItem(TRANSACTION_KEY) ?? '{}') as {
      verifier: string;
      state: string;
      nonce: string;
    };
    expect(txn.verifier).toHaveLength(43);
    expect(txn.state).not.toBe(txn.nonce);
    const url = new URL(vi.mocked(deps.navigate).mock.calls[0]?.[0] ?? '');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const hash = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(txn.verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    expect(url.searchParams.get('code_challenge')).toBe(challenge);
    expect(url.searchParams.get('identity_provider')).toBe('Google');
    expect(sessionStorage.length).toBe(1);
    expect(localStorage.length).toBe(0);
  });

  test('exchanges a code once, strips callback values, consumes state and stores no tokens', async () => {
    const session = new AuthSession(config, deps);
    await ready(session);
    await session.complete(`${config.callbackUrl}?code=replayed&state=invalid`);
    expect(request).toHaveBeenCalledTimes(1);
    expect(deps.cleanCallback).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toBe('signed-in');
    expect(await session.getIdToken()).toContain('.');
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
    const body = request.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toHaveLength(43);
  });

  test.each(['mismatch', 'expired', 'error', 'duplicate', 'missing', 'wrong-origin'])(
    'denies %s callback without token exchange or raw error output',
    async (mode) => {
      const session = new AuthSession(config, deps);
      await session.signIn();
      const txn = JSON.parse(sessionStorage.getItem(TRANSACTION_KEY) ?? '{}') as { state: string };
      if (mode === 'expired') now += 600001;
      const state = mode === 'mismatch' ? 'wrong' : txn.state;
      const extra =
        mode === 'error'
          ? '&error=access_denied&error_description=private-email@example.test'
          : mode === 'duplicate'
            ? '&state=second'
            : '';
      const code = mode === 'missing' ? '' : '&code=private-code';
      const callback = mode === 'wrong-origin' ? 'https://untrusted.example/auth/callback' : config.callbackUrl;
      await session.complete(`${callback}?state=${state}${code}${extra}`);
      expect(session.getSnapshot()).toBe('denied');
      expect(request).not.toHaveBeenCalled();
      expect(sessionStorage.length).toBe(0);
      expect(deps.cleanCallback).toHaveBeenCalled();
    },
  );

  test.each([
    { nonce: 'wrong' },
    { aud: 'wrong' },
    { iss: 'https://untrusted.example' },
    { token_use: 'access' },
    { exp: 0 },
  ])('refuses unexpected token attributes %j', async (claims) => {
    const session = new AuthSession(config, deps);
    await session.signIn();
    const txn = JSON.parse(sessionStorage.getItem(TRANSACTION_KEY) ?? '{}') as { state: string; nonce: string };
    request.mockResolvedValueOnce(token(txn.nonce, claims));
    await session.complete(`${config.callbackUrl}?state=${txn.state}&code=code`);
    expect(session.getSnapshot()).toBe('error');
    expect(await session.getIdToken()).toBeUndefined();
  });

  test('a reload has no tokens and resumes through the classic hosted-UI session cookie', async () => {
    const session = new AuthSession(config, deps);
    await ready(session);
    const reloaded = new AuthSession(config, deps);
    expect(await reloaded.getIdToken()).toBeUndefined();
    await reloaded.signIn(true);
    const last = vi.mocked(deps.navigate).mock.calls.at(-1)?.[0] ?? '';
    const url = new URL(last);
    expect(url.searchParams.has('identity_provider')).toBe(false);
    expect(url.searchParams.has('prompt')).toBe(false);
  });

  test('refreshes concurrently once and routes a failed refresh to sign-in', async () => {
    const session = new AuthSession(config, deps);
    await ready(session);
    now += 3590000;
    request.mockResolvedValueOnce(token(undefined));
    const values = await Promise.all([session.getIdToken(), session.getIdToken()]);
    expect(values[0]).toBe(values[1]);
    expect(request).toHaveBeenCalledTimes(2);
    now += 3590000;
    request.mockResolvedValueOnce(new Response('', { status: 400 }));
    expect(await session.getIdToken()).toBeUndefined();
    expect(session.getSnapshot()).toBe('expired');
  });

  test('sign-out revokes then logs out, and late refresh cannot reinstall tokens', async () => {
    const session = new AuthSession(config, deps);
    await ready(session);
    now += 3590000;
    let resolve: ((value: Response) => void) | undefined;
    request.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const refresh = session.getIdToken();
    request.mockResolvedValueOnce(new Response('', { status: 200 }));
    await session.signOut();
    resolve?.(token(undefined));
    await refresh;
    expect(await session.getIdToken()).toBeUndefined();
    expect(request.mock.calls.at(-1)?.[0]).toEqual(new URL('/oauth2/revoke', config.hostedUiOrigin));
    expect(vi.mocked(deps.navigate).mock.calls.at(-1)?.[0]).toContain('/logout?');
    expect(sessionStorage.length).toBe(0);
  });

  test('still clears local session and calls hosted logout when revocation fails', async () => {
    const session = new AuthSession(config, deps);
    await ready(session);
    request.mockRejectedValueOnce(new Error('network'));
    await expect(session.signOut()).rejects.toThrow('network');
    expect(await session.getIdToken()).toBeUndefined();
    expect(vi.mocked(deps.navigate).mock.calls.at(-1)?.[0]).toContain('/logout?');
  });
});

test('public configuration rejects foreign callbacks, secrets and unknown fields', () => {
  expect(parseAuthConfig(config, 'http://localhost:3000')).toEqual(config);
  expect(parseAuthConfig({ enabled: false }, 'http://localhost:3000')).toEqual({ enabled: false });
  expect(() =>
    parseAuthConfig({ ...config, callbackUrl: 'https://other.example/auth/callback' }, 'http://localhost:3000'),
  ).toThrow();
  expect(() => parseAuthConfig({ ...config, clientSecret: 'secret' }, 'http://localhost:3000')).toThrow();
});
