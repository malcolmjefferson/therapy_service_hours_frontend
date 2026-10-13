import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, test } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  test.each(['gold', 'lime', 'red'] as const)('renders its text in the %s tone', (tone) => {
    render(<Badge tone={tone}>Direct Service</Badge>);
    const badge = screen.getByText('Direct Service');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toContain(tone);
  });

  test('renders user text as text, not markup', () => {
    render(<Badge tone="gold">{'<b>A</b>'}</Badge>);
    expect(screen.getByText('<b>A</b>')).toBeInTheDocument();
  });

  test('has no axe violations', async () => {
    const { container } = render(<Badge tone="red">Supervision</Badge>);
    const results = await axe.run(container, { resultTypes: ['violations'] });
    expect(results.violations).toEqual([]);
  });
});
