import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { EntryForm } from '../../entries';
import { server } from '../../../test/server';
import { API, problemResponse, sampleClients } from '../../../test/handlers';
import { renderWithProviders } from '../../../test/render';
import { ClientPicker } from './ClientPicker';

const [ab, cd, alpha] = sampleClients;
type Client = (typeof sampleClients)[number];
const NAME_TAKEN = 'urn:therapy-service-hours:problem:client-name-taken';

function Harness({ initial = [] }: { initial?: string[] }) {
  const [ids, setIds] = useState<string[]>(initial);
  return <ClientPicker selectedIds={ids} onChange={setIds} />;
}

function setup(initial: string[] = []) {
  const user = userEvent.setup();
  const view = renderWithProviders(<Harness initial={initial} />);
  return { user, ...view };
}

const trigger = () => screen.getByRole('button', { name: /Clients \/ groups/ });
const plus = () => screen.getByRole('button', { name: 'Add a new client or group' });

async function openList(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(trigger()).toBeEnabled();
  });
  await user.click(trigger());
  return screen.findByRole('checkbox', { name: 'A.B.' });
}

/**
 * Records the body and Idempotency-Key of every `POST /clients` and answers with `respond`. Whatever
 * the server would then hold (`persisted`) joins the list the next `GET /clients` returns.
 */
function recordCreates(respond: (name: string) => Response, persisted?: (name: string) => Client | undefined) {
  const calls: { name: string; key: string | null }[] = [];
  const saved: Client[] = [];
  server.use(
    http.get(`${API}/clients`, () => {
      const items = [...sampleClients, ...saved];
      return HttpResponse.json({ items, page: { page: 1, page_size: 200, total_items: items.length } });
    }),
    http.post(`${API}/clients`, async ({ request }) => {
      const { name } = (await request.json()) as { name: string };
      calls.push({ name, key: request.headers.get('Idempotency-Key') });
      const response = respond(name);
      const client = persisted?.(name);
      if (client) saved.push(client);
      return response;
    }),
  );
  return calls;
}

describe('choosing saved clients', () => {
  test('is a checkbox dropdown, not a list box, and warns about real names', async () => {
    const { user } = setup();
    await openList(user);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('checkbox')).toHaveLength(sampleClients.length);
    expect(screen.getByText('Use pseudonyms or initials only, never real names.')).toBeVisible();
  });

  test('selects several clients and says which in the closed dropdown', async () => {
    const { user } = setup();
    expect(trigger()).toHaveTextContent('Choose clients');
    await openList(user);
    await user.click(screen.getByRole('checkbox', { name: 'A.B.' }));
    await user.click(screen.getByRole('checkbox', { name: 'Group Alpha' }));
    expect(trigger()).toHaveTextContent('A.B., Group Alpha');
    await user.click(screen.getByRole('checkbox', { name: 'C.D.' }));
    expect(trigger()).toHaveTextContent('3 clients selected');
    await user.click(screen.getByRole('checkbox', { name: 'A.B.' }));
    expect(trigger()).toHaveTextContent('C.D., Group Alpha');
  });

  test('works from the keyboard: Enter opens, Space toggles, Escape closes and returns focus', async () => {
    const { user } = setup();
    await waitFor(() => {
      expect(trigger()).toBeEnabled();
    });
    trigger().focus();
    await user.keyboard('{Enter}');
    await user.tab();
    expect(screen.getByRole('checkbox', { name: 'A.B.' })).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('checkbox', { name: 'A.B.' })).toBeChecked();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveTextContent('A.B.');
  });

  test('closes when focus or a click leaves the picker', async () => {
    const { user } = setup();
    await openList(user);
    await user.click(document.body);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  test('stops at 50 clients: the rest are disabled and a note says why', async () => {
    const many = Array.from({ length: 51 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      name: `Client ${String(i + 1)}`,
    }));
    server.use(
      http.get(`${API}/clients`, () =>
        HttpResponse.json({ items: many, page: { page: 1, page_size: 200, total_items: many.length } }),
      ),
    );
    const { user } = setup(many.slice(0, 50).map((c) => c.id));
    await waitFor(() => {
      expect(trigger()).toHaveTextContent('50 clients selected');
    });
    await user.click(trigger());
    expect(await screen.findByRole('checkbox', { name: 'Client 51' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Client 1' })).toBeEnabled();
    expect(screen.getByText('An entry can have up to 50 clients.')).toBeVisible();
  });

  test('reads every page of saved clients', async () => {
    const pages = [
      { items: [ab, cd], page: { page: 1, page_size: 200, total_items: 3 } },
      { items: [alpha], page: { page: 2, page_size: 200, total_items: 3 } },
    ];
    server.use(
      http.get(`${API}/clients`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        return HttpResponse.json(pages[page - 1]);
      }),
    );
    const { user } = setup();
    await openList(user);
    expect(await screen.findByRole('checkbox', { name: 'Group Alpha' })).toBeInTheDocument();
  });

  test('explains an empty list and points at +', async () => {
    server.use(
      http.get(`${API}/clients`, () =>
        HttpResponse.json({ items: [], page: { page: 1, page_size: 200, total_items: 0 } }),
      ),
    );
    const { user } = setup();
    await waitFor(() => {
      expect(trigger()).toBeEnabled();
    });
    await user.click(trigger());
    expect(await screen.findByText('No saved clients yet. Use + to add one.')).toBeVisible();
  });

  test('shows a load failure with a way to try again', async () => {
    let fail = true;
    server.use(
      http.get(`${API}/clients`, () =>
        fail
          ? problemResponse({ type: 'urn:therapy-service-hours:problem:internal', title: 'Server error', status: 500 })
          : HttpResponse.json({ items: [ab], page: { page: 1, page_size: 200, total_items: 1 } }),
      ),
    );
    const { user } = setup();
    await user.click(trigger());
    expect(await screen.findByRole('alert')).toHaveTextContent('Your clients could not be loaded.');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('checkbox', { name: 'A.B.' })).toBeInTheDocument();
  });
});

describe('adding a client with +', () => {
  test('saves the name with an Idempotency-Key, selects it and returns focus to +', async () => {
    const created = (name: string) => ({ id: '00000000-0000-4000-8000-0000000000b1', name });
    const calls = recordCreates((name) => HttpResponse.json(created(name), { status: 201 }), created);
    const { user } = setup();
    await user.click(plus());
    const input = screen.getByRole('textbox', { name: 'New client or group' });
    expect(input).toHaveFocus();
    await user.type(input, '  E.F. ');
    await user.click(screen.getByRole('button', { name: 'Save client' }));

    await waitFor(() => {
      expect(trigger()).toHaveTextContent('E.F.');
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('E.F.');
    expect(calls[0]?.key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(screen.queryByRole('textbox', { name: 'New client or group' })).not.toBeInTheDocument();
    expect(screen.getByText('Saved "E.F." and selected it.')).toBeInTheDocument();
    expect(plus()).toHaveFocus();
  });

  test('a name that differs only in case selects the saved client and creates nothing', async () => {
    const calls = recordCreates(() => HttpResponse.json({}, { status: 500 }));
    const { user } = setup();
    await openList(user);
    await user.click(plus());
    await user.type(screen.getByRole('textbox', { name: 'New client or group' }), 'a.b.');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(trigger()).toHaveTextContent('A.B.');
    });
    expect(calls).toHaveLength(0);
    expect(screen.getByText('"A.B." is already saved. Selected it.')).toBeInTheDocument();
  });

  test('when the server says the name is taken, it selects the client the server returned', async () => {
    // Saved from another tab since this list loaded, so the local check cannot see it.
    const existing = { id: '00000000-0000-4000-8000-0000000000c9', name: 'G.H.' };
    const calls = recordCreates(
      () =>
        problemResponse({
          type: NAME_TAKEN,
          title: 'Client name already saved',
          status: 409,
          existing_client: existing,
        }),
      () => existing,
    );
    const { user } = setup();
    await user.click(plus());
    await user.type(screen.getByRole('textbox', { name: 'New client or group' }), 'g.h.');
    await user.click(screen.getByRole('button', { name: 'Save client' }));

    await waitFor(() => {
      expect(trigger()).toHaveTextContent('G.H.');
    });
    expect(calls).toHaveLength(1);
    expect(screen.getByText('"G.H." is already saved. Selected it.')).toBeInTheDocument();
  });

  test('refuses an empty name inline without calling the server', async () => {
    const calls = recordCreates(() => HttpResponse.json({}, { status: 500 }));
    const { user } = setup();
    await user.click(plus());
    await user.click(screen.getByRole('button', { name: 'Save client' }));
    const input = screen.getByRole('textbox', { name: 'New client or group' });
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name or initials for the client.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(calls).toHaveLength(0);
  });

  test('shows a server rejection in plain language and reuses the same key on retry', async () => {
    let attempts = 0;
    const created = (name: string) => ({ id: '00000000-0000-4000-8000-0000000000b2', name });
    const calls = recordCreates(
      (name) => {
        attempts += 1;
        return attempts === 1
          ? problemResponse({ type: 'urn:therapy-service-hours:problem:internal', title: 'Server error', status: 500 })
          : HttpResponse.json(created(name), { status: 201 });
      },
      (name) => (attempts === 2 ? created(name) : undefined),
    );
    const { user } = setup();
    await user.click(plus());
    await user.type(screen.getByRole('textbox', { name: 'New client or group' }), 'E.F.');
    await user.click(screen.getByRole('button', { name: 'Save client' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The client could not be saved. Try again.');
    expect(screen.getByRole('textbox', { name: 'New client or group' })).toHaveValue('E.F.');

    await user.click(screen.getByRole('button', { name: 'Save client' }));
    await waitFor(() => {
      expect(trigger()).toHaveTextContent('E.F.');
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.key).toBe(calls[0]?.key);
  });

  test('Escape and Cancel close the input without saving and return focus to +', async () => {
    const calls = recordCreates(() => HttpResponse.json({}, { status: 500 }));
    const { user } = setup();
    await user.click(plus());
    await user.type(screen.getByRole('textbox', { name: 'New client or group' }), 'E.F.');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'New client or group' })).not.toBeInTheDocument();
    expect(plus()).toHaveFocus();

    await user.click(plus());
    expect(screen.getByRole('textbox', { name: 'New client or group' })).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'New client or group' })).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  test('Enter saves the client and does not submit the entry form around it', async () => {
    const created = (name: string) => ({ id: '00000000-0000-4000-8000-0000000000b3', name });
    recordCreates((name) => HttpResponse.json(created(name), { status: 201 }), created);
    const onSubmit = vi.fn(() => Promise.resolve({ ok: true } as const));
    const user = userEvent.setup();
    renderWithProviders(<EntryForm categories={[]} onSubmit={onSubmit} clients={() => <Harness />} />);
    await user.click(plus());
    await user.type(screen.getByRole('textbox', { name: 'New client or group' }), 'E.F.{Enter}');
    await waitFor(() => {
      expect(trigger()).toHaveTextContent('E.F.');
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText('The entry was not added. Fix the fields marked below.')).not.toBeInTheDocument();
  });

  test('stops when the entry already has 50 clients', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      name: `Client ${String(i + 1)}`,
    }));
    server.use(
      http.get(`${API}/clients`, () =>
        HttpResponse.json({ items: many, page: { page: 1, page_size: 200, total_items: many.length } }),
      ),
    );
    const { user } = setup(many.map((c) => c.id));
    await waitFor(() => {
      expect(trigger()).toHaveTextContent('50 clients selected');
    });
    await user.click(plus());
    await user.type(screen.getByRole('textbox', { name: 'New client or group' }), 'Extra{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('An entry can have up to 50 clients. Clear one first.');
    expect(trigger()).toHaveTextContent('50 clients selected');
  });
});

describe('accessibility (FE-52)', () => {
  async function violations(container: HTMLElement) {
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    return results.violations.map((v) => v.id);
  }

  test('has no violations closed, open, or with the add input showing', async () => {
    const { user, container } = setup();
    await waitFor(() => {
      expect(trigger()).toBeEnabled();
    });
    expect(await violations(container)).toEqual([]);
    await openList(user);
    expect(await violations(container)).toEqual([]);
    await user.click(plus());
    expect(await violations(container)).toEqual([]);
    const input = screen.getByRole('textbox', { name: 'New client or group' });
    expect(within(input.closest('div') ?? container).getByText('New client or group')).toBeVisible();
  });
});
