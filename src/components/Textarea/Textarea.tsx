import type { ComponentPropsWithRef } from 'react';
import control from '../FormField/control.module.css';

export type TextareaProps = ComponentPropsWithRef<'textarea'>;

/** A native `<textarea>` in the shared control style. Pair it with `FormField` for its label and error. */
export function Textarea({ className, ...rest }: TextareaProps) {
  return <textarea {...rest} className={[control.control, className].filter(Boolean).join(' ')} />;
}
