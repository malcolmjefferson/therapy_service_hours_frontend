import { expect, test } from '@playwright/test';

// Isolated browser contract tests. Every OAuth request is intercepted; no account or AWS
// credentials are used. Live password-client coverage remains S1-13 after activation.
test.describe('PKCE browser flow', () => {
  test.skip(Boolean(process.env.SMOKE_URL), 'Mocked OAuth tests run locally/CI, not against the deployed site');

  for (const mode of ['allowed', 'callback-denied', 'profile-denied']) {
    const denied = mode === 'callback-denied';
    const profileDenied = mode === 'profile-denied';
    test(
      denied
        ? 'callback denial is safe and accessible'
        : profileDenied
          ? 'a forbidden profile clears the session and shows access denied'
          : 'sign-in, reload and sign-out keep tokens out of storage',
      async ({ page, baseURL }, testInfo) => {
        const origin = new URL(baseURL ?? 'http://127.0.0.1:4173').origin;
        const hosted = 'https://therapy-service-hours-dev-malcolmjefferson.auth.us-west-2.amazoncognito.com';
        const issuer = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_Test';
        let nonce = '';
        let token = '';
        let exchanges = 0;
        let revoked = false;
        let resumed = false;
        await page.route('**/auth-config.json', (route) =>
          route.fulfill({
            json: {
              enabled: true,
              hostedUiOrigin: hosted,
              issuer,
              clientId: 'client123',
              callbackUrl: `${origin}/auth/callback`,
              logoutUrl: `${origin}/`,
            },
          }),
        );
        await page.route(`${hosted}/oauth2/authorize*`, async (route) => {
          const url = new URL(route.request().url());
          expect(url.searchParams.get('code_challenge_method')).toBe('S256');
          expect(url.searchParams.get('code_challenge')).toHaveLength(43);
          nonce = url.searchParams.get('nonce') ?? '';
          resumed = !url.searchParams.has('identity_provider');
          const callback = new URL(`${origin}/auth/callback`);
          callback.searchParams.set('state', url.searchParams.get('state') ?? '');
          if (denied) {
            callback.searchParams.set('error', 'access_denied');
            callback.searchParams.set('error_description', '<img src=x onerror=alert(1)> private@example.invalid');
          } else callback.searchParams.set('code', 'fictional-code');
          await route.fulfill({ status: 302, headers: { location: callback.href } });
        });
        await page.route(`${hosted}/oauth2/token`, async (route) => {
          exchanges++;
          const payload = Buffer.from(
            JSON.stringify({
              iss: issuer,
              aud: 'client123',
              token_use: 'id',
              exp: Math.floor(Date.now() / 1000) + 3600,
              nonce,
              'cognito:groups': ['admin'],
            }),
          ).toString('base64url');
          token = `${Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url')}.${payload}.fictional-signature`;
          await route.fulfill({
            json: { id_token: token, refresh_token: 'fictional-refresh', token_type: 'Bearer', expires_in: 3600 },
            headers: { 'access-control-allow-origin': origin },
          });
        });
        await page.route('**/api/v1/me', async (route) => {
          expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
          if (profileDenied) {
            await route.fulfill({
              status: 403,
              json: { type: 'urn:therapy-service-hours:problem:forbidden', title: 'Forbidden', status: 403 },
            });
            return;
          }
          await route.fulfill({
            json: {
              id: '00000000-0000-4000-8000-000000000002',
              name: 'Pseudonym A',
              email: 'pseudonym@example.invalid',
              roles: [],
              organization: { id: '00000000-0000-4000-8000-000000000001', name: 'Default Organization' },
            },
          });
        });
        await page.route(`${hosted}/oauth2/revoke`, async (route) => {
          revoked = true;
          expect(route.request().postData()).toContain('token=fictional-refresh');
          await route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': origin } });
        });
        await page.route(`${hosted}/logout*`, async (route) => {
          await route.fulfill({ status: 302, headers: { location: `${origin}/` } });
        });
        await page.goto('/');
        if (!denied && !profileDenied) {
          await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
          await page.screenshot({ path: testInfo.outputPath('landing.png') });
        }
        await page.getByRole('button', { name: 'Sign in with Google' }).click();
        if (denied) {
          await expect(page.getByRole('heading', { name: 'Access has not been granted' })).toBeVisible();
          await expect(page.getByText('private@example.invalid', { exact: false })).toHaveCount(0);
          expect(page.url()).not.toContain('error_description');
          expect(exchanges).toBe(0);
          return;
        }
        if (profileDenied) {
          await expect(page.getByRole('heading', { name: 'Access has not been granted' })).toBeVisible();
          expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
          await page.screenshot({ path: testInfo.outputPath('access-denied.png') });
          return;
        }
        await expect(page.getByRole('heading', { name: 'Welcome, Pseudonym A' })).toBeVisible();
        await expect(page.getByText('Roles: admin')).toHaveCount(0);
        expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({
          local: 0,
          session: 0,
        });
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Welcome, Pseudonym A' })).toBeVisible();
        expect(exchanges).toBe(2);
        expect(resumed).toBe(true);
        await page.getByText('Account: Pseudonym A').click();
        await page.getByRole('button', { name: 'Sign out' }).click();
        await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
        expect(revoked).toBe(true);
        expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
      },
    );
  }
});
