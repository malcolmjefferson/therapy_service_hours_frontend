import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { KEY_STEP, MIN_WIDTH, TOTAL_WIDTH, toPercent, type ColumnWidths } from '../model/columnWidths';
import styles from './EntriesTable.module.css';

export interface ColumnResizerProps {
  /** Heading text of the column whose right edge this moves. */
  label: string;
  /** Index of that column. */
  index: number;
  widths: ColumnWidths;
  /** Moves the edge by `delta` tenths of a percent, starting from `base` (the widths when the move began). */
  onResize: (base: ColumnWidths, index: number, delta: number) => void;
}

interface Drag {
  startX: number;
  base: ColumnWidths;
  tablePx: number;
}

/**
 * The handle on a column's right edge. Drag it with a pointer, or focus it and press the left and
 * right arrow keys (1% a press). It is a slider for assistive technology: the column's width in percent. Widths are percentages, so the table stays 100% wide however the
 * columns are shared out.
 */
export function ColumnResizer({ label, index, widths, onResize }: ColumnResizerProps) {
  const drag = useRef<Drag | null>(null);
  const width = widths[index] ?? 0;
  const next = widths[index + 1] ?? 0;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const tablePx = event.currentTarget.closest('table')?.getBoundingClientRect().width ?? 0;
    if (tablePx <= 0) return;
    drag.current = { startX: event.clientX, base: widths, tablePx };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    onResize(current.base, index, ((event.clientX - current.startX) / current.tablePx) * TOTAL_WIDTH);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    onResize(widths, index, event.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP);
  };

  return (
    <div
      role="slider"
      aria-label={`Resize ${label} column`}
      aria-valuenow={toPercent(width)}
      aria-valuemin={toPercent(MIN_WIDTH)}
      aria-valuemax={toPercent(width + next - MIN_WIDTH)}
      aria-valuetext={`${String(toPercent(width))}% wide`}
      tabIndex={0}
      className={styles.resizer}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    />
  );
}
