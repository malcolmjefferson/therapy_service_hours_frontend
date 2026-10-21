import { sortLabels, type EntrySortField } from '../model/viewState';
import styles from './EntriesTable.module.css';

export interface SortButtonProps {
  field: EntrySortField;
  /** Id the column heading points at for its name, so a resize handle beside the button is not read as part of it. */
  id: string;
  onSort: (field: EntrySortField) => void;
  /** Direction arrow shown on the sorted column only. */
  arrow: '▲' | '▼' | '';
}

/** The button in a sortable column heading (FE-49). The `<th>` around it carries `aria-sort`. */
export function SortButton({ field, id, onSort, arrow }: SortButtonProps) {
  return (
    <button
      id={id}
      type="button"
      className={styles.sortButton}
      onClick={() => {
        onSort(field);
      }}
    >
      {sortLabels[field]}
      <span className={styles.arrow} aria-hidden="true">
        {arrow}
      </span>
    </button>
  );
}
