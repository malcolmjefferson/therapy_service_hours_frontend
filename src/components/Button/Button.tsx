import type { ComponentPropsWithRef } from 'react';
import styles from './Button.module.css';

const variantClass = {
  primary: styles.primary,
  ghost: styles.ghost,
} as const;

export type ButtonVariant = keyof typeof variantClass;

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: ButtonVariant;
};

/** A real `<button>` (FE-17): `type="button"` unless the caller says otherwise, and every native prop passes through. */
export function Button({ variant = 'primary', type = 'button', className, ...rest }: ButtonProps) {
  const classes = [styles.button, variantClass[variant], className].filter(Boolean).join(' ');
  return <button {...rest} type={type} className={classes} />;
}
