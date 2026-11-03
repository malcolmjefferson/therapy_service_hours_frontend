import type { APIRequestContext, Page } from '@playwright/test';
import { parseAuthConfig } from '../src/lib/auth/config.js';
import { nativeSession } from './native-client.js';

export type NativeUser = Parameters<typeof nativeSession>[0];

/** The signed-in browser's view of one synthetic dev user (ADR-0011). */
export interface NativeBrowserSession {
  /** Same-origin API calls from the page carry this token; use it for runner-side setup and cleanup. */
  idToken: string;
  /** Revokes the user's refresh token. Call it once, in a `finally`. */
  revoke: () => void;
}

/**
 * Prepares a page so "Sign in with Google" ends in the real Gateway admitting `username`, without
 * touching Google. The Cognito protocol calls are answered with a fictional token, and every
 * same-origin `/api/v1/` call is relayed to the real backend with the native test client's ID token.
 * Tokens stay in the Node runner. This proves native admission and the deployed UI, not federation.
 */
export async function useNativeIdentity(
  page: Page,
  request: APIRequestContext,
  baseURL: string | undefined,
  username: NativeUser,
): Promise<NativeBrowserSession> {
  if (!baseURL || !/^https:\/\/[a-z0-9]+\.cloudfront\.net$/.test(baseURL)) throw new Error('DEV_AUTH_INVALID_ORIGIN');
  const origin = new URL(baseURL).origin;
  const response = await request.get('/auth-config.json');
  if (response.status() !== 200) throw new Error('DEV_AUTH_CONFIGURATION_UNAVAILABLE');
  const config = parseAuthConfig(await response.json(), origin);
  if (!config.enabled) throw new Error('DEV_AUTH_CONFIGURATION_DISABLED');
  const native = nativeSession(username, config.issuer);
  let nonce = '';
  let signedOut = false;
  let revoked = false;
  const revoke = () => {
    if (revoked) return;
    revoked = true;
    native.revoke();
  };

  try {
    await page.route('https://accounts.google.com/**', () => {
      throw new Error('GOOGLE_AUTOMATION_FORBIDDEN');
    });
    await page.route(`${config.hostedUiOrigin}/oauth2/authorize*`, async (route) => {
      const url = new URL(route.request().url());
      nonce = url.searchParams.get('nonce') ?? '';
      const callback = new URL(config.callbackUrl);
      callback.searchParams.set('state', url.searchParams.get('state') ?? '');
      callback.searchParams.set('code', 'fictional-native-browser-code');
      await route.fulfill({ status: 302, headers: { location: callback.href } });
    });
    await page.route(`${config.hostedUiOrigin}/oauth2/token`, async (route) => {
      // This fictional protocol token is never sent to Gateway: native ID tokens have no OAuth
      // nonce and use the separate test-client audience.
      const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
      const claims = Buffer.from(
        JSON.stringify({
          iss: config.issuer,
          aud: config.clientId,
          token_use: 'id',
          exp: Math.floor(Date.now() / 1000) + 3600,
          nonce,
          'cognito:groups': ['admin'],
        }),
      ).toString('base64url');
      await route.fulfill({
        json: {
          id_token: `${header}.${claims}.fictional-signature`,
          refresh_token: 'fictional-browser-refresh',
          token_type: 'Bearer',
          expires_in: 3600,
        },
        headers: { 'access-control-allow-origin': origin },
      });
    });
    await page.route(`${origin}/api/v1/**`, async (route) => {
      if (signedOut) throw new Error('API_REQUEST_AFTER_LOGOUT');
      const actual = await route.fetch({
        headers: { ...route.request().headers(), authorization: `Bearer ${native.idToken}` },
        maxRedirects: 0,
      });
      // Relay the real backend response unchanged; never stub admission, roles or entries.
      await route.fulfill({ response: actual });
    });
    await page.route(`${config.hostedUiOrigin}/oauth2/revoke`, async (route) => {
      revoke();
      signedOut = true;
      await route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': origin } });
    });
    await page.route(`${config.hostedUiOrigin}/logout*`, async (route) => {
      await route.fulfill({ status: 302, headers: { location: config.logoutUrl } });
    });
  } catch (failure) {
    revoke();
    throw failure;
  }
  return { idToken: native.idToken, revoke };
}
