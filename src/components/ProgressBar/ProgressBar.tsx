import type { ComponentPropsWithoutRef, CSSProperties } from 'react';
import { clampHours, hoursText, segmentPercents } from './progress';
import styles from './ProgressBar.module.css';

// Tones are named for the theme colors; the goal that owns the bar picks its tone (CLAUDE.md §12.2).
const toneClass = {
  gold: styles.gold,
  lime: styles.lime,
  red: styles.red,
} as const;

const ticks = [styles.tick25, styles.tick50, styles.tick75].filter((tick): tick is string => tick !== undefined);

export type ProgressBarTone = keyof typeof toneClass;

export type ProgressBarProps = Omit<ComponentPropsWithoutRef<'div'>, 'role' | 'children' | 'style'> & {
  /** The accessible name, for example "Direct Service". */
  label: string;
  /** Approved hours: the solid fill. */
  approved: number;
  /** Pending hours: the lighter segment after the approved fill. */
  pending: number;
  /** The goal target in hours. */
  max: number;
  tone: ProgressBarTone;
};

/**
 * A ruler-style bar with ticks at 25, 50 and 75% (FR-GOAL-04). Approved hours are the value;
 * pending hours show as a lighter segment and do not count toward it (FR-GOAL-03).
 */
export function ProgressBar({ label, approved, pending, max, tone, className, ...rest }: ProgressBarProps) {
  const segments = segmentPercents(approved, pending, max);
  const classes = [styles.bar, toneClass[tone], className].filter(Boolean).join(' ');
  // Dynamic widths go through custom properties so no inline layout style is needed (FE-46).
  const vars = {
    '--approved-pct': String(segments.approved),
    '--pending-pct': String(segments.pending),
  } as CSSProperties;
  return (
    <div
      {...rest}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clampHours(approved, max)}
      aria-valuetext={hoursText(approved, pending, max)}
      className={classes}
      style={vars}
    >
      <span className={styles.approved} />
      <span className={styles.pending} />
      {ticks.map((tick) => (
        <span key={tick} className={[styles.tick, tick].join(' ')} aria-hidden="true" />
      ))}
    </div>
  );
}
