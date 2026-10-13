import type { ReactNode } from 'react';
import { Button, FormField, Input, Select, Textarea, type SelectGroup } from '../../../components';
import { useEntryForm, type SubmitEntry } from '../hooks/useEntryForm';
import { STEP_MINUTES, formatHours } from '../model/time';
import styles from './EntryForm.module.css';

export interface EntryFormProps {
  /** Categories under their Direct / Indirect / Supervision headings. */
  categories: readonly SelectGroup[];
  /** Saves the entry. Hours are never sent: the server calculates them (FE-39). */
  onSubmit: SubmitEntry;
  /** Where the client picker goes, between the hours and the on-site checkbox (FE-13). */
  clients?: ReactNode;
}

const NOTES_WARNING = 'Use pseudonyms or initials only, never real names. Supervisors can read your notes.';

/** The entry form, in the prototype's order: date, category, start and end, hours, clients, on-site, notes. */
export function EntryForm({ categories, onSubmit, clients }: EntryFormProps) {
  const { draft, errors, minutes, saving, formRef, onText, onOnSite, onSubmit: submit } = useEntryForm(onSubmit);

  return (
    <form
      ref={formRef}
      className={styles.form}
      aria-labelledby="entry-form-title"
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <h2 id="entry-form-title" className={styles.title}>
        Add entry
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

      {clients}

      <label className={styles.check}>
        <input type="checkbox" name="onSite" checked={draft.onSite} onChange={onOnSite} />
        On-site
      </label>

      <FormField label="Notes (optional)" hint={NOTES_WARNING} error={errors.notes}>
        {(control) => <Textarea {...control} name="notes" rows={4} value={draft.notes} onChange={onText('notes')} />}
      </FormField>

      <Button type="submit" disabled={saving}>
        {saving ? 'Adding…' : 'Add entry'}
      </Button>
    </form>
  );
}
