import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { API } from '../test/handlers';
import { renderApp } from '../test/render';
import { server } from '../test/server';

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

  test('the entries page is for signed-in users: without a session it asks for nothing and shows no entries', async () => {
    let asked = false;
    server.use(
      http.get(`${API}/entries`, () => {
        asked = true;
        return HttpResponse.json({ items: [], page: { page: 1, page_size: 50, total_items: 0 } });
      }),
    );
    renderApp('/app/entries');
    expect(await screen.findByRole('heading', { level: 1, name: 'Clinical Hours Ledger' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'System status' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Entries' })).toBeNull();
    expect(asked).toBe(false);
  });
});
