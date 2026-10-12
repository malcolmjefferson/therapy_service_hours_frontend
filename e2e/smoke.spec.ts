import { expect, test, type APIResponse } from '@playwright/test';

// S0-20: minimal smoke and header scan of an environment (ADR-0004, SEC-31). Runs in the pipeline's
// dev smoke stage against the CloudFront URL; a failure blocks the prod approval.

/** Security headers every response must carry, by name and value. */
const REQUIRED_HEADERS: Record<string, (value: string) => boolean> = {
  'strict-transport-security': (v) => v.includes('max-age=31536000') && v.toLowerCase().includes('includesubdomains'),
  'x-content-type-options': (v) => v === 'nosniff',
  'x-frame-options': (v) => v.toUpperCase() === 'DENY',
  'referrer-policy': (v) => v === 'strict-origin-when-cross-origin',
  'content-security-policy': (v) =>
    v.includes("default-src 'self'") &&
    v.includes("frame-ancestors 'none'") &&
    v.includes("object-src 'none'") &&
    v
      .split(';')
      .some(
        (directive) =>
          directive.trim().startsWith("connect-src 'self'") &&
          directive
            .split(/\s+/)
            .includes(
              process.env.HOSTED_UI_ORIGIN ??
                'https://therapy-service-hours-dev-malcolmjefferson.auth.us-west-2.amazoncognito.com',
            ),
      ) &&
    !/unsafe-inline|unsafe-eval/.test(v),
};

function expectSecurityHeaders(response: APIResponse, what: string): void {
  const headers = response.headers();
  for (const [name, valid] of Object.entries(REQUIRED_HEADERS)) {
    expect(name in headers, `${what}: missing ${name}`).toBe(true);
    const value = headers[name];
    expect(valid(value), `${what}: ${name} has unexpected value "${value}"`).toBe(true);
  }
}

test('the API health check returns JSON through the shared origin', async ({ request }) => {
  const response = await request.get('/api/v1/healthz');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(response.headers()['cache-control']).toContain('no-store');
  const body = (await response.json()) as { status: string; version: string };
  expect(body.status).toBe('ok');
  expect(body.version).not.toBe('');
  expectSecurityHeaders(response, 'GET /api/v1/healthz');
});

test('an unknown API path is a problem+json 404, not the SPA', async ({ request }) => {
  const response = await request.get('/api/v1/smoke-test-does-not-exist');
  if (process.env.AUTH_ENABLED === 'true') {
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
    return;
  }
  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('application/problem+json');
  const body = (await response.json()) as { type: string; status: number };
  expect(body.type).toMatch(/^urn:therapy-service-hours:problem:/);
  expect(body.status).toBe(404);
});

test('the start page loads the SPA and shows the API status', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(msg.text());
  });
  page.on('pageerror', (err) => problems.push(err.message));

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Clinical Hours Ledger' })).toBeVisible();
  if (process.env.AUTH_ENABLED === 'true') {
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
    expect(problems).toEqual([]);
    return;
  }
  const status = page.getByRole('region', { name: 'System status' });
  await expect(status.getByText('Up')).toBeVisible();
  // A CSP violation (for example a third-party font or inline style) would show up as a console error.
  expect(problems, problems.join('\n')).toEqual([]);
});

test('a deep link loads the SPA, which handles the route itself', async ({ page }) => {
  const response = await page.goto('/schedules');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['content-type']).toContain('text/html');
  await expect(page.getByRole('heading', { level: 1, name: 'Clinical Hours Ledger' })).toBeVisible();
});

test('security headers on the SPA, and caching for index.html and hashed assets', async ({ request }) => {
  const index = await request.get('/');
  expectSecurityHeaders(index, 'GET /');
  expect(index.headers()['cache-control']).toContain('no-cache');

  const asset = /\/assets\/[^"]+\.js/.exec(await index.text())?.[0];
  expect(asset, 'index.html references a hashed script').toBeDefined();
  const assetResponse = await request.get(asset ?? '');
  expect(assetResponse.status()).toBe(200);
  expect(assetResponse.headers()['cache-control']).toContain('immutable');
  expectSecurityHeaders(assetResponse, `GET ${asset ?? ''}`);
});
