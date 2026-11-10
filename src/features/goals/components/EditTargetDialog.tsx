import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Button, Dialog, FormField, Input } from '../../../components';
import { parseTarget } from '../model/goalCards';
import { targetFailure } from '../model/targetFailure';
import styles from './GoalCards.module.css';

export interface EditTargetDialogProps {
  /** Goal name for the title, for example "Direct Service". */
  title: string;
  currentTarget: number;
  saving: boolean;
  /** Resolves when the target is saved and rejects with the API error otherwise. */
  onSave: (hours: number) => Promise<unknown>;
  onClose: () => void;
}

/** Edits one goal's target in whole hours. Invalid values show a message and nothing is sent (FR-GOAL-02). */
export function EditTargetDialog({ title, currentTarget, saving, onSave, onClose }: EditTargetDialogProps) {
  const formId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // The dialog focuses its panel first; the field is where the person types next.
  useEffect(() => {
    inputRef.current?.select();
    inputRef.current?.focus();
  }, []);
  const [text, setText] = useState(String(currentTarget));
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | undefined>();

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    setFailure(undefined);
    const parsed = parseTarget(text);
    if (!parsed.ok) {
      setFieldError(parsed.message);
      return;
    }
    setFieldError(undefined);
    try {
      await onSave(parsed.hours);
    } catch (error) {
      const result = targetFailure(error);
      setFieldError(result.fieldError);
      setFailure(result.message);
    }
  };

  return (
    <Dialog
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      title={`Edit ${title} target`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? 'Saving…' : 'Save target'}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(event) => void submit(event)}>
        <FormField label="Target (hours)" error={fieldError} hint="A whole number of hours, at least 1.">
          {(control) => (
            <Input
              {...control}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              ref={inputRef}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
          )}
        </FormField>
        {failure && !fieldError ? (
          <p role="alert" className={styles.dialogError}>
            {failure}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
