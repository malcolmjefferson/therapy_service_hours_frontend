import type { components } from '../../../lib/api';
import { formatHours } from '../model/goalCards';
import styles from './GoalCards.module.css';

type Split = components['schemas']['SupervisionSplit'];

/** How the Supervision hours divide between group and individual supervision (FR-GOAL-05). */
export function SupervisionSplit({ split }: { split: Split }) {
  const rows = [
    { label: 'Group', totals: split.group },
    { label: 'Individual', totals: split.individual },
  ];
  return (
    <dl className={styles.split}>
      {rows.map(({ label, totals }) => (
        <div key={label} className={styles.splitRow}>
          <dt>{label}</dt>
          <dd>
            {formatHours(totals.approved_hours)} approved, {formatHours(totals.pending_hours)} pending
          </dd>
        </div>
      ))}
    </dl>
  );
}
