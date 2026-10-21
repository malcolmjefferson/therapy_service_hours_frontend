import type { EntriesView, EntrySortField } from '../model/viewState';
import { sortLabels } from '../model/viewState';
import { EntryTableRow, type EntryRow, type EntryRowActions } from './EntryTableRow';
import { SortableHeader } from './SortableHeader';
import styles from './EntriesTable.module.css';

export interface EntriesTableProps {
  entries: readonly EntryRow[];
  view: EntriesView;
  onSort: (field: EntrySortField) => void;
  /** Adds an Actions column with Edit and Delete on each pending or rejected entry. */
  actions?: EntryRowActions | undefined;
}

/** The sortable entries table. Presentational: it fetches nothing (FE-10). */
export function EntriesTable({ entries, view, onSort, actions }: EntriesTableProps) {
  const header = { view, onSort };
  return (
    <table className={styles.table}>
      <caption className={styles.srOnly}>
        Your entries, sorted by {sortLabels[view.sort]}, {view.dir === 'asc' ? 'ascending' : 'descending'}
      </caption>
      <thead>
        <tr>
          <SortableHeader field="session_date" {...header} />
          <th scope="col">Time</th>
          <SortableHeader field="category" {...header} />
          <SortableHeader field="client" {...header} />
          <SortableHeader field="hours" className={styles.number} {...header} />
          <SortableHeader field="on_site" {...header} />
          <th scope="col">Notes</th>
          {actions ? <th scope="col">Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <EntryTableRow key={entry.id} entry={entry} actions={actions} />
        ))}
      </tbody>
    </table>
  );
}
