import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ToastProvider } from '../../../components';
import { API, problemResponse } from '../../../test/handlers';
import { renderWithProviders } from '../../../test/render';
import { server } from '../../../test/server';
import { ImportButton } from './ImportButton';

let saved: string[];
let blobs: Blob[];

beforeEach(() => {
  saved = [];
  blobs = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return 'blob:test';
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.download);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

function setup(onImported?: () => void) {
  renderWithProviders(
    <ToastProvider>
      <ImportButton onImported={onImported} />
    </ToastProvider>,
  );
  return userEvent.setup({ applyAccept: false });
}

const ledger = () => new File(['# Clinical Hours Ledger\n'], 'ledger.md', { type: '' });

async function openAndChoose(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.click(screen.getByRole('button', { name: 'Import' }));
  const dialog = await screen.findByRole('dialog', { name: 'Import a Markdown ledger' });
  await user.upload(within(dialog).getByLabelText('Markdown ledger (.md)'), file);
  return dialog;
}

describe('ImportDialog', () => {
  test('uploads the file as multipart with an idempotency key and shows the report', async () => {
    let seen: { key: string | null; type: string | null; name: string | null; contentType: string | null } | undefined;
    server.use(
      http.post(`${API}/import/markdown`, async ({ request }) => {
        const form = await request.formData();
        const file = form.get('file') as { name?: string; type?: string } | null;
        seen = {
          key: request.headers.get('Idempotency-Key'),
          type: file?.type ?? null,
          name: file?.name ?? null,
          contentType: request.headers.get('Content-Type'),
        };
        return HttpResponse.json({
          total_rows: 3,
          imported_count: 2,
          needs_time_count: 1,
          merged_clients: [{ client: { id: '00000000-0000-4000-8000-0000000000d1', name: 'A.B.' }, created: true }],
          skipped_count: 1,
          skipped_rows: [{ row: 3, reason: 'invalid-hours', field: 'hours', message: 'Hours must be a number.' }],
        });
      }),
    );
    const onImported = vi.fn();
    const user = setup(onImported);
    const dialog = await openAndChoose(user, ledger());
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));

    const report = await screen.findByRole('dialog', { name: 'Import report' });
    expect(within(report).getByRole('status')).toHaveTextContent('Imported 2 entries of 3 rows.');
    expect(within(report).getByRole('cell', { name: 'Hours are not valid' })).toBeInTheDocument();
    expect(within(report).getByRole('cell', { name: 'Hours must be a number.' })).toBeInTheDocument();
    expect(seen?.key).toMatch(/^[0-9a-f-]{36}$/);
    // jsdom's File is rewrapped by the fetch polyfill, so the file name is not asserted here; the type is.
    expect(seen?.type).toBe('text/markdown');
    expect(seen?.contentType).toMatch(/^multipart\/form-data; boundary=/);
    await waitFor(() => {
      expect(onImported).toHaveBeenCalledTimes(1);
    });
  });

  test('downloads the report as a text file', async () => {
    const user = setup();
    const dialog = await openAndChoose(user, ledger());
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    const report = await screen.findByRole('dialog', { name: 'Import report' });
    await user.click(within(report).getByRole('button', { name: 'Download report' }));

    expect(saved).toEqual([expect.stringMatching(/^import-report-\d{4}-\d{2}-\d{2}\.txt$/)]);
    expect(await blobs[0]?.text()).toContain('- Row 2: Already imported.');
  });

  test('refuses a wrong file type before sending anything', async () => {
    const user = setup();
    const dialog = await openAndChoose(user, new File(['a,b'], 'ledger.csv', { type: 'text/csv' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Choose a Markdown ledger file');
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  test('explains a refused file and allows another try with the same key', async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.post(`${API}/import/markdown`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        return keys.length === 1
          ? problemResponse({
              type: 'urn:therapy-service-hours:problem:import-too-many-rows',
              title: 'Too many rows',
              status: 413,
            })
          : HttpResponse.json({
              total_rows: 1,
              imported_count: 1,
              needs_time_count: 0,
              merged_clients: [],
              skipped_count: 0,
              skipped_rows: [],
            });
      }),
    );
    const user = setup();
    const dialog = await openAndChoose(user, ledger());
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('more than 5,000 entries');

    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await screen.findByRole('dialog', { name: 'Import report' })).toBeInTheDocument();
    expect(keys[0]).toBe(keys[1]);
  });

  test('says nothing was saved when the server cannot be reached', async () => {
    server.use(http.post(`${API}/import/markdown`, () => HttpResponse.error()));
    const user = setup();
    const dialog = await openAndChoose(user, ledger());
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('nothing was saved');
  });

  test('closes with Escape and returns focus to the Import button', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Import' })).toHaveFocus();
  });

  test('shows progress while importing and cannot be closed meanwhile', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${API}/import/markdown`, async () => {
        await gate;
        return HttpResponse.json({
          total_rows: 0,
          imported_count: 0,
          needs_time_count: 0,
          merged_clients: [],
          skipped_count: 0,
          skipped_rows: [],
        });
      }),
    );
    const user = setup();
    const dialog = await openAndChoose(user, ledger());
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await within(dialog).findByRole('progressbar', { name: 'Importing' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Importing…' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    release();
    expect(await screen.findByText('The file has no entries to import.')).toBeInTheDocument();
  });
});
