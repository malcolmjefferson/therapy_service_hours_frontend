import { durationMinutes, isOnStep, parseTime, STEP_MINUTES } from './time';

/** What the person has typed. Hours are never part of it: they are calculated (FE-39). */
export interface EntryDraft {
  sessionDate: string;
  categoryId: string;
  startTime: string;
  endTime: string;
  /** Ids of the chosen saved clients, in the order they were chosen. */
  clientIds: string[];
  onSite: boolean;
  notes: string;
}

export type EntryField = 'sessionDate' | 'categoryId' | 'startTime' | 'endTime' | 'notes';
export type EntryErrors = Partial<Record<EntryField, string>>;

export const emptyDraft: EntryDraft = {
  sessionDate: '',
  categoryId: '',
  startTime: '',
  endTime: '',
  clientIds: [],
  onSite: false,
  notes: '',
};

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isCalendarDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function timeError(value: string, label: string): string | undefined {
  if (value === '') return `${label} is required.`;
  const minutes = parseTime(value);
  if (minutes === null) return `${label} must be a time such as 09:30.`;
  if (!isOnStep(minutes)) return `${label} must be in ${String(STEP_MINUTES)}-minute steps.`;
  return undefined;
}

/**
 * Mirrors the server's rules for fast feedback; the server stays the authority (FE-40).
 * Returns one plain-language message per invalid field, or an empty object when the draft is valid.
 */
export function validateEntry(draft: EntryDraft): EntryErrors {
  const errors: EntryErrors = {};
  if (draft.sessionDate === '') errors.sessionDate = 'Date is required.';
  else if (!isCalendarDate(draft.sessionDate)) errors.sessionDate = 'Date must be a real date.';

  if (draft.categoryId === '') errors.categoryId = 'Choose a category.';

  const startError = timeError(draft.startTime, 'Start time');
  const endError = timeError(draft.endTime, 'End time');
  if (startError) errors.startTime = startError;
  if (endError) errors.endTime = endError;
  if (!startError && !endError && durationMinutes(draft.startTime, draft.endTime) === null) {
    errors.endTime = 'End time must be after the start time on the same day.';
  }
  return errors;
}
