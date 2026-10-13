import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { createRef } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  test('is a native button that does not submit a form unless asked', async () => {
    const onSubmit = vi.fn((e: React.SyntheticEvent) => {
      e.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <Button>Cancel</Button>
        <Button type="submit">Save</Button>
      </form>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('fires onClick by mouse, Enter and Space', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add entry</Button>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(screen.getByRole('button', { name: 'Add entry' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  test('does nothing when disabled and is skipped by Tab', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveFocus();
  });

  test('takes focus from the keyboard and forwards its ref and native props', async () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} variant="ghost" aria-describedby="why">
        Clear filters
      </Button>,
    );
    await userEvent.setup().tab();
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Clear filters' }));
    expect(ref.current).toHaveFocus();
    expect(ref.current).toHaveAttribute('aria-describedby', 'why');
  });

  test.each(['primary', 'ghost'] as const)('the %s variant has no axe violations', async (variant) => {
    const { container } = render(<Button variant={variant}>Save</Button>);
    const results = await axe.run(container, { resultTypes: ['violations'] });
    expect(results.violations).toEqual([]);
  });
});
