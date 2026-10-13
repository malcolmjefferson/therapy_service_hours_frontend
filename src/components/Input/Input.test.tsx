import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  test('is a native input that takes typing and native props', async () => {
    render(<Input aria-label="Client" maxLength={5} />);
    const input = screen.getByRole('textbox', { name: 'Client' });
    await userEvent.setup().type(input, 'ABCDEFG');
    expect(input).toHaveValue('ABCDE');
  });
});
