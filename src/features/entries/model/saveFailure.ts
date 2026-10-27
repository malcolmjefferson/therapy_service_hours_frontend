import { ApiError, isInProgressError, type components } from '../../../lib/api';
import type { EntryErrors, EntryField } from './validation';

type ProblemField = components['schemas']['ProblemField'];

/** What a failed save tells the form (FE-37). */
export interface SaveFailure {
  ok: false;
  message: string;
  fieldErrors?: EntryErrors;
}

// The API names fields in snake case; the form uses its own field names.
const FORM_FIELD: Record<string, EntryField> = {
  session_date: 'sessionDate',
  category_id: 'categoryId',
  start_time: 'startTime',
  end_time: 'endTime',
  notes: 'notes',
};

function fieldErrors(problems: readonly ProblemField[] | undefined): EntryErrors {
  const errors: EntryErrors = {};
  for (const { field, message } of problems ?? []) {
    const formField = FORM_FIELD[field];
    if (formField && errors[formField] === undefined) errors[formField] = message;
  }
  return errors;
}

/** The first save is still running on the server. Sending again is safe: the same key means it is saved once. */
export function inProgressMessage(noun: string): string {
  return `Your earlier save of this ${noun} is still being processed. Wait a moment and try again. It will not be saved twice.`;
}

/** Plain-language text for a failed save. The raw problem payload is never shown (FE-37). */
export function saveFailure(error: unknown, noun = 'entry'): SaveFailure {
  if (!(error instanceof ApiError)) return { ok: false, message: `The ${noun} could not be saved. Try again.` };
  if (error.status === undefined) {
    return { ok: false, message: 'The server could not be reached. Check your connection and try again.' };
  }
  if (error.status === 400) {
    const found = fieldErrors(error.problem?.errors);
    return Object.keys(found).length > 0
      ? { ok: false, message: `The ${noun} was not saved. Fix the fields marked below.`, fieldErrors: found }
      : { ok: false, message: error.problem?.detail ?? `The ${noun} could not be saved.` };
  }
  if (error.status === 404) return { ok: false, message: 'This entry no longer exists. Reload your entries.' };
  if (error.status === 429) return { ok: false, message: 'Too many requests. Wait a moment and try again.' };
  if (isInProgressError(error)) return { ok: false, message: inProgressMessage(noun) };
  return { ok: false, message: `The ${noun} could not be saved. Try again.` };
}

/** Plain-language text for a delete that failed, shown in the confirmation so the person can retry. */
export function deleteFailure(error: unknown): string {
  if (error instanceof ApiError && error.status === undefined) {
    return 'The server could not be reached. Check your connection and try again.';
  }
  if (error instanceof ApiError && error.status === 429) return 'Too many requests. Wait a moment and try again.';
  return 'The entry could not be deleted. Try again.';
}
