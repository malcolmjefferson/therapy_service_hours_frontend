import { Button } from '../../../components';
import type { components } from '../../../lib/api';
import { formatSessionDate, formatTimeRange } from '../model/format';
import { formatHours } from '../model/time';
import { GroupBadge } from './GroupBadge';
import styles from './EntriesTable.module.css';

type Entry = components['schemas']['Entry'];

/** The fields the table row reads (FE-19, FE-21). */
export type EntryRow = Pick<
  Entry,
  | 'id'
  | 'session_date'
  | 'start_time'
  | 'end_time'
  | 'duration_minutes'
  | 'category'
  | 'clients'
  | 'on_site'
  | 'notes'
  | 'status'
>;

export interface EntryRowActions {
  onEdit: (entry: EntryRow) => void;
  onDelete: (entry: EntryRow) => void;
}

/** One entry. Client names and notes render as plain text (FE-60). */
export function EntryTableRow({ entry, actions }: { entry: EntryRow; actions?: EntryRowActions | undefined }) {
  const times = formatTimeRange(entry.start_time, entry.end_time);
  const label = `${formatSessionDate(entry.session_date)}, ${entry.category.name}`;
  return (
    <tr>
      <td>
        <time dateTime={entry.session_date}>{formatSessionDate(entry.session_date)}</time>
      </td>
      <td className={styles.nowrap}>{times ?? <span className={styles.muted}>Needs time</span>}</td>
      <td>
        <GroupBadge group={entry.category.group} />
        <div className={styles.category}>{entry.category.name}</div>
      </td>
      <td>
        {entry.clients.length === 0 ? (
          <span className={styles.muted}>
            <span aria-hidden="true">—</span>
            <span className={styles.srOnly}>No clients</span>
          </span>
        ) : (
          <ul className={styles.clients}>
            {entry.clients.map((client) => (
              <li key={client.id}>{client.name}</li>
            ))}
          </ul>
        )}
      </td>
      <td className={styles.number}>{formatHours(entry.duration_minutes)}</td>
      <td>{entry.on_site ? 'Yes' : 'No'}</td>
      <td className={styles.notes}>{entry.notes}</td>
      {actions ? (
        <td>
          {entry.status === 'approved' ? (
            // Approved entries are locked: only pending and rejected ones can change (FR-LOG-05).
            <span className={styles.muted}>Locked</span>
          ) : (
            <div className={styles.rowActions}>
              <Button
                variant="ghost"
                data-entry-edit={entry.id}
                aria-label={`Edit entry: ${label}`}
                onClick={() => {
                  actions.onEdit(entry);
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                aria-label={`Delete entry: ${label}`}
                onClick={() => {
                  actions.onDelete(entry);
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </td>
      ) : null}
    </tr>
  );
}
