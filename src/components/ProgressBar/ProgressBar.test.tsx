import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, test } from 'vitest';
import { ProgressBar } from './ProgressBar';

function renderBar(overrides: Partial<Parameters<typeof ProgressBar>[0]> = {}) {
  return render(
    <ProgressBar label="Direct Service" approved={312} pending={20} max={1200} tone="gold" {...overrides} />,
  );
}

describe('ProgressBar', () => {
  test('is a progressbar named by its label, with approved hours as the value', () => {
    renderBar();
    const bar = screen.getByRole('progressbar', { name: 'Direct Service' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '1200');
    expect(bar).toHaveAttribute('aria-valuenow', '312');
  });

  test('reads the approved and pending hours aloud', () => {
    renderBar();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '312 of 1200 hours approved, 20 pending');
  });

  test('sizes the approved and pending segments from the hours', () => {
    renderBar({ approved: 300, pending: 150 });
    const bar = screen.getByRole('progressbar');
    expect(bar.style.getPropertyValue('--approved-pct')).toBe('25');
    expect(bar.style.getPropertyValue('--pending-pct')).toBe('12.5');
  });

  test('does not count pending hours toward the value', () => {
    renderBar({ approved: 0, pending: 400 });
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar.style.getPropertyValue('--approved-pct')).toBe('0');
    expect(bar.style.getPropertyValue('--pending-pct')).not.toBe('0');
  });

  test('stays inside its range when approved hours pass the target', () => {
    renderBar({ approved: 1300, pending: 10 });
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '1200');
    expect(bar).toHaveAttribute('aria-valuetext', '1300 of 1200 hours approved, 10 pending');
    expect(bar.style.getPropertyValue('--approved-pct')).toBe('100');
    expect(bar.style.getPropertyValue('--pending-pct')).toBe('0');
  });

  test('draws three ticks and hides them from assistive technology', () => {
    const { container } = renderBar();
    const ticks = container.querySelectorAll('[aria-hidden="true"]');
    expect(ticks).toHaveLength(3);
    ticks.forEach((tick) => {
      expect(tick).toBeEmptyDOMElement();
    });
  });

  test.each(['gold', 'lime', 'red'] as const)('takes the %s tone', (tone) => {
    renderBar({ tone });
    expect(screen.getByRole('progressbar').className).toContain(tone);
  });

  test('passes a class name and other attributes through', () => {
    renderBar({ className: 'extra', id: 'direct-bar' });
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveClass('extra');
    expect(bar).toHaveAttribute('id', 'direct-bar');
  });

  test.each([
    ['empty', { approved: 0, pending: 0 }],
    ['partial', { approved: 312, pending: 20 }],
    ['full', { approved: 1200, pending: 0 }],
    ['no target', { max: 0 }],
  ])('has no axe violations when %s', async (_name, overrides) => {
    const { container } = renderBar(overrides);
    const results = await axe.run(container, { resultTypes: ['violations'] });
    expect(results.violations).toEqual([]);
  });
});
