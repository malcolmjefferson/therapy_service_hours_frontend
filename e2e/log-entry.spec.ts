import { expect, test, type APIRequestContext } from '@playwright/test';
import { useNativeIdentity } from './native-browser.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

// S2-17: the log-an-entry critical path in a real browser against the enabled dev release. Sign-in
// is the native-client route of ADR-0011 (see native-browser.ts); the Gateway, Lambdas and database
// are real. Every name below is a fictional pseudonym, and the test removes what it creates.
const RUN = Date.now().toString(36).slice(-6);
const PREFIX = 'E2E Pseudonym';
const CLIENT = `${PREFIX} ${RUN}`;
// A fixed past date so the overlap is known; the sweep below clears any leftover from a failed run.
const SESSION_DATE = '2025-03-10';
const CATEGORY = 'Individual Counseling';
const ROW_LABEL = 'Mar 10, 2025, Individual Counseling';

interface Listed {
  items: { id: string; name?: string }[];
}

/** Deletes this test's clients (and, first, the entries that use them) so reruns start clean. */
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

test.describe('log an entry on dev', () => {
  test.skip(
    !process.env.SMOKE_URL || process.env.AUTH_ENABLED !== 'true' || process.env.APP_ENV !== 'dev',
    'Requires enabled dev release',
  );
  test.setTimeout(120_000);

  test('sign in, add a client, log an entry, reject an overlap, edit and delete', async ({
    page,
    request,
    baseURL,
  }) => {
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

      const addForm = page.getByRole('form', { name: 'Add entry' });
      const toasts = page.getByRole('status');

      await test.step('add a client from the form', async () => {
        await addForm.getByRole('button', { name: 'Add a new client or group' }).click();
        await addForm.getByLabel('New client or group', { exact: true }).fill(CLIENT);
        await addForm.getByRole('button', { name: 'Save client' }).click();
        // A saved client is selected at once, so it names the closed dropdown.
        await expect(addForm.getByRole('button', { name: new RegExp(CLIENT) })).toBeVisible();
      });

      await test.step('log an entry and see it in the table', async () => {
        await addForm.getByLabel('Date', { exact: true }).fill(SESSION_DATE);
        await addForm.getByLabel('Category').selectOption({ label: CATEGORY });
        await addForm.getByLabel('Start time').fill('09:00');
        await addForm.getByLabel('End time').fill('10:15');
        await expect(addForm.getByText('1.25', { exact: true })).toBeVisible();
        await addForm.getByLabel('On-site').check();
        await addForm.getByLabel('Notes (optional)').fill('Fictional end-to-end session.');
        await addForm.getByRole('button', { name: 'Add entry' }).click();
        await expect(toasts.getByText('Entry added.')).toBeVisible();

        const row = page.getByRole('row').filter({ hasText: CLIENT });
        await expect(row).toHaveCount(1);
        await expect(row).toContainText('09:00 to 10:15');
        await expect(row).toContainText(CATEGORY);
        await expect(row).toContainText('1.25');
        await expect(row).toContainText('Fictional end-to-end session.');
      });

      await test.step('an overlapping session is refused and nothing is added', async () => {
        await addForm.getByLabel('Date', { exact: true }).fill(SESSION_DATE);
        await addForm.getByLabel('Category').selectOption({ label: CATEGORY });
        await addForm.getByLabel('Start time').fill('09:30');
        await addForm.getByLabel('End time').fill('10:00');
        await addForm.getByRole('button', { name: 'Add entry' }).click();
        const message = `This overlaps an existing session on ${SESSION_DATE} (09:00 to 10:15)`;
        await expect(addForm.getByText(message)).toBeVisible();
        await expect(addForm.getByLabel('Start time')).toHaveAccessibleDescription(message);
        await expect(page.getByRole('row').filter({ hasText: '09:30 to 10:00' })).toHaveCount(0);
        await expect(page.getByRole('row').filter({ hasText: CLIENT })).toHaveCount(1);
      });

      await test.step('edit the entry', async () => {
        await page.getByRole('button', { name: `Edit entry: ${ROW_LABEL}` }).click();
        const editForm = page.getByRole('form', { name: 'Edit entry' });
        await expect(editForm.getByLabel('Start time')).toHaveValue('09:00');
        await editForm.getByLabel('End time').fill('10:30');
        await editForm.getByRole('button', { name: 'Save changes' }).click();
        await expect(toasts.getByText('Entry updated.')).toBeVisible();

        const row = page.getByRole('row').filter({ hasText: CLIENT });
        await expect(row).toHaveCount(1);
        await expect(row).toContainText('09:00 to 10:30');
        await expect(row).toContainText('1.50');
      });

      await test.step('delete the entry after confirming', async () => {
        await page.getByRole('button', { name: `Delete entry: ${ROW_LABEL}` }).click();
        const dialog = page.getByRole('dialog', { name: 'Delete this entry?' });
        await expect(dialog).toContainText('09:00 to 10:30');
        await dialog.getByRole('button', { name: 'Delete entry', exact: true }).click();
        await expect(toasts.getByText('Entry deleted.')).toBeVisible();
        await expect(page.getByRole('row').filter({ hasText: CLIENT })).toHaveCount(0);
      });
    } finally {
      // Cleanup runs before the refresh token is revoked; neither may hide the test's own failure.
      await sweep(request, session.idToken).catch(() => undefined);
      session.revoke();
    }
  });
});
