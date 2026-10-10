import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { renderApp } from '../test/render';

describe('routes', () => {
  test('the shell shows the app title on every page', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Clinical Hours Ledger' })).toBeInTheDocument();
  });

  test('an unknown path shows a not-found page inside the shell', async () => {
    renderApp('/no/such/page');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Clinical Hours Ledger' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the start page' })).toHaveAttribute('href', '/');
  });
});
