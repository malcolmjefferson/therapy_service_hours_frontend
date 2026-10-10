import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { renderApp } from '../../test/render';
import { API, problemResponse } from '../../test/handlers';
import { server } from '../../test/server';

describe('Status page', () => {
  test('shows the API version from healthz', async () => {
    renderApp('/');
    const status = await screen.findByRole('region', { name: 'System status' });
    expect(await within(status).findByText('test-build-1')).toBeInTheDocument();
    expect(within(status).getByText('Up')).toBeInTheDocument();
  });

  test('shows a loading state first', async () => {
    renderApp('/');
    expect(await screen.findByText('Checking the API…')).toBeInTheDocument();
  });

  test('explains a server problem in plain language and shows the reference, not the payload', async () => {
    server.use(
      http.get(`${API}/healthz`, () =>
        problemResponse({
          type: 'urn:therapy-service-hours:problem:internal',
          title: 'Internal Server Error',
          status: 500,
          request_id: 'req-abc123',
        }),
      ),
    );
    renderApp('/');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The API is having a problem right now');
    expect(alert).toHaveTextContent('req-abc123');
    expect(alert).not.toHaveTextContent('urn:therapy-service-hours');
  });

  test('explains a network failure and recovers on retry', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/healthz`, () => {
        calls += 1;
        return calls === 1 ? HttpResponse.error() : HttpResponse.json({ status: 'ok', version: 'after-retry' });
      }),
    );
    renderApp('/');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not reach the server');

    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('after-retry')).toBeInTheDocument();
  });

  test('has no serious or critical accessibility violations (FE-52)', async () => {
    const { container } = renderApp('/');
    await screen.findByText('test-build-1');
    const results = await axe.run(container, { resultTypes: ['violations'] });
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(blocking.map((v) => v.id)).toEqual([]);
  });
});
