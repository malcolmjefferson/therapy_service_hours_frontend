import styles from './EntriesTable.module.css';

/** Nothing to list: either no entries yet or none that match the filters (FE-33). */
export function EntriesEmpty({ filtered }: { filtered: boolean }) {
  return filtered ? (
    <p className={styles.empty}>No entries match these filters. Clear the filters to see everything.</p>
  ) : (
    <p className={styles.empty}>No entries yet. Sessions you log will appear here, newest first.</p>
  );
}
