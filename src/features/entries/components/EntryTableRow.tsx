import type { components } from '../../../lib/api';
import { formatSessionDate, formatTimeRange } from '../model/format';
import { formatHours } from '../model/time';
import { GroupBadge } from './GroupBadge';
import styles from './EntriesTable.module.css';

type Entry = components['schemas']['Entry'];

/** The fields the table row reads (FE-19, FE-21). */
export type EntryRow = Pick<
  Entry,
  'id' | 'session_date' | 'start_time' | 'end_time' | 'duration_minutes' | 'category' | 'clients' | 'on_site' | 'notes'
>;

/** One entry. Client names and notes render as plain text (FE-60). */
export function EntryTableRow({ entry }: { entry: EntryRow }) {
  const times = formatTimeRange(entry.start_time, entry.end_time);
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
    </tr>
  );
}
