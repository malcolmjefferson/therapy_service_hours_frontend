import type { ComponentPropsWithRef } from 'react';
import control from '../FormField/control.module.css';

export type InputProps = ComponentPropsWithRef<'input'>;

/** A native `<input>` in the shared control style. Pair it with `FormField` for its label and error. */
export function Input({ className, ...rest }: InputProps) {
  return <input {...rest} className={[control.control, className].filter(Boolean).join(' ')} />;
}
