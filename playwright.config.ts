import { defineConfig, devices } from '@playwright/test';

// S0-20: smoke and header scan. In the pipeline, SMOKE_URL is the environment's CloudFront URL.
// Locally (no SMOKE_URL) the tests run against e2e/local-server.mjs, which serves the production
// build with the same headers and routing CloudFront applies, so the spec itself can be checked.
const smokeUrl = process.env.SMOKE_URL;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI ?? process.env.CODEBUILD_BUILD_ID),
  retries: smokeUrl ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: smokeUrl ?? 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(smokeUrl
    ? {}
    : {
        webServer: {
          command: 'npm run build && node e2e/local-server.mjs',
          url: 'http://127.0.0.1:4173/api/v1/healthz',
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }),
});
