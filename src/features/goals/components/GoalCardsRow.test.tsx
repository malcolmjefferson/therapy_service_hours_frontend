import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { API, problemResponse, sampleGoals } from '../../../test/handlers';
import { renderWithProviders } from '../../../test/render';
import { server } from '../../../test/server';
import { GoalCardsRow } from './GoalCardsRow';

function renderRow() {
  renderWithProviders(<GoalCardsRow />);
  return userEvent.setup();
}

async function card(name: string) {
  return within(await screen.findByRole('article', { name }));
}

describe('goal cards row', () => {
  test('shows the four goals in order with approved hours and a progress bar', async () => {
    renderRow();
    const direct = await card('Direct Service');
    expect(direct.getByText('312.50')).toBeInTheDocument();
    expect(direct.getByRole('progressbar', { name: 'Direct Service' })).toHaveAttribute(
      'aria-valuetext',
      '312.5 of 1200 hours approved, 20 pending',
    );
    expect(direct.getByText(/20\.00 hours pending/)).toBeInTheDocument();
    const titles = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(titles).toEqual(['Direct Service', 'Supervision', 'Total Activity', 'Total Time On-site']);
  });

  test('the Supervision card shows the group and individual split', async () => {
    renderRow();
    const supervision = await card('Supervision');
    expect(supervision.getByText('Group')).toBeInTheDocument();
    expect(supervision.getByText('15.00 approved, 1.50 pending')).toBeInTheDocument();
    expect(supervision.getByText('Individual')).toBeInTheDocument();
    expect(supervision.getByText('25.00 approved, 2.00 pending')).toBeInTheDocument();
  });

  test('the On-site card has no target, no bar and no edit button', async () => {
    renderRow();
    const onSite = await card('Total Time On-site');
    expect(onSite.getByText('Tracked only, no target.')).toBeInTheDocument();
    expect(onSite.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(onSite.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Edit target/ })).toHaveLength(3);
  });

  test('shows a percent over 100 as is', async () => {
    server.use(
      http.get(`${API}/goals/progress`, () =>
        HttpResponse.json({
          goals: [{ ...sampleGoals.goals[1], approved_hours: 108, approved_percent: 108 }],
        }),
      ),
    );
    renderRow();
    expect((await card('Supervision')).getByText(/\(108%\)/)).toBeInTheDocument();
  });

  test('shows an error with a retry when the goals cannot be loaded', async () => {
    let fail = true;
    server.use(http.get(`${API}/goals/progress`, () => (fail ? HttpResponse.error() : HttpResponse.json(sampleGoals))));
    const user = renderRow();
    expect(await screen.findByRole('alert')).toHaveTextContent('Your goals could not be loaded.');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await card('Direct Service');
  });

  test('shows a message when there are no goals', async () => {
    server.use(http.get(`${API}/goals/progress`, () => HttpResponse.json({ goals: [] })));
    renderRow();
    expect(await screen.findByText('No goals to show yet.')).toBeInTheDocument();
  });

  test('has no serious or critical axe violations, with the dialog open too', async () => {
    const user = renderRow();
    await card('Direct Service');
    const run = async () =>
      (await axe.run(document.body)).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(await run()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Edit target for Direct Service' }));
    await screen.findByRole('dialog');
    expect(await run()).toEqual([]);
  });
});

describe('editing a target', () => {
  async function openDialog(user: ReturnType<typeof userEvent.setup>, goal = 'Direct Service') {
    await user.click(await screen.findByRole('button', { name: `Edit target for ${goal}` }));
    return screen.findByRole('dialog', { name: `Edit ${goal} target` });
  }

  test('saving updates the bar right away and closes the dialog', async () => {
    let sent: unknown;
    let saved = false;
    server.use(
      http.put(`${API}/goals/direct`, async ({ request }) => {
        sent = await request.json();
        saved = true;
        return HttpResponse.json({ goal_type: 'direct', target_hours: 600 });
      }),
      // After the save the server reports the new target, as the real API does when the cards refetch.
      http.get(`${API}/goals/progress`, () =>
        HttpResponse.json({
          goals: sampleGoals.goals.map((goal) =>
            saved && goal.goal_type === 'direct'
              ? { ...goal, target_hours: 600, approved_percent: 52, pending_percent: 3 }
              : goal,
          ),
        }),
      ),
    );
    const user = renderRow();
    const dialog = await openDialog(user);
    const input = within(dialog).getByLabelText('Target (hours)');
    expect(input).toHaveValue('1200');
    await user.clear(input);
    await user.type(input, '600');
    await user.click(within(dialog).getByRole('button', { name: 'Save target' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(sent).toEqual({ target_hours: 600 });
    expect(await screen.findByText('Direct Service target saved.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Direct Service' })).toHaveAttribute(
      'aria-valuetext',
      '312.5 of 600 hours approved, 20 pending',
    );
  });

  test.each([
    ['', 'Enter a target in hours.'],
    ['12.5', 'Enter a whole number of hours, such as 1200.'],
    ['0', 'The target must be at least 1 hour.'],
  ])('refuses %j with a message and sends nothing', async (text, message) => {
    let calls = 0;
    server.use(
      http.put(`${API}/goals/direct`, () => {
        calls += 1;
        return HttpResponse.json({ goal_type: 'direct', target_hours: 1 });
      }),
    );
    const user = renderRow();
    const dialog = await openDialog(user);
    const input = within(dialog).getByLabelText('Target (hours)');
    await user.clear(input);
    if (text) await user.type(input, text);
    await user.click(within(dialog).getByRole('button', { name: 'Save target' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(calls).toBe(0);
  });

  test('shows the server message on the field when the server refuses the target', async () => {
    server.use(
      http.put(`${API}/goals/direct`, () =>
        problemResponse({
          type: 'urn:therapy-service-hours:problem:validation',
          title: 'Validation failed',
          status: 400,
          errors: [{ field: 'target_hours', message: 'Target is too large.' }],
        }),
      ),
    );
    const user = renderRow();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Save target' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Target is too large.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('keeps the dialog open with a plain message when the server is unreachable', async () => {
    server.use(http.put(`${API}/goals/direct`, () => HttpResponse.error()));
    const user = renderRow();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Save target' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The server could not be reached.');
  });

  test('Cancel closes the dialog without saving and returns focus to the button', async () => {
    const user = renderRow();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit target for Direct Service' })).toHaveFocus();
  });
});
