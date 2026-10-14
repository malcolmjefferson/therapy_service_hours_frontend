import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Button, FormField, Input } from '../../../components';
import { MAX_CLIENT_NAME_LENGTH } from '../model/clientNames';
import styles from './ClientPicker.module.css';

export interface AddClientInlineProps {
  name: string;
  error: string | undefined;
  saving: boolean;
  onChange: (name: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/** The full-width input opened by "+". Enter saves it without submitting the entry form around it. */
export function AddClientInline({ name, error, saving, onChange, onSubmit, onCancel }: AddClientInlineProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // This sits inside the entry form, so Enter must not submit that form.
      event.preventDefault();
      if (!saving) onSubmit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className={styles.add}>
      <FormField label="New client or group" error={error}>
        {(control) => (
          <Input
            {...control}
            ref={inputRef}
            name="newClientName"
            value={name}
            maxLength={MAX_CLIENT_NAME_LENGTH}
            autoComplete="off"
            onChange={(event) => {
              onChange(event.target.value);
            }}
            onKeyDown={onKeyDown}
          />
        )}
      </FormField>
      <div className={styles.addActions}>
        <Button disabled={saving} onClick={onSubmit}>
          {saving ? 'Saving…' : 'Save client'}
        </Button>
        <Button variant="ghost" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
