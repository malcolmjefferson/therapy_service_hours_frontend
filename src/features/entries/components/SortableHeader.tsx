import { ariaSortFor, sortLabels, type EntriesView, type EntrySortField } from '../model/viewState';
import styles from './EntriesTable.module.css';

export interface SortableHeaderProps {
  field: EntrySortField;
  view: EntriesView;
  onSort: (field: EntrySortField) => void;
  /** Extra class for the cell, such as right alignment for numbers. */
  className?: string | undefined;
}

/** A column heading that is a real button inside a `<th>` carrying `aria-sort` (FE-49). */
export function SortableHeader({ field, view, onSort, className }: SortableHeaderProps) {
  const sort = ariaSortFor(view, field);
  return (
    <th scope="col" aria-sort={sort} className={className}>
      <button
        type="button"
        className={styles.sortButton}
        onClick={() => {
          onSort(field);
        }}
      >
        {sortLabels[field]}
        <span className={styles.arrow} aria-hidden="true">
          {sort === 'ascending' ? '▲' : sort === 'descending' ? '▼' : ''}
        </span>
      </button>
    </th>
  );
}
