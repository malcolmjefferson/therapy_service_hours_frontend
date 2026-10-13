import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { FormField } from '../FormField';
import { Select, type SelectGroup } from './Select';

const groups: SelectGroup[] = [
  { label: 'Direct Service', options: [{ value: 'individual', label: 'Individual Counseling' }] },
  {
    label: 'Supervision',
    options: [
      { value: 'group-sup', label: 'Group Supervision' },
      { value: 'retired', label: 'Retired Category', disabled: true },
    ],
  },
];

function Controlled({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <FormField label="Category">
      {(control) => (
        <Select
          {...control}
          groups={groups}
          placeholder="Choose a category"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onChange?.(e.target.value);
          }}
        />
      )}
    </FormField>
  );
}

describe('Select', () => {
  test('groups options under headings', () => {
    render(<Controlled />);
    const direct = screen.getByRole('group', { name: 'Direct Service' });
    expect(within(direct).getByRole('option', { name: 'Individual Counseling' })).toBeInTheDocument();
    const supervision = screen.getByRole('group', { name: 'Supervision' });
    expect(within(supervision).getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('option', { name: 'Choose a category' })).toHaveValue('');
  });

  test('is a labelled combobox the user can change by keyboard', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const select = screen.getByRole('combobox', { name: 'Category' });
    const user = userEvent.setup();
    await user.tab();
    expect(select).toHaveFocus();
    await user.selectOptions(select, 'Group Supervision');
    expect(onChange).toHaveBeenLastCalledWith('group-sup');
    expect(select).toHaveValue('group-sup');
  });

  test('does not allow choosing a disabled option', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'retired');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('has no axe violations', async () => {
    const { container } = render(<Controlled />);
    const results = await axe.run(container, { resultTypes: ['violations'] });
    expect(results.violations).toEqual([]);
  });
});
