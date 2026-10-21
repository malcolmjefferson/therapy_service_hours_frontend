import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, test, vi } from 'vitest';
import { ToastProvider, type SelectGroup } from '../../../components';
import type { SubmitEntry } from '../hooks/useEntryForm';
import { EntryForm } from './EntryForm';

const categories: SelectGroup[] = [
  { label: 'Direct Service', options: [{ value: 'cat-individual', label: 'Individual Counseling' }] },
  { label: 'Supervision', options: [{ value: 'cat-group-sup', label: 'Group Supervision' }] },
];

const saved: SubmitEntry = () => Promise.resolve({ ok: true });

function setup(onSubmit: SubmitEntry = saved) {
  const submit = vi.fn(onSubmit);
  const user = userEvent.setup();
  const view = render(
    <ToastProvider>
      <EntryForm categories={categories} onSubmit={submit} clients={() => <p>Client picker slot</p>} />
    </ToastProvider>,
  );
  return { user, submit, ...view };
}

async function fillTimes(user: ReturnType<typeof userEvent.setup>, start: string, end: string) {
  await user.type(screen.getByLabelText('Start time'), start);
  await user.type(screen.getByLabelText('End time'), end);
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Date'), '2026-10-12');
  await user.selectOptions(screen.getByLabelText('Category'), 'Individual Counseling');
  await fillTimes(user, '0900', '1015');
}

describe('EntryForm layout', () => {
  test('keeps the prototype order: date, category, start, end, hours, clients, on-site, notes', () => {
    setup();
    const form = screen.getByRole('form', { name: 'Add entry' });
    const text = form.textContent;
    const order = [
      'Date',
      'Category',
      'Start time',
      'End time',
      'Hours',
      'Client picker slot',
      'On-site',
      'Notes (optional)',
    ];
    const positions = order.map((label) => text.indexOf(label));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  test('time inputs step in 15 minutes', () => {
    setup();
    expect(screen.getByLabelText('Start time')).toHaveAttribute('step', '900');
    expect(screen.getByLabelText('End time')).toHaveAttribute('step', '900');
  });

  test('groups the categories under their headings', () => {
    setup();
    const select = screen.getByLabelText('Category');
    expect(within(select).getByRole('group', { name: 'Direct Service' })).toBeInTheDocument();
    expect(within(select).getByRole('group', { name: 'Supervision' })).toBeInTheDocument();
  });

  test('shows the pseudonym warning with the notes field', () => {
    setup();
    const warning = /pseudonyms or initials only.*supervisors can read your notes/i;
    expect(screen.getByText(warning)).toBeVisible();
    expect(screen.getByLabelText('Notes (optional)')).toHaveAccessibleDescription(warning);
  });
});

describe('calculated hours', () => {
  test('are read-only and update live as the times change', async () => {
    const { user } = setup();
    const hours = screen.getByLabelText('Hours');
    expect(hours.tagName).toBe('OUTPUT');
    expect(hours).toHaveTextContent('—');

    await fillTimes(user, '0900', '1015');
    expect(hours).toHaveTextContent('1.25');

    await user.clear(screen.getByLabelText('End time'));
    await user.type(screen.getByLabelText('End time'), '1130');
    expect(hours).toHaveTextContent('2.50');
  });

  test('show a dash while the end is not after the start', async () => {
    const { user } = setup();
    await fillTimes(user, '1000', '0900');
    expect(screen.getByLabelText('Hours')).toHaveTextContent('—');
  });
});

describe('adding an entry', () => {
  test('works by clicking Add entry, sends the typed values without hours, then clears the form', async () => {
    const { user, submit } = setup();
    await fillValid(user);
    await user.click(screen.getByLabelText('On-site'));
    await user.type(screen.getByLabelText('Notes (optional)'), 'Pseudonym A, intake');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      sessionDate: '2026-10-12',
      categoryId: 'cat-individual',
      startTime: '09:00',
      endTime: '10:15',
      clientIds: [],
      onSite: true,
      notes: 'Pseudonym A, intake',
    });
    expect(await screen.findByText('Entry added.')).toBeVisible();
    expect(screen.getByLabelText('Date')).toHaveValue('');
    expect(screen.getByLabelText('Hours')).toHaveTextContent('—');
  });

  test('works by pressing Enter in a field', async () => {
    const { user, submit } = setup();
    await fillValid(user);
    await user.type(screen.getByLabelText('Date'), '{Enter}');
    expect(submit).toHaveBeenCalledTimes(1);
  });

  test('Enter in the notes field starts a new line instead of submitting', async () => {
    const { user, submit } = setup();
    await fillValid(user);
    await user.type(screen.getByLabelText('Notes (optional)'), 'one{Enter}two');
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Notes (optional)')).toHaveValue('one\ntwo');
  });

  test('disables the button while saving so a double click adds one entry', async () => {
    let finish: () => void = () => undefined;
    const { user, submit } = setup(
      () =>
        new Promise((resolve) => {
          finish = () => {
            resolve({ ok: true });
          };
        }),
    );
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    const busy = screen.getByRole('button', { name: 'Adding…' });
    expect(busy).toBeDisabled();
    await user.click(busy);
    finish();
    expect(await screen.findByText('Entry added.')).toBeVisible();
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe('errors', () => {
  test('an empty form shows inline errors, announces them, focuses the first and shows a toast', async () => {
    const { user, submit } = setup();
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(submit).not.toHaveBeenCalled();
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((a) => a.textContent)).toEqual(
      expect.arrayContaining([
        'Date is required.',
        'Choose a category.',
        'Start time is required.',
        'End time is required.',
      ]),
    );
    expect(screen.getByLabelText('Date')).toHaveAccessibleDescription('Date is required.');
    expect(screen.getByLabelText('Date')).toBeInvalid();
    expect(screen.getByLabelText('Date')).toHaveFocus();
    expect(screen.getAllByText(/The entry was not added/).length).toBeGreaterThan(0);
  });

  test('an end before the start is reported on the end time', async () => {
    const { user, submit } = setup();
    await user.type(screen.getByLabelText('Date'), '2026-10-12');
    await user.selectOptions(screen.getByLabelText('Category'), 'Individual Counseling');
    await fillTimes(user, '1000', '0900');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('End time')).toHaveAccessibleDescription(
      'End time must be after the start time on the same day.',
    );
    expect(screen.getByLabelText('End time')).toHaveFocus();
  });

  test('an error clears as soon as the field is fixed', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(screen.getByLabelText('Date')).toBeInvalid();
    await user.type(screen.getByLabelText('Date'), '2026-10-12');
    expect(screen.getByLabelText('Date')).toBeValid();
    expect(screen.getByLabelText('Category')).toBeInvalid();
  });

  test('server field errors land on the matching input and the message is shown', async () => {
    const { user } = setup(() =>
      Promise.resolve({
        ok: false,
        message: 'That time overlaps another session.',
        fieldErrors: { startTime: 'Overlaps your 09:00 session on 2026-10-12.' },
      }),
    );
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect((await screen.findAllByText('That time overlaps another session.')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Start time')).toHaveAccessibleDescription(
      'Overlaps your 09:00 session on 2026-10-12.',
    );
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-12');
  });

  test('a failed request keeps what was typed and tells the person', async () => {
    const { user } = setup(() => Promise.reject(new Error('offline')));
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect((await screen.findAllByText(/could not be saved/)).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-12');
    expect(screen.getByRole('button', { name: 'Add entry' })).toBeEnabled();
  });
});

describe('accessibility', () => {
  test('has no axe violations when pristine', async () => {
    const { container } = setup();
    const results = await axe.run(container, { resultTypes: ['violations'] });
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations while showing every error', async () => {
    const { user, container } = setup();
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    const results = await axe.run(container, { resultTypes: ['violations'] });
    expect(results.violations).toEqual([]);
  });
});
