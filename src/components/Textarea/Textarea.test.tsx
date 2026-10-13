import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, test } from 'vitest';
import { FormField } from '../FormField';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  test('is a native textarea found by its label, with native props passed through', async () => {
    render(<FormField label="Notes">{(control) => <Textarea {...control} rows={4} maxLength={20} />}</FormField>);
    const notes = screen.getByRole('textbox', { name: 'Notes' });
    expect(notes.tagName).toBe('TEXTAREA');
    expect(notes).toHaveAttribute('rows', '4');
    await userEvent.setup().type(notes, 'first{Enter}second');
    expect(notes).toHaveValue('first\nsecond');
  });

  test('links its hint and error and has no axe violations', async () => {
    const { container } = render(
      <FormField label="Notes" hint="Pseudonyms only." error="Too long">
        {(control) => <Textarea {...control} />}
      </FormField>,
    );
    expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription('Pseudonyms only. Too long');
    const results = await axe.run(container, { resultTypes: ['violations'] });
    expect(results.violations).toEqual([]);
  });
});
