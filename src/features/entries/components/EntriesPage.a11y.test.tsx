import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, test } from 'vitest';
import type { components } from '../../../lib/api';
import { API, entryFromRequest, sampleEntries } from '../../../test/handlers';
import { renderWithProviders } from '../../../test/render';
import { server } from '../../../test/server';
import { EntriesPage } from './EntriesPage';

type EntryRequest = components['schemas']['EntryRequest'];

// S2-16: axe over the whole /app/entries page (form, filters and table together) in each state a
// user can reach, because the per-component checks cannot see problems in how the parts combine
// (duplicate ids, landmarks, headings, labels). jsdom has no layout, so colour contrast is covered
// by the token tests in src/theme/contrast.test.ts, not here.

function renderPage() {
  const router = createMemoryRouter([{ path: '/app/entries', element: <EntriesPage /> }], {
    initialEntries: ['/app/entries'],
  });
  renderWithProviders(<RouterProvider router={router} />);
  return userEvent.setup();
}

/** Serious and critical violations on the whole document, after proving axe really ran rules. */
async function seriousViolations() {
  const result = await axe.run(document.body);
  expect(result.passes.length).toBeGreaterThan(0);
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ rule: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }));
}

function serveEntries(items: readonly (typeof sampleEntries)[number][]) {
  server.use(
    http.get(`${API}/entries`, () =>
      HttpResponse.json({ items: [...items], page: { page: 1, page_size: 50, total_items: items.length } }),
    ),
  );
}

describe('the entries page has no serious or critical axe violations', () => {
  test('with saved entries', async () => {
    renderPage();
    await screen.findByRole('table');
    await screen.findByRole('form', { name: 'Add entry' });
    expect(await seriousViolations()).toEqual([]);
  });

  test('with no entries yet', async () => {
    serveEntries([]);
    renderPage();
    await screen.findByRole('form', { name: 'Add entry' });
    await screen.findByText(/no entries/i);
    expect(await seriousViolations()).toEqual([]);
  });

  test('when the entries cannot be loaded', async () => {
    server.use(http.get(`${API}/entries`, () => HttpResponse.error()));
    renderPage();
    await screen.findByRole('alert');
    expect(await seriousViolations()).toEqual([]);
  });

  test('with the client picker open', async () => {
    const user = renderPage();
    await screen.findByRole('table');
    await user.click(await screen.findByRole('button', { name: /Clients \/ groups/ }));
    await screen.findByRole('checkbox', { name: 'A.B.' });
    expect(await seriousViolations()).toEqual([]);
  });

  test('with validation errors on the form', async () => {
    const user = renderPage();
    await screen.findByRole('table');
    await user.click(await screen.findByRole('button', { name: 'Add entry' }));
    await screen.findAllByRole('alert');
    expect(await seriousViolations()).toEqual([]);
  });

  test('with the confirmation toast after a save', async () => {
    server.use(
      http.post(`${API}/entries`, async ({ request }) =>
        HttpResponse.json(entryFromRequest((await request.json()) as EntryRequest), { status: 201 }),
      ),
    );
    const user = renderPage();
    await screen.findByRole('table');
    const addForm = await screen.findByRole('form', { name: 'Add entry' });
    // The filters above the table have fields of their own, so form fields are looked up inside the form.
    await user.type(within(addForm).getByLabelText('Date'), '2026-10-12');
    await user.selectOptions(await within(addForm).findByLabelText('Category'), 'Individual Counseling');
    await user.type(within(addForm).getByLabelText('Start time'), '0900');
    await user.type(within(addForm).getByLabelText('End time'), '1015');
    await user.click(within(addForm).getByRole('button', { name: 'Add entry' }));
    await screen.findByText('Entry added.');
    expect(await seriousViolations()).toEqual([]);
  });
});
