import { expect, test } from '@playwright/test';
import { parseAuthConfig } from '../src/lib/auth/config.js';
import { nativeSession } from './native-client.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

// Google protocol is intercepted; Gateway and /me are real. Native tokens remain
// in the Node runner and are substituted only on the exact same-origin /me call.
// This proves native admission + deployed UI, not actual Google federation.
test.describe('dev native identity with deployed browser UI', () => {
  test.skip(
    !process.env.SMOKE_URL || process.env.AUTH_ENABLED !== 'true' || process.env.APP_ENV !== 'dev',
    'Requires enabled dev release',
  );
  test.setTimeout(90_000);

  for (const username of ['test-invited', 'test-uninvited'] as const) {
    test(`${username} is enforced by the real Gateway and rendered safely`, async ({ page, request, baseURL }) => {
      if (!baseURL || !/^https:\/\/[a-z0-9]+\.cloudfront\.net$/.test(baseURL))
        throw new Error('DEV_AUTH_INVALID_ORIGIN');
      const origin = new URL(baseURL).origin;
      const response = await request.get('/auth-config.json');
      expect(response.status()).toBe(200);
      const config = parseAuthConfig(await response.json(), origin);
      if (!config.enabled) throw new Error('DEV_AUTH_CONFIGURATION_DISABLED');
      const native = nativeSession(username, config.issuer);
      let nonce = '';
      let profileStatus = 0;
      let profileCalls = 0;
      let signedOut = false;
      const outcome = { revoked: false };
      try {
        await page.route('https://accounts.google.com/**', () => {
          throw new Error('GOOGLE_AUTOMATION_FORBIDDEN');
        });
        await page.route(`${config.hostedUiOrigin}/oauth2/authorize*`, async (route) => {
          const url = new URL(route.request().url());
          nonce = url.searchParams.get('nonce') ?? '';
          expect(url.searchParams.get('code_challenge_method')).toBe('S256');
          const callback = new URL(config.callbackUrl);
          callback.searchParams.set('state', url.searchParams.get('state') ?? '');
          callback.searchParams.set('code', 'fictional-native-browser-code');
          await route.fulfill({ status: 302, headers: { location: callback.href } });
        });
        await page.route(`${config.hostedUiOrigin}/oauth2/token`, async (route) => {
          // This fictional protocol token is never sent to Gateway. Native ID
          // tokens have no OAuth nonce and use the separate test-client audience.
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
        await page.route(`${origin}/api/v1/me`, async (route) => {
          if (signedOut) throw new Error('PROFILE_REQUEST_AFTER_LOGOUT');
          profileCalls++;
          const actual = await route.fetch({
            headers: { ...route.request().headers(), authorization: `Bearer ${native.idToken}` },
            maxRedirects: 0,
          });
          profileStatus = actual.status();
          // Relay the real backend response unchanged; never stub admission/roles.
          await route.fulfill({ response: actual });
        });
        await page.route(`${config.hostedUiOrigin}/oauth2/revoke`, async (route) => {
          native.revoke();
          outcome.revoked = true;
          signedOut = true;
          await route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': origin } });
        });
        await page.route(`${config.hostedUiOrigin}/logout*`, async (route) => {
          await route.fulfill({ status: 302, headers: { location: config.logoutUrl } });
        });
        await page.goto('/');
        await page.getByRole('button', { name: 'Sign in with Google' }).click();
        if (username === 'test-uninvited') {
          await expect(page.getByRole('heading', { name: 'Access has not been granted' })).toBeVisible();
          expect(profileStatus).toBe(403);
        } else {
          await expect(page.getByRole('heading', { name: 'Welcome, Test Invited' })).toBeVisible();
          expect(profileStatus).toBe(200);
          await expect(page.getByText('Roles: admin')).toHaveCount(0);
          await page.getByText('Account: Test Invited').click();
          await page.getByRole('button', { name: 'Sign out' }).click();
          await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
          expect(outcome.revoked).toBe(true);
        }
        expect(profileCalls).toBeGreaterThan(0);
        expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({
          local: 0,
          session: 0,
        });
        expect(page.url()).not.toContain('code=');
      } finally {
        if (!outcome.revoked) native.revoke();
      }
    });
  }
});
