import { useId, useState, type CSSProperties } from 'react';
import { DEFAULT_WIDTHS, resizeEdge, toPercent, type ColumnWidths } from '../model/columnWidths';
import type { EntriesView, EntrySortField } from '../model/viewState';
import { ariaSortFor, sortLabels } from '../model/viewState';
import { ColumnResizer } from './ColumnResizer';
import { EntryTableRow, type EntryRow } from './EntryTableRow';
import { SortButton } from './SortButton';
import styles from './EntriesTable.module.css';

export interface EntriesTableProps {
  entries: readonly EntryRow[];
  view: EntriesView;
  onSort: (field: EntrySortField) => void;
}

/** The columns left to right, matching `DEFAULT_WIDTHS`. A column with a `sort` field is a sort button. */
const columns: readonly { key: string; label: string; sort?: EntrySortField; className?: string | undefined }[] = [
  { key: 'date', label: sortLabels.session_date, sort: 'session_date' },
  { key: 'time', label: 'Time' },
  { key: 'category', label: sortLabels.category, sort: 'category' },
  { key: 'client', label: sortLabels.client, sort: 'client' },
  { key: 'hours', label: sortLabels.hours, sort: 'hours', className: styles.number },
  { key: 'on-site', label: sortLabels.on_site, sort: 'on_site' },
  { key: 'notes', label: 'Notes' },
];

/**
 * The sortable entries table with resizable columns. It fetches nothing (FE-10). Column widths are
 * percentages that always add up to 100%, kept in component state: they reset on reload.
 */
export function EntriesTable({ entries, view, onSort }: EntriesTableProps) {
  const [widths, setWidths] = useState<ColumnWidths>(DEFAULT_WIDTHS);
  const idPrefix = useId();
  const resize = (base: ColumnWidths, index: number, delta: number) => {
    setWidths(resizeEdge(base, index, delta));
  };

  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>
          Your entries, sorted by {sortLabels[view.sort]}, {view.dir === 'asc' ? 'ascending' : 'descending'}
        </caption>
        <colgroup>
          {columns.map((column, i) => (
            <col
              key={column.key}
              className={styles.col}
              style={{ '--col-width': `${String(toPercent(widths[i] ?? 0))}%` } as CSSProperties}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column, i) => {
              const labelId = `${idPrefix}-${column.key}`;
              const isLast = i === columns.length - 1;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={column.sort ? ariaSortFor(view, column.sort) : undefined}
                  aria-labelledby={labelId}
                  className={[styles.head, column.className].filter(Boolean).join(' ')}
                >
                  {column.sort ? (
                    <SortButton
                      field={column.sort}
                      id={labelId}
                      onSort={onSort}
                      arrow={arrowFor(ariaSortFor(view, column.sort))}
                    />
                  ) : (
                    <span id={labelId} className={styles.headLabel}>
                      {column.label}
                    </span>
                  )}
                  {isLast ? null : <ColumnResizer label={column.label} index={i} widths={widths} onResize={resize} />}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <EntryTableRow key={entry.id} entry={entry} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function arrowFor(sort: 'ascending' | 'descending' | 'none'): '▲' | '▼' | '' {
  return sort === 'ascending' ? '▲' : sort === 'descending' ? '▼' : '';
}
