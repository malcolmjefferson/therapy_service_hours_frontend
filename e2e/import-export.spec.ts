import { readFile } from 'node:fs/promises';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { useNativeIdentity } from './native-browser.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

// S4-11: import a prototype ledger in a real browser against the enabled dev release, read the
// report, see the entries, import it again (all duplicates) and export CSV. Sign-in is the
// native-client route of ADR-0011 (see native-browser.ts). Every name is a fictional pseudonym and
// the test removes what it creates.
const RUN = Date.now().toString(36).slice(-6);
const PREFIX = 'E2E Import';
const CLIENT_A = `${PREFIX} ${RUN} A`;
const CLIENT_B = `${PREFIX} ${RUN} B`;

// Awkward notes the importer must keep as plain text: quotes, a backslash, % and _, SQL keywords, a
// formula, and an escaped pipe.
const SQL_NOTE = `O'Brien said "50% off_all"; DROP TABLE entries; -- C:\\temp`;
const FORMULA_NOTE = '=1+1';
const PIPE_NOTE = 'Calls | referrals';

/** A ledger as the prototype writes it: no Start/End columns, so every row needs a time. */
const LEDGER = `# Clinical Hours Ledger

## Summary
- Direct Service: 3 / 1200 hours

## Clients / Groups
- ${CLIENT_A}
- ${CLIENT_B}

## Entries
| Date | Group | Category | Client | Hours | On-site | Notes |
|---|---|---|---|---|---|---|
| 2025-02-03 | Direct Service | Individual Counseling | ${CLIENT_A} | 1.5 | Yes | ${SQL_NOTE} |
| 2025-02-04 | Direct Service | Case Management | ${CLIENT_A}; ${CLIENT_B} | 0.75 | No | ${PIPE_NOTE.replace('|', '\\|')} |
| 2025-02-05 | Supervision | Group Supervision | ${CLIENT_B} | 1 | No | ${FORMULA_NOTE} |
`;

interface Listed {
  items: { id: string; name?: string }[];
}

/** Deletes this test's entries and clients so reruns start clean. */
async function sweep(request: APIRequestContext, idToken: string): Promise<void> {
  const headers = { authorization: `Bearer ${idToken}` };
  const entries = await request.get('/api/v1/entries', { headers, params: { client: PREFIX, page_size: 200 } });
  if (entries.ok()) {
    for (const entry of ((await entries.json()) as Listed).items) {
      await request.delete(`/api/v1/entries/${entry.id}`, { headers });
    }
  }
  const clients = await request.get('/api/v1/clients', { headers, params: { page_size: 200 } });
  if (clients.ok()) {
    for (const client of ((await clients.json()) as Listed).items) {
      if (client.name?.startsWith(PREFIX))
        await request.delete(`/api/v1/clients/${client.id}`, { headers, params: { confirm_detach: 'true' } });
    }
  }
}

test.describe('import and export on dev', () => {
  test.skip(
    !process.env.SMOKE_URL || process.env.AUTH_ENABLED !== 'true' || process.env.APP_ENV !== 'dev',
    'Requires enabled dev release',
  );
  test.setTimeout(120_000);

  test('import a prototype ledger, import it again, and export CSV', async ({ page, request, baseURL }) => {
    const session = await useNativeIdentity(page, request, baseURL, 'test-invited');
    try {
      await sweep(request, session.idToken);

      await test.step('sign in and open the entries page', async () => {
        await page.goto('/');
        await page.getByRole('button', { name: 'Sign in with Google' }).click();
        await expect(page.getByRole('heading', { name: 'Welcome, Test Invited' })).toBeVisible();
        await page.getByRole('link', { name: 'Your entries' }).click();
        await expect(page.getByRole('heading', { name: 'Entries', exact: true })).toBeVisible();
      });

      const chooseAndImport = async () => {
        await page.getByRole('button', { name: 'Import', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Import a Markdown ledger' });
        await dialog.getByLabel('Markdown ledger (.md)').setInputFiles({
          name: 'prototype-ledger.md',
          mimeType: 'text/markdown',
          buffer: Buffer.from(LEDGER, 'utf-8'),
        });
        await dialog.getByRole('button', { name: 'Import', exact: true }).click();
        const report = page.getByRole('dialog', { name: 'Import report' });
        await expect(report).toBeVisible();
        return report;
      };

      await test.step('import the ledger and read the report', async () => {
        const report = await chooseAndImport();
        await expect(report.getByText('3 imported', { exact: true })).toBeVisible();
        await expect(report.getByText('3 need a time', { exact: true })).toBeVisible();
        await expect(report.getByText('0 skipped', { exact: true })).toBeVisible();
        await expect(report.getByText('2 new clients', { exact: true })).toBeVisible();
        await report.getByRole('button', { name: 'Close' }).click();
        await expect(report).toBeHidden();
      });

      await test.step('the entries are in the table as plain text, flagged as needing a time', async () => {
        for (const [client, note] of [
          [CLIENT_A, SQL_NOTE],
          [CLIENT_A, PIPE_NOTE],
          [CLIENT_B, FORMULA_NOTE],
        ] as const) {
          const row = page.getByRole('row').filter({ hasText: client }).filter({ hasText: note });
          await expect(row).toHaveCount(1);
          await expect(row.getByText('Needs time')).toBeVisible();
        }
      });

      await test.step('importing the same file again skips every row as a duplicate', async () => {
        const report = await chooseAndImport();
        await expect(report.getByText('0 imported', { exact: true })).toBeVisible();
        await expect(report.getByText('3 skipped', { exact: true })).toBeVisible();
        await expect(report.getByRole('row', { name: /Already imported/ })).toHaveCount(3);
        await report.getByRole('button', { name: 'Close' }).click();
        await expect(page.getByRole('row').filter({ hasText: CLIENT_A })).toHaveCount(2);
        await expect(page.getByRole('row').filter({ hasText: CLIENT_B })).toHaveCount(2);
      });

      await test.step('export CSV holds the imported rows, with the formula neutralized', async () => {
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export CSV' }).click();
        const file = await download;
        expect(file.suggestedFilename()).toMatch(/\.csv$/);
        const path = await file.path();
        const csv = (await readFile(path, 'utf-8')).replace(/^\uFEFF/, '');
        expect(csv).toContain(`"${CLIENT_A}"`);
        expect(csv).toContain(`"${CLIENT_A}; ${CLIENT_B}"`);
        expect(csv).toContain(`"O'Brien said ""50% off_all""; DROP TABLE entries; -- C:\\temp"`);
        expect(csv).toContain('"Calls | referrals"');
        // A cell that starts with = is exported as text (SEC-37), never as a formula.
        expect(csv).toContain(`"'${FORMULA_NOTE}"`);
        expect(csv).not.toContain(`"${FORMULA_NOTE}"`);
        await expect(page.getByRole('status').getByText(/Exported \d+ entr(y|ies) to CSV\./)).toBeVisible();
      });
    } finally {
      await sweep(request, session.idToken).catch(() => undefined);
      session.revoke();
    }
  });
});
