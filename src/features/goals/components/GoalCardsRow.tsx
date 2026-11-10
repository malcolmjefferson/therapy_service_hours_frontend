import { useState } from 'react';
import { Button, useToast } from '../../../components';
import { useGoalsProgressQuery } from '../api/useGoalsProgressQuery';
import { useUpdateGoalTarget } from '../api/useUpdateGoalTarget';
import { goalCardConfig, type GoalProgress } from '../model/goalCards';
import { EditTargetDialog } from './EditTargetDialog';
import { GoalCard } from './GoalCard';
import styles from './GoalCards.module.css';

/** The row of goal cards above the entries board (CLAUDE.md §12.1), with its loading, error and empty states. */
export function GoalCardsRow() {
  const query = useGoalsProgressQuery();
  const update = useUpdateGoalTarget();
  const toast = useToast();
  const [editing, setEditing] = useState<GoalProgress | null>(null);

  let body;
  if (query.data) {
    body =
      query.data.goals.length === 0 ? (
        <p role="status">No goals to show yet.</p>
      ) : (
        <div className={styles.row}>
          {query.data.goals.map((goal) => (
            <GoalCard key={goal.goal_type} goal={goal} onEditTarget={setEditing} />
          ))}
        </div>
      );
  } else if (query.isError) {
    body = (
      <div role="alert">
        <p>Your goals could not be loaded.</p>
        <Button
          variant="ghost"
          onClick={() => {
            void query.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  } else {
    body = (
      <p role="status" className={styles.loading}>
        Loading your goals…
      </p>
    );
  }

  return (
    <section aria-labelledby="goals-title" className={styles.section}>
      <h2 id="goals-title" className={styles.sectionTitle}>
        Goals
      </h2>
      {body}
      {editing?.target_hours != null ? (
        <EditTargetDialog
          title={goalCardConfig[editing.goal_type].title}
          currentTarget={editing.target_hours}
          saving={update.isPending}
          onSave={async (hours) => {
            await update.mutateAsync({ goalType: editing.goal_type, targetHours: hours });
            toast.show(`${goalCardConfig[editing.goal_type].title} target saved.`, { tone: 'success' });
            setEditing(null);
          }}
          onClose={() => {
            setEditing(null);
          }}
        />
      ) : null}
    </section>
  );
}
