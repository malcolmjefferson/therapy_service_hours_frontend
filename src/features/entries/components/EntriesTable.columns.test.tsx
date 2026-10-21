import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { heading, renderPanel, serveEntries } from './panelTestUtils';

beforeAll(() => {
  // jsdom has no pointer capture; the handle calls it to keep a drag going outside its own box.
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The percentage each column is given, read from the CSS variable on its <col>. */
function columnPercents(): number[] {
  const cols = document.querySelectorAll('col');
  return Array.from(cols, (col) => Number.parseFloat(col.style.getPropertyValue('--col-width')));
}

const total = (percents: readonly number[]) => Math.round(percents.reduce((a, b) => a + b, 0) * 10) / 10;
const handle = (column: string) => screen.getByRole('slider', { name: `Resize ${column} column` });

describe('resizable columns', () => {
  test('start as percentages that add up to 100', async () => {
    serveEntries(2);
    renderPanel();
    await screen.findByRole('table');
    const percents = columnPercents();
    expect(percents).toHaveLength(7);
    expect(total(percents)).toBe(100);
  });

  test('every column but the last has a handle, and headings keep their plain names', async () => {
    serveEntries(2);
    renderPanel();
    await screen.findByRole('table');
    expect(screen.getAllByRole('slider')).toHaveLength(6);
    expect(screen.queryByRole('slider', { name: 'Resize Notes column' })).toBeNull();
    for (const name of ['Date', 'Time', 'Category', 'Client', 'Hours', 'On-site', 'Notes']) {
      expect(heading(name)).toBeInTheDocument();
    }
  });

  test('a handle reports its column width to assistive technology', async () => {
    serveEntries(2);
    renderPanel();
    await screen.findByRole('table');
    const category = handle('Category');
    expect(category).toHaveAttribute('aria-valuenow', '16');
    expect(category).toHaveAttribute('aria-valuetext', '16% wide');
    expect(category).toHaveAttribute('aria-valuemin', '10');
    expect(category).toHaveAttribute('aria-valuemax', '20');
    expect(category).toHaveAttribute('tabindex', '0');
  });

  test('arrow keys move the edge 1% and the neighbour gives up what the column gains', async () => {
    serveEntries(2);
    const { user } = renderPanel();
    await screen.findByRole('table');
    const before = columnPercents();

    handle('Category').focus();
    await user.keyboard('{ArrowRight}');
    let after = columnPercents();
    expect(after[2]).toBe((before[2] ?? 0) + 1);
    expect(after[3]).toBe((before[3] ?? 0) - 1);
    expect(total(after)).toBe(100);
    expect(handle('Category')).toHaveAttribute('aria-valuenow', '17');

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    after = columnPercents();
    expect(after[2]).toBe((before[2] ?? 0) - 1);
    expect(total(after)).toBe(100);
  });

  test('a column cannot be squeezed below the minimum', async () => {
    serveEntries(2);
    const { user } = renderPanel();
    await screen.findByRole('table');
    handle('Category').focus();
    await user.keyboard('{ArrowRight}'.repeat(30));
    const percents = columnPercents();
    expect(percents[3]).toBe(10);
    expect(total(percents)).toBe(100);
  });

  test('dragging a handle with a pointer resizes by the share of the table width moved', async () => {
    serveEntries(2);
    renderPanel();
    const table = await screen.findByRole('table');
    vi.spyOn(table, 'getBoundingClientRect').mockReturnValue({ width: 1000 } as DOMRect);
    const before = columnPercents();
    const grip = handle('Category');

    fireEvent.pointerDown(grip, { clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 430, pointerId: 1 });
    let after = columnPercents();
    expect(after[2]).toBe((before[2] ?? 0) + 3);
    expect(after[3]).toBe((before[3] ?? 0) - 3);
    expect(total(after)).toBe(100);

    // The drag is measured from where it began, so going back past the start narrows the column.
    fireEvent.pointerMove(grip, { clientX: 390, pointerId: 1 });
    after = columnPercents();
    expect(after[2]).toBe((before[2] ?? 0) - 1);
    expect(total(after)).toBe(100);

    fireEvent.pointerUp(grip, { clientX: 390, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 700, pointerId: 1 });
    expect(columnPercents()).toEqual(after);
  });

  test('widths stay at 100% through a long drag past either end', async () => {
    serveEntries(2);
    renderPanel();
    const table = await screen.findByRole('table');
    vi.spyOn(table, 'getBoundingClientRect').mockReturnValue({ width: 1000 } as DOMRect);
    const grip = handle('Date');
    fireEvent.pointerDown(grip, { clientX: 100, pointerId: 1 });
    for (const x of [-5000, 5000, 300]) {
      fireEvent.pointerMove(grip, { clientX: x, pointerId: 1 });
      const percents = columnPercents();
      expect(total(percents)).toBe(100);
      expect(Math.min(...percents)).toBeGreaterThanOrEqual(10);
    }
  });

  test('sorting does not undo the widths', async () => {
    serveEntries(2);
    const { user } = renderPanel();
    await screen.findByRole('table');
    handle('Date').focus();
    await user.keyboard('{ArrowRight}');
    const resized = columnPercents();
    await user.click(screen.getByRole('button', { name: 'Hours' }));
    await screen.findByRole('table');
    expect(columnPercents()).toEqual(resized);
  });
});
