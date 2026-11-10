import { RequireSignIn } from '../features/auth';
import { EntriesPage } from '../features/entries';
import { GoalCardsRow } from '../features/goals';
import styles from './EntriesRoute.module.css';

/** `/app/entries`: the goal cards above the add and edit form and entries table, for signed-in users only. It is its own chunk (FE-54). */
export function EntriesRoute() {
  return (
    <RequireSignIn>
      <div className={styles.route}>
        <GoalCardsRow />
        <EntriesPage />
      </div>
    </RequireSignIn>
  );
}
