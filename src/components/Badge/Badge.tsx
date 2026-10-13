import type { ComponentPropsWithoutRef } from 'react';
import styles from './Badge.module.css';

// Tones are named for the theme colors. Category groups map as Direct = gold, Indirect = lime,
// Supervision = red (CLAUDE.md §12.2); the feature that knows the group enum owns that map (FE-14).
const toneClass = {
  gold: styles.gold,
  lime: styles.lime,
  red: styles.red,
} as const;

export type BadgeTone = keyof typeof toneClass;

export type BadgeProps = ComponentPropsWithoutRef<'span'> & {
  tone: BadgeTone;
};

/** A small colored label. The text carries the meaning; color is reinforcement only. */
export function Badge({ tone, className, ...rest }: BadgeProps) {
  const classes = [styles.badge, toneClass[tone], className].filter(Boolean).join(' ');
  return <span {...rest} className={classes} />;
}
