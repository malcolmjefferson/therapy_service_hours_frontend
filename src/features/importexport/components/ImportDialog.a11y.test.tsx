import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { API } from '../../../test/handlers';
import { renderWithProviders } from '../../../test/render';
import { server } from '../../../test/server';
import { ImportButton } from './ImportButton';

// FE-52: axe over the dialog in the states a person reaches. jsdom has no layout, so contrast is covered by the
// token tests in src/theme/contrast.test.ts.
async function seriousViolations() {
  const result = await axe.run(document.body);
  expect(result.passes.length).toBeGreaterThan(0);
  return result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
}

describe('the import dialog has no serious or critical axe violations', () => {
  test('when choosing a file, and when showing a report with skipped rows', async () => {
    server.use(
      http.post(`${API}/import/markdown`, () =>
        HttpResponse.json({
          total_rows: 2,
          imported_count: 1,
          needs_time_count: 1,
          merged_clients: [{ client: { id: '00000000-0000-4000-8000-0000000000d1', name: 'A.B.' }, created: true }],
          skipped_count: 1,
          skipped_rows: [{ row: 2, reason: 'overlap', message: 'Overlaps another session.' }],
        }),
      ),
    );
    renderWithProviders(<ImportButton />);
    const user = userEvent.setup({ applyAccept: false });
    await user.click(screen.getByRole('button', { name: 'Import' }));
    const dialog = await screen.findByRole('dialog');
    expect(await seriousViolations()).toEqual([]);

    await user.upload(
      within(dialog).getByLabelText('Markdown ledger (.md)'),
      new File(['# Clinical Hours Ledger\n'], 'ledger.md'),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    await screen.findByRole('table', { name: 'Skipped rows' });
    expect(await seriousViolations()).toEqual([]);
  });
});
