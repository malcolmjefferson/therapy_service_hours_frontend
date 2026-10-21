import { useRef } from 'react';
import { Button } from '../../../components';
import { ClientPicker } from '../../clients';
import { useCategoriesQuery } from '../api/useCategoriesQuery';
import { useCreateEntry, useUpdateEntry } from '../api/useSaveEntry';
import type { SubmitEntry } from '../hooks/useEntryForm';
import { draftFromEntry, overlapMessage, requestFromDraft, type EditableEntry } from '../model/entryMapping';
import { saveFailure } from '../model/saveFailure';
import { EntryForm } from './EntryForm';
import styles from './EntryForm.module.css';

export interface EntryEditorProps {
  /** The entry to edit. Leave it out to log a new one. Give it a `key` so another entry starts a fresh form. */
  entry?: (EditableEntry & { id: string }) | undefined;
  /** Called after an edit is saved. */
  onSaved?: () => void;
  onCancel?: () => void;
}

const LOCKED_MESSAGE = 'This entry was approved, so it can no longer be changed.';

/**
 * The entry form wired to the API: categories from the server, the client picker, and create or
 * update with the overlap, locked and validation outcomes explained in the form (FR-LOG-04, FR-LOG-05).
 */
export function EntryEditor({ entry, onSaved, onCancel }: EntryEditorProps) {
  const categories = useCategoriesQuery();
  const create = useCreateEntry();
  const update = useUpdateEntry();
  // One Idempotency-Key per user action, kept while the same request is retried (FE-34).
  const attempt = useRef<{ body: string; key: string } | null>(null);

  const submit: SubmitEntry = async (draft) => {
    const body = requestFromDraft(draft);
    try {
      let outcome;
      if (entry) {
        outcome = await update.mutateAsync({ id: entry.id, body });
      } else {
        const signature = JSON.stringify(body);
        attempt.current =
          attempt.current?.body === signature ? attempt.current : { body: signature, key: crypto.randomUUID() };
        outcome = await create.mutateAsync({ body, idempotencyKey: attempt.current.key });
      }
      switch (outcome.kind) {
        case 'saved':
          attempt.current = null;
          onSaved?.();
          return { ok: true };
        case 'overlap': {
          // The message names the clashing session and sits on the start time, where the fix is (US-04).
          const message = overlapMessage(outcome.conflicting);
          return { ok: false, message, fieldErrors: { startTime: message } };
        }
        case 'locked':
          return { ok: false, message: LOCKED_MESSAGE };
      }
    } catch (failure) {
      return saveFailure(failure);
    }
  };

  if (categories.data) {
    return (
      <EntryForm
        categories={categories.data}
        onSubmit={submit}
        variant={entry ? 'edit' : 'add'}
        initialDraft={entry ? draftFromEntry(entry) : undefined}
        onCancel={onCancel}
        clients={({ selectedIds, onChange }) => <ClientPicker selectedIds={selectedIds} onChange={onChange} />}
      />
    );
  }
  if (categories.isError) {
    return (
      <div role="alert" className={styles.loadError}>
        <p>The form could not be loaded. Check your connection and try again.</p>
        <Button
          onClick={() => {
            void categories.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }
  return <p role="status">Loading the form…</p>;
}
