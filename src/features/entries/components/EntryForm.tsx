import { useId, type ReactNode } from 'react';
import { Button, FormField, Input, Select, Textarea, type SelectGroup } from '../../../components';
import { useEntryForm, type EntryFormCopy, type SubmitEntry } from '../hooks/useEntryForm';
import { STEP_MINUTES, formatHours } from '../model/time';
import { emptyDraft, type EntryDraft } from '../model/validation';
import styles from './EntryForm.module.css';

/** What the form hands the client picker: the chosen ids and how to change them. */
export interface ClientsSlotState {
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
}

const variants = {
  add: {
    title: 'Add entry',
    submit: 'Add entry',
    saving: 'Adding…',
    copy: {
      invalid: 'The entry was not added. Fix the fields marked below.',
      saved: 'Entry added.',
      failed: 'The entry could not be saved. Check your connection and try again.',
      resetOnSave: true,
      focusOnMount: false,
    },
  },
  edit: {
    title: 'Edit entry',
    submit: 'Save changes',
    saving: 'Saving…',
    copy: {
      invalid: 'The changes were not saved. Fix the fields marked below.',
      saved: 'Entry updated.',
      failed: 'The entry could not be saved. Check your connection and try again.',
      resetOnSave: false,
      focusOnMount: true,
    },
  },
} as const satisfies Record<string, { title: string; submit: string; saving: string; copy: EntryFormCopy }>;

export type EntryFormVariant = keyof typeof variants;

export interface EntryFormProps {
  /** Categories under their Direct / Indirect / Supervision headings. */
  categories: readonly SelectGroup[];
  /** Saves the entry. Hours are never sent: the server calculates them (FE-39). */
  onSubmit: SubmitEntry;
  /** Where the client picker goes, between the hours and the on-site checkbox (FE-13). It gets the chosen ids. */
  clients?: (state: ClientsSlotState) => ReactNode;
  /** `edit` starts from `initialDraft`, says "Save changes" and shows Cancel when `onCancel` is given. */
  variant?: EntryFormVariant;
  /** The values the form starts with. Read once, when the form mounts. */
  initialDraft?: EntryDraft | undefined;
  onCancel?: (() => void) | undefined;
}

const NOTES_WARNING = 'Use pseudonyms or initials only, never real names. Supervisors can read your notes.';

/** The entry form, in the prototype's order: date, category, start and end, hours, clients, on-site, notes. */
export function EntryForm({
  categories,
  onSubmit,
  clients,
  variant = 'add',
  initialDraft = emptyDraft,
  onCancel,
}: EntryFormProps) {
  const text = variants[variant];
  const titleId = useId();
  const {
    draft,
    errors,
    minutes,
    saving,
    formRef,
    onText,
    onOnSite,
    onClients,
    onSubmit: submit,
  } = useEntryForm(onSubmit, initialDraft, text.copy);

  return (
    <form
      ref={formRef}
      className={styles.form}
      aria-labelledby={titleId}
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <h2 id={titleId} className={styles.title}>
        {text.title}
      </h2>

      <FormField label="Date" error={errors.sessionDate}>
        {(control) => (
          <Input
            {...control}
            name="sessionDate"
            type="date"
            value={draft.sessionDate}
            onChange={onText('sessionDate')}
          />
        )}
      </FormField>

      <FormField label="Category" error={errors.categoryId}>
        {(control) => (
          <Select
            {...control}
            name="categoryId"
            groups={categories}
            placeholder="Choose a category"
            value={draft.categoryId}
            onChange={onText('categoryId')}
          />
        )}
      </FormField>

      <div className={styles.times}>
        <FormField label="Start time" error={errors.startTime}>
          {(control) => (
            <Input
              {...control}
              name="startTime"
              type="time"
              step={STEP_MINUTES * 60}
              value={draft.startTime}
              onChange={onText('startTime')}
            />
          )}
        </FormField>
        <FormField label="End time" error={errors.endTime}>
          {(control) => (
            <Input
              {...control}
              name="endTime"
              type="time"
              step={STEP_MINUTES * 60}
              value={draft.endTime}
              onChange={onText('endTime')}
            />
          )}
        </FormField>
      </div>

      <FormField label="Hours" hint="Calculated from the start and end times.">
        {({ id, 'aria-describedby': describedBy }) => (
          <output id={id} aria-describedby={describedBy} className={styles.hours}>
            {minutes === null ? '—' : formatHours(minutes)}
          </output>
        )}
      </FormField>

      {clients?.({ selectedIds: draft.clientIds, onChange: onClients })}

      <label className={styles.check}>
        <input type="checkbox" name="onSite" checked={draft.onSite} onChange={onOnSite} />
        On-site
      </label>

      <FormField label="Notes (optional)" hint={NOTES_WARNING} error={errors.notes}>
        {(control) => <Textarea {...control} name="notes" rows={4} value={draft.notes} onChange={onText('notes')} />}
      </FormField>

      <div className={styles.actions}>
        <Button type="submit" disabled={saving}>
          {saving ? text.saving : text.submit}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
