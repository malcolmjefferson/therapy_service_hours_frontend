import { screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, test } from 'vitest';
import { CLIENT_DEBOUNCE_MS } from './EntriesFilters';
import { renderPanel, serveEntries } from './panelTestUtils';

const groupSelect = () => screen.getByLabelText('Group');
const clientBox = () => screen.getByLabelText('Client contains');
const fromBox = () => screen.getByLabelText('From');
const toBox = () => screen.getByLabelText('To');

describe('filter controls', () => {
  test('are labelled, and Clear filters, Export and Import sit on the Entries header row', async () => {
    serveEntries(2);
    renderPanel();
    await screen.findByRole('table');
    expect(screen.getByRole('search', { name: 'Filter entries' })).toBeInTheDocument();
    for (const control of [groupSelect(), clientBox(), fromBox(), toBox()]) expect(control).toBeEnabled();
    expect(
      within(groupSelect())
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All groups', 'Direct Service', 'Indirect Service', 'Supervision']);

    const headerRow = screen.getByRole('heading', { name: 'Entries' }).parentElement;
    if (!headerRow) throw new Error('no header row');
    const row = within(headerRow);
    expect(row.getByRole('button', { name: 'Clear filters' })).toBeEnabled();
    expect(row.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
    expect(row.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  test('start empty and send no filter parameters', async () => {
    const calls = serveEntries(2);
    renderPanel();
    await screen.findByRole('table');
    expect(groupSelect()).toHaveValue('');
    expect(clientBox()).toHaveValue('');
    expect(calls).toHaveLength(1);
    for (const key of ['group', 'client', 'from', 'to']) expect(calls[0]?.has(key)).toBe(false);
  });

  test('choosing a group asks the API for it, puts it in the URL and returns to page 1', async () => {
    const calls = serveEntries(120);
    const { router, user } = renderPanel('/app/entries?page=3');
    await screen.findByRole('table');

    await user.selectOptions(groupSelect(), 'supervision');
    await waitFor(() => {
      expect(calls.at(-1)?.get('group')).toBe('supervision');
    });
    expect(calls.at(-1)?.get('page')).toBe('1');
    expect(router.state.location.search).toBe('?group=supervision');

    await user.selectOptions(groupSelect(), '');
    await waitFor(() => {
      expect(calls.at(-1)?.has('group')).toBe(false);
    });
    expect(router.state.location.search).toBe('');
  });

  test('the client text waits for a pause in typing, then sends one request', async () => {
    const calls = serveEntries(2);
    const { router, user } = renderPanel();
    await screen.findByRole('table');

    await user.type(clientBox(), 'a.b');
    expect(calls.some((call) => call.has('client'))).toBe(false);
    await waitFor(
      () => {
        expect(calls.at(-1)?.get('client')).toBe('a.b');
      },
      { timeout: CLIENT_DEBOUNCE_MS * 6 },
    );
    expect(calls.filter((call) => call.has('client'))).toHaveLength(1);
    expect(router.state.location.search).toBe('?client=a.b');
  });

  test('Enter in the client box applies it at once', async () => {
    const calls = serveEntries(2);
    const { user } = renderPanel();
    await screen.findByRole('table');
    await user.type(clientBox(), 'c.d{Enter}');
    await waitFor(() => {
      expect(calls.at(-1)?.get('client')).toBe('c.d');
    });
  });

  test('client text goes to the API as typed text, whatever characters it holds', async () => {
    const calls = serveEntries(0);
    const { user } = renderPanel();
    await screen.findByText(/No entries yet/);
    const payload = "' OR 1=1 --";
    await user.type(clientBox(), `${payload}{Enter}`);
    await waitFor(() => {
      expect(calls.at(-1)?.get('client')).toBe(payload);
    });
    await user.clear(clientBox());
    await user.type(clientBox(), '50%_\\{Enter}');
    await waitFor(() => {
      expect(calls.at(-1)?.get('client')).toBe('50%_\\');
    });
  });

  test('blank client text is not sent', async () => {
    const calls = serveEntries(2);
    const { user } = renderPanel();
    await screen.findByRole('table');
    await user.type(clientBox(), '   {Enter}');
    await new Promise((resolve) => setTimeout(resolve, CLIENT_DEBOUNCE_MS * 2));
    expect(calls).toHaveLength(1);
  });

  test('the client box stops at the length the API accepts', async () => {
    serveEntries(2);
    renderPanel();
    await screen.findByRole('table');
    expect(clientBox()).toHaveAttribute('maxlength', '64');
  });

  test('the date range is sent as from and to', async () => {
    const calls = serveEntries(2);
    const { router, user } = renderPanel();
    await screen.findByRole('table');

    await user.type(fromBox(), '2026-01-01');
    await waitFor(() => {
      expect(calls.at(-1)?.get('from')).toBe('2026-01-01');
    });
    await user.type(toBox(), '2026-01-31');
    await waitFor(() => {
      expect(calls.at(-1)?.get('to')).toBe('2026-01-31');
    });
    expect(router.state.location.search).toBe('?from=2026-01-01&to=2026-01-31');
  });

  test('filters combine in one request and keep the sort', async () => {
    const calls = serveEntries(2);
    const { user } = renderPanel('/app/entries?sort=hours&dir=asc');
    await screen.findByRole('table');

    await user.selectOptions(groupSelect(), 'direct');
    await user.type(fromBox(), '2026-01-01');
    await user.type(toBox(), '2026-03-31');
    await user.type(clientBox(), 'a.b{Enter}');
    await waitFor(() => {
      expect(Object.fromEntries(calls.at(-1) ?? [])).toEqual({
        group: 'direct',
        client: 'a.b',
        from: '2026-01-01',
        to: '2026-03-31',
        sort: 'hours',
        dir: 'asc',
        page: '1',
        page_size: '50',
      });
    });
  });

  test('a link with filters opens with them applied', async () => {
    const calls = serveEntries(2);
    renderPanel('/app/entries?group=indirect&client=A.B.&from=2026-01-01&to=2026-02-01');
    await screen.findByRole('table');
    expect(groupSelect()).toHaveValue('indirect');
    expect(clientBox()).toHaveValue('A.B.');
    expect(fromBox()).toHaveValue('2026-01-01');
    expect(toBox()).toHaveValue('2026-02-01');
    expect(Object.fromEntries(calls[0] ?? [])).toMatchObject({
      group: 'indirect',
      client: 'A.B.',
      from: '2026-01-01',
      to: '2026-02-01',
    });
  });

  test('a hand-edited link with a bad group or date ignores them', async () => {
    const calls = serveEntries(2);
    renderPanel('/app/entries?group=admin&from=soon&to=2026-02-30');
    await screen.findByRole('table');
    for (const key of ['group', 'from', 'to']) expect(calls[0]?.has(key)).toBe(false);
  });
});

describe('Clear filters', () => {
  test('resets every filter, empties the controls, returns to page 1 and keeps the sort', async () => {
    const calls = serveEntries(120);
    const { router, user } = renderPanel(
      '/app/entries?sort=hours&dir=asc&page=2&group=direct&client=a.b&from=2026-01-01&to=2026-02-01',
    );
    await screen.findByRole('table');
    expect(calls[0]?.get('group')).toBe('direct');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => {
      expect(Object.fromEntries(calls.at(-1) ?? [])).toEqual({
        sort: 'hours',
        dir: 'asc',
        page: '1',
        page_size: '50',
      });
    });
    expect(groupSelect()).toHaveValue('');
    expect(clientBox()).toHaveValue('');
    expect(fromBox()).toHaveValue('');
    expect(toBox()).toHaveValue('');
    expect(router.state.location.search).toBe('?sort=hours&dir=asc');
  });

  test('also clears client text that has not been applied yet', async () => {
    const calls = serveEntries(2);
    const { user } = renderPanel();
    await screen.findByRole('table');
    await user.type(clientBox(), 'a.b');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(clientBox()).toHaveValue('');
    await new Promise((resolve) => setTimeout(resolve, CLIENT_DEBOUNCE_MS * 2));
    expect(calls.some((call) => call.has('client'))).toBe(false);
  });
});

describe('results', () => {
  test('say "no entries match" when filters leave nothing, and the filters stay to change', async () => {
    serveEntries(0);
    renderPanel('/app/entries?group=direct');
    expect(await screen.findByText(/No entries match these filters/)).toBeInTheDocument();
    expect(screen.queryByText(/No entries yet/)).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(groupSelect()).toHaveValue('direct');
  });

  test('say "no entries yet" when there are no filters', async () => {
    serveEntries(0);
    renderPanel();
    expect(await screen.findByText(/No entries yet/)).toBeInTheDocument();
    expect(screen.queryByText(/No entries match/)).toBeNull();
  });

  test('the count says how many match once a filter is on', async () => {
    serveEntries(7);
    const { user } = renderPanel();
    expect(await screen.findByText('7 in total')).toBeInTheDocument();
    await user.selectOptions(groupSelect(), 'direct');
    expect(await screen.findByText('7 matching')).toBeInTheDocument();
  });

  test('keep the table on screen while the next filter result loads', async () => {
    serveEntries(2);
    const { user } = renderPanel();
    await screen.findByRole('table');
    await user.selectOptions(groupSelect(), 'direct');
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});

describe('a date range that runs backwards', () => {
  test('is flagged on the To field, not sent, and recovers when fixed', async () => {
    const calls = serveEntries(2);
    const { user } = renderPanel('/app/entries?from=2026-02-01&to=2026-01-01');

    expect(await screen.findByRole('alert')).toHaveTextContent('The end date is before the start date.');
    expect(toBox()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Choose an end date that is not before the start date/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(calls).toHaveLength(0);

    await user.clear(toBox());
    await user.type(toBox(), '2026-03-01');
    await screen.findByRole('table');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(calls.at(-1)?.get('to')).toBe('2026-03-01');
    expect(calls.every((call) => !(call.get('from') === '2026-02-01' && call.get('to') === '2026-01-01'))).toBe(true);
  });

  test('a single day (from equal to to) is allowed', async () => {
    const calls = serveEntries(2);
    renderPanel('/app/entries?from=2026-01-05&to=2026-01-05');
    await screen.findByRole('table');
    expect(calls[0]?.get('from')).toBe('2026-01-05');
    expect(calls[0]?.get('to')).toBe('2026-01-05');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

test('the panel with filters and results has no serious accessibility violations', async () => {
  serveEntries(2);
  renderPanel('/app/entries?group=direct&from=2026-01-01');
  await screen.findByRole('table');
  const result = await axe.run(document.body);
  expect(result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('the panel with a backwards range has no serious accessibility violations', async () => {
  serveEntries(2);
  renderPanel('/app/entries?from=2026-02-01&to=2026-01-01');
  await screen.findByRole('alert');
  const result = await axe.run(document.body);
  expect(result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});
