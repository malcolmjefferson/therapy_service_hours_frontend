import { screen } from '@testing-library/react';
import axe from 'axe-core';
import { expect, test } from 'vitest';
import { renderApp } from '../../test/render';

test('access-denied view gives a clear action and has no serious accessibility violations', async () => {
  renderApp('/access-denied');
  expect(await screen.findByRole('heading', { name: 'Access has not been granted' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to sign-in' })).toHaveAttribute('href', '/');
  const result = await axe.run(document.body);
  expect(
    result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical'),
  ).toEqual([]);
});
