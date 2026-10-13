import { useId, type ReactNode } from 'react';
import styles from './FormField.module.css';

/** Props the field hands to its control so label, hint and error are wired the same way every time (FE-18). */
export interface FieldControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
}

export interface FormFieldProps {
  /** Visible label text. Every control has one (FE-38). */
  label: string;
  /** Inline error message; also sets `aria-invalid` and is announced when it appears. */
  error?: string | undefined;
  /** Helper text shown under the control. */
  hint?: ReactNode;
  /** Override the generated control id. */
  id?: string;
  /** Render the control, spreading the given props onto it. */
  children: (control: FieldControlProps) => ReactNode;
}

/** A label, a control and an optional hint and error, linked with `for` and `aria-describedby`. */
export function FormField({ label, error, hint, id, children }: FormFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={styles.field}>
      <label htmlFor={controlId} className={styles.label}>
        {label}
      </label>
      {children({
        id: controlId,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {/* An alert inserted into the page is announced when it appears. */}
      {error ? (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
