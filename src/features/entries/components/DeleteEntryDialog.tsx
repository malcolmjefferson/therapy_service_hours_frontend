import { Button, Dialog } from '../../../components';
import { describeEntry } from '../model/entryMapping';
import type { EntryRow } from './EntryTableRow';
import styles from './EntriesTable.module.css';

export interface DeleteEntryDialogProps {
  /** The entry to confirm. `null` keeps the dialog closed. */
  entry: EntryRow | null;
  deleting: boolean;
  /** Why the last attempt failed, shown in the dialog so the person can retry or keep the entry. */
  error?: string | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before deleting. Escape and "Keep entry" close it; Tab stays inside it (FE-50). */
export function DeleteEntryDialog({ entry, deleting, error, onConfirm, onCancel }: DeleteEntryDialogProps) {
  return (
    <Dialog
      open={entry !== null}
      onClose={() => {
        if (!deleting) onCancel();
      }}
      title="Delete this entry?"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={deleting}>
            Keep entry
          </Button>
          <Button onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete entry'}
          </Button>
        </>
      }
    >
      {entry ? <p>{describeEntry(entry)}</p> : null}
      <p>This cannot be undone.</p>
      {error ? (
        <p role="alert" className={styles.dialogError}>
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
