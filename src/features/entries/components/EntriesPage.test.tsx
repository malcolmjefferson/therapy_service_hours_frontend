import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, test } from 'vitest';
import { IN_PROGRESS_RETRIES, type components } from '../../../lib/api';
import { API, entryFromRequest, problemResponse, sampleClients, sampleEntries } from '../../../test/handlers';
import { renderWithProviders } from '../../../test/render';
import { server } from '../../../test/server';
import { EntriesPage } from './EntriesPage';

type Entry = components['schemas']['Entry'];
type EntryRequest = components['schemas']['EntryRequest'];

const OVERLAP = 'urn:therapy-service-hours:problem:entry-overlap';
const LOCKED = 'urn:therapy-service-hours:problem:entry-locked';
const OVERLAP_TEXT = 'This overlaps an existing session on 2026-01-05 (09:00 to 10:00)';

const [first, second] = sampleEntries;
if (!first || !second) throw new Error('sampleEntries needs two entries');

/** The `Individual Counseling` entry from the samples: 2026-01-12, 13:00 to 14:15, clients A.B. and C.D., on-site. */
const editLabel = 'Edit entry: Jan 12, 2026, Individual Counseling';
const deleteLabel = 'Delete entry: Jan 12, 2026, Individual Counseling';

function renderPage() {
  const router = createMemoryRouter([{ path: '/app/entries', element: <EntriesPage /> }], {
    initialEntries: ['/app/entries'],
  });
  renderWithProviders(<RouterProvider router={router} />);
  return userEvent.setup();
}

type User = ReturnType<typeof userEvent.setup>;

/** Serves `items` and lets a test change them, as the server would after a save or delete. */
function serveEntries(items: Entry[]) {
  server.use(
    http.get(`${API}/entries`, () =>
      HttpResponse.json({ items: [...items], page: { page: 1, page_size: 50, total_items: items.length } }),
    ),
  );
  return items;
}

/** Records every request body and Idempotency-Key sent to `POST /entries`. */
function recordCreates(respond: (body: EntryRequest) => Response) {
  const calls: { body: EntryRequest; key: string | null }[] = [];
  server.use(
    http.post(`${API}/entries`, async ({ request }) => {
      const body = (await request.json()) as EntryRequest;
      calls.push({ body, key: request.headers.get('Idempotency-Key') });
      return respond(body);
    }),
  );
  return calls;
}

/** Records every body sent to `PUT /entries/{id}`. */
function recordUpdates(respond: (body: EntryRequest, id: string) => Response) {
  const calls: { id: string; body: EntryRequest }[] = [];
  server.use(
    http.put(`${API}/entries/:entryId`, async ({ params, request }) => {
      const body = (await request.json()) as EntryRequest;
      const id = String(params.entryId);
      calls.push({ id, body });
      return respond(body, id);
    }),
  );
  return calls;
}

/** The 409 the API sends while the first request with the same Idempotency-Key still runs. */
function inProgressResponse() {
  return HttpResponse.json(
    {
      type: 'urn:therapy-service-hours:problem:idempotency-key-in-progress',
      title: 'Request still in progress',
      status: 409,
    },
    // The API sends 1; 0 keeps the test from waiting a second per retry.
    { status: 409, headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '0' } },
  );
}

function overlapResponse() {
  return problemResponse({
    type: OVERLAP,
    title: 'Overlapping session',
    status: 409,
    conflicting_entry: { id: second?.id ?? '', session_date: '2026-01-05', start_time: '09:00', end_time: '10:00' },
  });
}

const form = (name: string) => screen.getByRole('form', { name });
// The filters above the table have fields of their own, so form fields are looked up inside the form.
const field = (label: string) => within(screen.getByRole('form', { name: /^(Add|Edit) entry$/ })).getByLabelText(label);

async function addForm() {
  await screen.findByRole('form', { name: 'Add entry' });
}

async function fillValid(user: User, start = '0900', end = '1015') {
  await user.type(field('Date'), '2026-10-12');
  await user.selectOptions(field('Category'), 'Individual Counseling');
  await user.type(field('Start time'), start);
  await user.type(field('End time'), end);
}

async function startEditing(user: User, label = editLabel) {
  await user.click(await screen.findByRole('button', { name: label }));
  await screen.findByRole('form', { name: 'Edit entry' });
}

describe('adding an entry', () => {
  test('saves with the chosen clients and no hours, clears the form and shows the new entry', async () => {
    const items = serveEntries([...sampleEntries]);
    const calls = recordCreates((body) => {
      const created = entryFromRequest(body);
      items.unshift(created);
      return HttpResponse.json(created, { status: 201 });
    });
    const user = renderPage();
    await addForm();
    await fillValid(user);
    await user.click(await screen.findByRole('button', { name: /Clients \/ groups/ }));
    await user.click(await screen.findByRole('checkbox', { name: 'A.B.' }));
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(await screen.findByText('Entry added.')).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toEqual({
      session_date: '2026-10-12',
      start_time: '09:00',
      end_time: '10:15',
      category_id: '00000000-0000-4000-8000-0000000000c1',
      client_ids: [sampleClients[0]?.id],
      on_site: false,
      notes: '',
    });
    expect(calls[0]?.body).not.toHaveProperty('hours');
    expect(calls[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(field('Date')).toHaveValue('');
    expect(await screen.findByText('Oct 12, 2026')).toBeInTheDocument();
  });

  test('an overlap is shown inline on the start time, naming the clashing session, and nothing is added', async () => {
    const calls = recordCreates(() => overlapResponse());
    const user = renderPage();
    await addForm();
    await fillValid(user, '0930', '1030');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    const message = await within(form('Add entry')).findByText(OVERLAP_TEXT);
    expect(field('Start time')).toHaveAccessibleDescription(OVERLAP_TEXT);
    expect(field('Start time')).toBeInvalid();
    expect(field('Start time')).toHaveFocus();
    expect(message).toHaveAttribute('role', 'alert');
    // What the person typed stays, so the fix is one edit away.
    expect(field('Date')).toHaveValue('2026-10-12');
    expect(calls).toHaveLength(1);
    expect(screen.queryByText('Entry added.')).not.toBeInTheDocument();
  });

  test('a retry of the same entry reuses its Idempotency-Key and a changed entry gets a new one', async () => {
    let attempts = 0;
    const calls = recordCreates((body) => {
      attempts += 1;
      return attempts === 1
        ? new HttpResponse(null, { status: 503 })
        : HttpResponse.json(entryFromRequest(body), { status: 201 });
    });
    const user = renderPage();
    await addForm();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(await screen.findByText('The entry could not be saved. Try again.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(await screen.findByText('Entry added.')).toBeVisible();
    expect(calls).toHaveLength(2);
    expect(calls[1]?.key).toBe(calls[0]?.key);

    await fillValid(user, '1100', '1145');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    await waitFor(() => {
      expect(calls).toHaveLength(3);
    });
    expect(calls[2]?.key).not.toBe(calls[0]?.key);
  });

  test('a create the server is still running is sent again with the same key and saved once', async () => {
    const items = serveEntries([...sampleEntries]);
    let attempts = 0;
    const calls = recordCreates((body) => {
      attempts += 1;
      if (attempts <= 2) return inProgressResponse();
      const created = entryFromRequest(body);
      items.unshift(created);
      return HttpResponse.json(created, { status: 201 });
    });
    const user = renderPage();
    await addForm();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(await screen.findByText('Entry added.')).toBeVisible();
    expect(calls).toHaveLength(3);
    expect(new Set(calls.map((call) => call.key)).size).toBe(1);
    expect(new Set(calls.map((call) => JSON.stringify(call.body))).size).toBe(1);
  });

  test('a create that stays in progress is explained, and the next try reuses the key', async () => {
    let attempts = 0;
    const calls = recordCreates((body) => {
      attempts += 1;
      return attempts <= IN_PROGRESS_RETRIES + 1
        ? inProgressResponse()
        : HttpResponse.json(entryFromRequest(body), { status: 201 });
    });
    const user = renderPage();
    await addForm();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(await screen.findByText(/still being processed/)).toBeVisible();
    expect(calls).toHaveLength(IN_PROGRESS_RETRIES + 1);
    // What the person typed stays, so trying again is one click.
    expect(field('Date')).toHaveValue('2026-10-12');

    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(await screen.findByText('Entry added.')).toBeVisible();
    expect(calls).toHaveLength(IN_PROGRESS_RETRIES + 2);
    expect(new Set(calls.map((call) => call.key)).size).toBe(1);
  });

  test('server validation errors land on the matching fields', async () => {
    recordCreates(() =>
      problemResponse({
        type: 'urn:therapy-service-hours:problem:validation',
        title: 'Invalid request',
        status: 400,
        errors: [{ field: 'end_time', message: 'End time must be after the start time.' }],
      }),
    );
    const user = renderPage();
    await addForm();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(await screen.findByText('End time must be after the start time.')).toBeVisible();
    expect(field('End time')).toHaveFocus();
  });

  test('a categories failure offers a retry instead of an empty form', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/categories`, () => {
        calls += 1;
        return calls === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json({ groups: [] });
      }),
    );
    const user = renderPage();
    expect(await screen.findByText('The form could not be loaded. Check your connection and try again.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('form', { name: 'Add entry' })).toBeVisible();
  });
});

describe('editing an entry', () => {
  test('Edit fills the form with the saved values, and saving without changes sends them all back', async () => {
    const calls = recordUpdates((body, id) => HttpResponse.json(entryFromRequest(body, id)));
    const user = renderPage();
    await startEditing(user);

    expect(field('Date')).toHaveValue('2026-01-12');
    expect(field('Category')).toHaveValue('00000000-0000-4000-8000-0000000000c1');
    expect(field('Start time')).toHaveValue('13:00');
    expect(field('End time')).toHaveValue('14:15');
    expect(field('Hours')).toHaveTextContent('1.25');
    expect(field('On-site')).toBeChecked();
    expect(field('Notes (optional)')).toHaveValue('Follow-up on coping plan.');
    expect(screen.getByRole('button', { name: /Clients \/ groups/ })).toHaveTextContent('A.B., C.D.');
    expect(field('Date')).toHaveFocus();
    expect(screen.queryByRole('form', { name: 'Add entry' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Entry updated.')).toBeVisible();
    expect(calls).toEqual([
      {
        id: first.id,
        body: {
          session_date: '2026-01-12',
          start_time: '13:00',
          end_time: '14:15',
          category_id: '00000000-0000-4000-8000-0000000000c1',
          client_ids: [sampleClients[0]?.id, sampleClients[1]?.id],
          on_site: true,
          notes: 'Follow-up on coping plan.',
        },
      },
    ]);
  });

  test('changing one field keeps the others, then returns to the add form with focus back on Edit', async () => {
    const calls = recordUpdates((body, id) => HttpResponse.json(entryFromRequest(body, id)));
    const user = renderPage();
    await startEditing(user);
    await user.clear(field('End time'));
    await user.type(field('End time'), '1430');
    expect(field('Hours')).toHaveTextContent('1.50');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('form', { name: 'Add entry' })).toBeVisible();
    expect(calls[0]?.body).toMatchObject({ start_time: '13:00', end_time: '14:30', on_site: true });
    expect(screen.getByRole('button', { name: editLabel })).toHaveFocus();
  });

  test('Cancel discards the edit and returns focus to the row', async () => {
    const calls = recordUpdates((body, id) => HttpResponse.json(entryFromRequest(body, id)));
    const user = renderPage();
    await startEditing(user);
    await user.clear(field('Notes (optional)'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('form', { name: 'Add entry' })).toBeVisible();
    expect(calls).toHaveLength(0);
    expect(screen.getByRole('button', { name: editLabel })).toHaveFocus();
  });

  test('an overlap on save is shown inline naming the clashing session, and the edit stays open', async () => {
    recordUpdates(() => overlapResponse());
    const user = renderPage();
    await startEditing(user);
    await user.clear(field('Start time'));
    await user.type(field('Start time'), '0930');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await within(form('Edit entry')).findByText(OVERLAP_TEXT)).toBeVisible();
    expect(field('Start time')).toHaveFocus();
    expect(field('Start time')).toHaveValue('09:30');
  });

  test('an entry approved in the meantime says so instead of saving', async () => {
    recordUpdates(() =>
      problemResponse({
        type: LOCKED,
        title: 'Entry locked',
        status: 409,
      }),
    );
    const user = renderPage();
    await startEditing(user);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('This entry was approved, so it can no longer be changed.')).toBeVisible();
    expect(screen.getByRole('form', { name: 'Edit entry' })).toBeVisible();
  });

  test('a legacy entry without times opens with empty times and asks for them', async () => {
    const legacy: Entry = { ...first, needs_time: true };
    delete legacy.start_time;
    delete legacy.end_time;
    serveEntries([legacy]);
    const calls = recordUpdates((body, id) => HttpResponse.json(entryFromRequest(body, id)));
    const user = renderPage();
    await startEditing(user);
    expect(field('Start time')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Start time is required.')).toBeVisible();
    expect(calls).toHaveLength(0);
  });

  test('approved entries are locked: no Edit or Delete', async () => {
    serveEntries([{ ...first, status: 'approved' }, second]);
    renderPage();
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: editLabel })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: deleteLabel })).not.toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit entry: Jan 5, 2026, Staff Meetings' })).toBeVisible();
  });
});

describe('deleting an entry', () => {
  function recordDeletes(respond: () => Response = () => new HttpResponse(null, { status: 204 })) {
    const calls: string[] = [];
    server.use(
      http.delete(`${API}/entries/:entryId`, ({ params }) => {
        calls.push(String(params.entryId));
        return respond();
      }),
    );
    return calls;
  }

  test('asks first, names the entry, and deletes only after confirming', async () => {
    const items = serveEntries([...sampleEntries]);
    const calls = recordDeletes(() => {
      items.shift();
      return new HttpResponse(null, { status: 204 });
    });
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: deleteLabel }));

    const dialog = await screen.findByRole('dialog', { name: 'Delete this entry?' });
    expect(within(dialog).getByText('Jan 12, 2026, 13:00 to 14:15, Individual Counseling')).toBeVisible();
    expect(within(dialog).getByText('This cannot be undone.')).toBeVisible();
    expect(calls).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Delete entry' }));
    expect(await screen.findByText('Entry deleted.')).toBeVisible();
    expect(calls).toEqual([first.id]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: deleteLabel })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Entries' })).toHaveFocus();
  });

  test('the confirmation works from the keyboard: Escape keeps the entry and returns focus to Delete', async () => {
    const calls = recordDeletes();
    const user = renderPage();
    const button = await screen.findByRole('button', { name: deleteLabel });
    button.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('dialog', { name: 'Delete this entry?' });

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(calls).toHaveLength(0);
  });

  test('Tab reaches Keep entry then Delete entry, and Enter on Delete entry deletes', async () => {
    const calls = recordDeletes();
    const user = renderPage();
    (await screen.findByRole('button', { name: deleteLabel })).focus();
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Delete this entry?' });

    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Keep entry' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Delete entry' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Keep entry' })).toHaveFocus();
    await user.tab();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(calls).toEqual([first.id]);
    });
  });

  test('Keep entry closes the dialog without deleting', async () => {
    const calls = recordDeletes();
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: deleteLabel }));
    await user.click(await screen.findByRole('button', { name: 'Keep entry' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
    expect(screen.getByRole('button', { name: deleteLabel })).toHaveFocus();
  });

  test('a failed delete keeps the dialog open with the reason, so it can be retried', async () => {
    let attempts = 0;
    const calls = recordDeletes(() => {
      attempts += 1;
      return attempts === 1 ? new HttpResponse(null, { status: 503 }) : new HttpResponse(null, { status: 204 });
    });
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: deleteLabel }));
    await user.click(await screen.findByRole('button', { name: 'Delete entry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The entry could not be deleted. Try again.');
    expect(screen.getByRole('dialog')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
    expect(await screen.findByText('Entry deleted.')).toBeVisible();
    expect(calls).toHaveLength(2);
  });

  test('an entry already deleted elsewhere is reported as gone', async () => {
    recordDeletes(() =>
      problemResponse({ type: 'urn:therapy-service-hours:problem:not-found', title: 'Not found', status: 404 }),
    );
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: deleteLabel }));
    await user.click(await screen.findByRole('button', { name: 'Delete entry' }));
    expect(await screen.findByText('That entry was already deleted.')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('an entry approved in the meantime cannot be deleted and says so', async () => {
    recordDeletes(() =>
      problemResponse({
        type: LOCKED,
        title: 'Entry locked',
        status: 409,
      }),
    );
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: deleteLabel }));
    await user.click(await screen.findByRole('button', { name: 'Delete entry' }));
    expect(await screen.findByText('This entry was approved, so it can no longer be deleted.')).toBeVisible();
  });

  test('deleting the entry being edited closes its edit form', async () => {
    recordDeletes();
    const user = renderPage();
    await startEditing(user);
    await user.click(screen.getByRole('button', { name: deleteLabel }));
    await user.click(await screen.findByRole('button', { name: 'Delete entry' }));
    expect(await screen.findByRole('form', { name: 'Add entry' })).toBeVisible();
  });
});

describe('the table with row actions', () => {
  test('has an Actions column whose widths still add up to 100% when a column is resized', async () => {
    const user = renderPage();
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Actions' })).toBeVisible();

    const percentages = () =>
      [...table.querySelectorAll<HTMLElement>('col')].map((col) =>
        Number.parseFloat(col.style.getPropertyValue('--col-width')),
      );
    expect(percentages()).toHaveLength(8);
    const [handle] = within(table).getAllByRole('slider');
    if (!handle) throw new Error('no resize handle');
    handle.focus();
    await user.keyboard('{ArrowRight}');
    const total = percentages().reduce((a, b) => a + b, 0);
    expect(Math.round(total * 10) / 10).toBe(100);
  });
});

describe('accessibility', () => {
  const serious = (result: axe.AxeResults) =>
    result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

  test('the page has no serious violations while editing, with an overlap error, and with the dialog open', async () => {
    recordUpdates(() => overlapResponse());
    const user = renderPage();
    await startEditing(user);
    expect(serious(await axe.run(document.body))).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await within(form('Edit entry')).findByText(OVERLAP_TEXT);
    expect(serious(await axe.run(document.body))).toEqual([]);

    await user.click(screen.getByRole('button', { name: deleteLabel }));
    await screen.findByRole('dialog');
    expect(serious(await axe.run(document.body))).toEqual([]);
  });
});
