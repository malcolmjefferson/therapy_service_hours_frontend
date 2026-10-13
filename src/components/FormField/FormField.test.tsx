import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, test } from 'vitest';
import { Input } from '../Input';
import { FormField } from './FormField';

function Field({ error, hint }: { error?: string; hint?: string }) {
  return (
    <FormField label="Start time" error={error} hint={hint}>
      {(control) => <Input {...control} type="time" step={900} />}
    </FormField>
  );
}

describe('FormField', () => {
  test('labels the control so it is found by its label and focused by clicking the label', async () => {
    render(<Field />);
    const input = screen.getByLabelText('Start time');
    await userEvent.setup().click(screen.getByText('Start time'));
    expect(input).toHaveFocus();
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  test('links an inline error to the control and marks it invalid', () => {
    render(<Field error="End must be after start" />);
    const input = screen.getByLabelText('Start time');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('End must be after start');
  });

  test('announces an error that appears after the field was first shown', async () => {
    const { rerender } = render(<Field />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<Field error="Pick a time in 15-minute steps" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Pick a time in 15-minute steps');
  });

  test('describes the control with both the hint and the error', () => {
    render(<Field hint="Local clock time" error="Required" />);
    expect(screen.getByLabelText('Start time')).toHaveAccessibleDescription('Local clock time Required');
  });

  test('gives each field its own id', () => {
    render(
      <>
        <Field />
        <FormField label="End time">{(control) => <Input {...control} type="time" />}</FormField>
      </>,
    );
    expect(screen.getByLabelText('Start time').id).not.toBe(screen.getByLabelText('End time').id);
  });

  test.each([{}, { error: 'Required', hint: 'Local clock time' }])('has no axe violations (%o)', async (props) => {
    const { container } = render(<Field {...props} />);
    const results = await axe.run(container, { resultTypes: ['violations'] });
    expect(results.violations).toEqual([]);
  });
});
