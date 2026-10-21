import { useEffect, useRef, useState, type ChangeEvent, type SyntheticEvent } from 'react';
import { useToast } from '../../../components';
import { durationMinutes } from '../model/time';
import { emptyDraft, validateEntry, type EntryDraft, type EntryErrors, type EntryField } from '../model/validation';

/** What saving reports back, so server rules can land on the matching inputs (FE-37). */
export type SubmitResult = { ok: true } | { ok: false; message: string; fieldErrors?: EntryErrors };

export type SubmitEntry = (draft: EntryDraft) => Promise<SubmitResult>;

/** The texts and behavior that differ between adding an entry and editing one (FE-14). */
export interface EntryFormCopy {
  invalid: string;
  saved: string;
  failed: string;
  /** Adding starts over with an empty form; editing leaves the saved values for the caller to close. */
  resetOnSave: boolean;
  /** Editing moves focus into the form, because the person just asked for it. */
  focusOnMount: boolean;
}

const FIELD_ORDER: readonly EntryField[] = ['sessionDate', 'categoryId', 'startTime', 'endTime', 'notes'];

/** Form state, live hours, validation and submit handling for the entry form (FE-10, FE-42). */
export function useEntryForm(submitEntry: SubmitEntry, initialDraft: EntryDraft, copy: EntryFormCopy) {
  const toast = useToast();
  const [draft, setDraft] = useState<EntryDraft>(initialDraft);
  const [errors, setErrors] = useState<EntryErrors>({});
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Once a submit has failed, each edit re-checks the draft so fixed fields clear at once.
  const attempted = useRef(false);

  const minutes = durationMinutes(draft.startTime, draft.endTime);

  useEffect(() => {
    if (copy.focusOnMount) formRef.current?.querySelector<HTMLElement>('[name="sessionDate"]')?.focus();
  }, [copy.focusOnMount]);

  const update = (next: EntryDraft) => {
    setDraft(next);
    if (attempted.current) setErrors(validateEntry(next));
  };

  const onText =
    (field: EntryField) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      update({ ...draft, [field]: event.target.value });
    };

  const onOnSite = (event: ChangeEvent<HTMLInputElement>) => {
    update({ ...draft, onSite: event.target.checked });
  };

  const onClients = (clientIds: string[]) => {
    update({ ...draft, clientIds });
  };

  const focusFirstInvalid = (found: EntryErrors) => {
    const first = FIELD_ORDER.find((field) => found[field] !== undefined);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  const onSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    attempted.current = true;
    const found = validateEntry(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.show(copy.invalid, { tone: 'error' });
      focusFirstInvalid(found);
      return;
    }
    setSaving(true);
    try {
      const result = await submitEntry(draft);
      if (result.ok) {
        attempted.current = false;
        if (copy.resetOnSave) setDraft(emptyDraft);
        setErrors({});
        toast.show(copy.saved, { tone: 'success' });
      } else {
        const fieldErrors = result.fieldErrors ?? {};
        setErrors(fieldErrors);
        toast.show(result.message, { tone: 'error' });
        focusFirstInvalid(fieldErrors);
      }
    } catch {
      // The save hook reports server problems as a result; this is a network or programming failure.
      toast.show(copy.failed, { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return { draft, errors, minutes, saving, formRef, onText, onOnSite, onClients, onSubmit };
}
