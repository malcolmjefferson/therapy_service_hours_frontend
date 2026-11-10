import { ApiError } from '../../../lib/api';

/** What a failed target save tells the dialog (FE-37). The raw problem payload is never shown. */
export interface TargetFailure {
  message: string;
  /** Set when the server named the target field, so the message sits on the input. */
  fieldError?: string;
}

export function targetFailure(error: unknown): TargetFailure {
  if (!(error instanceof ApiError)) return { message: 'The target could not be saved. Try again.' };
  if (error.status === undefined) {
    return { message: 'The server could not be reached. Check your connection and try again.' };
  }
  if (error.status === 400) {
    const field = error.problem?.errors?.find((item) => item.field === 'target_hours');
    if (field) return { message: 'The target was not saved.', fieldError: field.message };
    return { message: error.problem?.detail ?? 'The target could not be saved.' };
  }
  if (error.status === 429) return { message: 'Too many requests. Wait a moment and try again.' };
  return { message: 'The target could not be saved. Try again.' };
}
