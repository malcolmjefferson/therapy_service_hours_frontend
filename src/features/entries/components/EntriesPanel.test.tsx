import { screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import type { components } from '../../../lib/api';
import { API, problemResponse, sampleEntries } from '../../../test/handlers';
import { server } from '../../../test/server';
import { heading, renderPanel, serveEntries } from './panelTestUtils';

type Entry = components['schemas']['Entry'];

function firstEntry(): Entry {
  const [entry] = sampleEntries;
  if (!entry) throw new Error('sampleEntries is empty');
  return entry;
}

function row(rows: readonly HTMLElement[], index: number): HTMLElement {
  const found = rows[index];
  if (!found) throw new Error(`no table row ${String(index)}`);
  return found;
}

describe('entries table', () => {
  test('lists each entry with its group badge, one client per line, two-decimal hours and on-site', async () => {
    renderPanel();
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);

    const first = within(row(rows, 1));
    expect(first.getByText('Jan 12, 2026')).toBeInTheDocument();
    expect(first.getByText('13:00 to 14:15')).toBeInTheDocument();
    expect(first.getByText('Direct Service')).toBeInTheDocument();
    expect(first.getByText('Individual Counseling')).toBeInTheDocument();
    expect(first.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['A.B.', 'C.D.']);
    expect(first.getByText('1.25')).toBeInTheDocument();
    expect(first.getByText('Yes')).toBeInTheDocument();
    expect(first.getByText('Follow-up on coping plan.')).toBeInTheDocument();

    const second = within(row(rows, 2));
    expect(second.getByText('Indirect Service')).toBeInTheDocument();
    expect(second.getByText('No clients')).toBeInTheDocument();
    expect(second.getByText('1.00')).toBeInTheDocument();
    expect(second.getByText('No')).toBeInTheDocument();
  });

  test('says "Needs time" for a legacy entry without times', async () => {
    const entry = firstEntry();
    const legacy: Entry = { ...entry, needs_time: true };
    delete legacy.start_time;
    delete legacy.end_time;
    serveEntries(1, [legacy]);
    renderPanel();
    expect(await screen.findByText('Needs time')).toBeInTheDocument();
  });

  test('shows notes and client names as text, never as markup', async () => {
    const entry = firstEntry();
    serveEntries(1, [{ ...entry, notes: '<img src=x onerror=alert(1)>' }]);
    renderPanel();
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  test('starts newest first and reports it on the heading', async () => {
    const calls = serveEntries(2);
    renderPanel();
    await screen.findByRole('table');
    expect(Object.fromEntries(calls[0] ?? [])).toEqual({
      sort: 'session_date',
      dir: 'desc',
      page: '1',
      page_size: '50',
    });
    expect(heading('Date')).toHaveAttribute('aria-sort', 'descending');
    for (const name of ['Category', 'Client', 'Hours', 'On-site']) {
      expect(heading(name)).toHaveAttribute('aria-sort', 'none');
    }
    expect(screen.getByRole('table', { name: 'Your entries, sorted by Date, descending' })).toBeInTheDocument();
  });

  test('sort headings are buttons that toggle ascending and descending and keep aria-sort in step', async () => {
    const calls = serveEntries(2);
    const { router, user } = renderPanel();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Category' }));
    await waitFor(() => {
      expect(heading('Category')).toHaveAttribute('aria-sort', 'ascending');
    });
    expect(heading('Date')).toHaveAttribute('aria-sort', 'none');
    expect(calls.at(-1)?.get('sort')).toBe('category');
    expect(calls.at(-1)?.get('dir')).toBe('asc');
    expect(router.state.location.search).toBe('?sort=category&dir=asc');

    await user.click(screen.getByRole('button', { name: 'Category' }));
    await waitFor(() => {
      expect(heading('Category')).toHaveAttribute('aria-sort', 'descending');
    });
    expect(calls.at(-1)?.get('dir')).toBe('desc');
  });

  test('every sortable column asks the API for its own column', async () => {
    const calls = serveEntries(2);
    const { user } = renderPanel();
    await screen.findByRole('table');
    for (const [name, field] of [
      ['Client', 'client'],
      ['Hours', 'hours'],
      ['On-site', 'on_site'],
      ['Date', 'session_date'],
    ] as const) {
      await user.click(screen.getByRole('button', { name }));
      await waitFor(() => {
        expect(calls.at(-1)?.get('sort')).toBe(field);
      });
    }
  });

  test('Time and Notes are not sortable', async () => {
    renderPanel();
    await screen.findByRole('table');
    expect(heading('Time')).not.toHaveAttribute('aria-sort');
    expect(within(heading('Notes')).queryByRole('button')).toBeNull();
  });

  test('a hand-edited link with an unknown sort column falls back to the default', async () => {
    const calls = serveEntries(2);
    renderPanel('/app/entries?sort=password&dir=up&page=-3');
    await screen.findByRole('table');
    expect(calls[0]?.get('sort')).toBe('session_date');
    expect(calls[0]?.get('dir')).toBe('desc');
    expect(calls[0]?.get('page')).toBe('1');
  });
});

describe('pagination', () => {
  test('moves between pages against the API and announces the position', async () => {
    const calls = serveEntries(120);
    const { router, user } = renderPanel();
    await screen.findByRole('table');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    });
    expect(calls.at(-1)?.get('page')).toBe('2');
    expect(router.state.location.search).toBe('?page=2');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => {
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    });
  });

  test('changing the sort goes back to the first page', async () => {
    const calls = serveEntries(120);
    const { user } = renderPanel('/app/entries?page=3');
    await screen.findByRole('table');
    expect(calls[0]?.get('page')).toBe('3');
    await user.click(screen.getByRole('button', { name: 'Hours' }));
    await waitFor(() => {
      expect(calls.at(-1)?.get('page')).toBe('1');
    });
    expect(calls.at(-1)?.get('sort')).toBe('hours');
  });

  test('there is no pager when everything fits on one page', async () => {
    serveEntries(50);
    renderPanel();
    await screen.findByRole('table');
    expect(screen.queryByRole('navigation', { name: 'Entries pages' })).toBeNull();
  });

  test('a page past the end moves to the last real page', async () => {
    const calls = serveEntries(120);
    const { router } = renderPanel('/app/entries?page=9');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=3');
    });
    await waitFor(() => {
      expect(calls.at(-1)?.get('page')).toBe('3');
    });
  });
});

describe('states', () => {
  test('shows a loading message first', () => {
    renderPanel();
    expect(screen.getByText('Loading entries…')).toBeInTheDocument();
  });

  test('says there are no entries yet when the list is empty', async () => {
    serveEntries(0);
    renderPanel();
    expect(await screen.findByText(/No entries yet/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  test('shows a plain-language error with a request reference and retries', async () => {
    let fail = true;
    server.use(
      http.get(`${API}/entries`, () =>
        fail
          ? problemResponse({
              type: 'urn:therapy-service-hours:problem:internal',
              title: 'Internal error',
              status: 500,
              request_id: 'req-123',
            })
          : HttpResponse.json({ items: [...sampleEntries], page: { page: 1, page_size: 50, total_items: 2 } }),
      ),
    );
    const { user } = renderPanel();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your entries could not be loaded');
    expect(alert).toHaveTextContent('req-123');
    expect(alert).not.toHaveTextContent('Internal error');

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  test('shows the same error when the network is down', async () => {
    server.use(http.get(`${API}/entries`, () => HttpResponse.error()));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('Your entries could not be loaded');
  });

  test('has no serious accessibility violations', async () => {
    renderPanel();
    await screen.findByRole('table');
    const result = await axe.run(document.body);
    expect(result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
});
