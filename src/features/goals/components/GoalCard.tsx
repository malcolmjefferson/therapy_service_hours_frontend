import { Button, ProgressBar } from '../../../components';
import { formatHours, formatPercent, formatTarget, goalCardConfig, type GoalProgress } from '../model/goalCards';
import { SupervisionSplit } from './SupervisionSplit';
import styles from './GoalCards.module.css';

export interface GoalCardProps {
  goal: GoalProgress;
  onEditTarget: (goal: GoalProgress) => void;
}

/** One goal: approved hours against the target with a ruler bar, or tracked-only hours for On-site. */
export function GoalCard({ goal, onEditTarget }: GoalCardProps) {
  const config = goalCardConfig[goal.goal_type];
  const target = goal.target_hours;
  const hasBar = config.tone !== null && target !== null;
  return (
    <article className={styles.card} aria-label={config.title}>
      <h3 className={styles.cardTitle}>{config.title}</h3>
      <p className={styles.hours}>
        <span className={styles.hoursValue}>{formatHours(goal.approved_hours)}</span>
        {target === null ? ' hours approved' : ` / ${formatTarget(target)} hours approved`}
        {goal.approved_percent === null ? null : ` (${formatPercent(goal.approved_percent)})`}
      </p>
      {hasBar ? (
        <ProgressBar
          label={config.title}
          approved={goal.approved_hours}
          pending={goal.pending_hours}
          max={target}
          tone={config.tone}
        />
      ) : null}
      <p className={styles.pending}>{formatHours(goal.pending_hours)} hours pending</p>
      {target === null ? <p className={styles.note}>Tracked only, no target.</p> : null}
      {goal.supervision_split ? <SupervisionSplit split={goal.supervision_split} /> : null}
      {config.hasTarget ? (
        <Button
          variant="ghost"
          className={styles.edit}
          aria-label={`Edit target for ${config.title}`}
          onClick={() => {
            onEditTarget(goal);
          }}
        >
          Edit target
        </Button>
      ) : null}
    </article>
  );
}
