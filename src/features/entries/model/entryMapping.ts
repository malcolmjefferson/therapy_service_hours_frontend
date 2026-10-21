import type { components } from '../../../lib/api';
import { formatSessionDate, formatTimeRange } from './format';
import type { EntryDraft } from './validation';

type Entry = components['schemas']['Entry'];
type EntryRequest = components['schemas']['EntryRequest'];
type ConflictingEntry = components['schemas']['ConflictingEntry'];

/** The fields an edit starts from (FE-19). */
export type EditableEntry = Pick<
  Entry,
  'session_date' | 'start_time' | 'end_time' | 'category' | 'clients' | 'on_site' | 'notes'
>;

/**
 * The form's starting values for an edit, so unchanged fields are saved as they were (FR-LOG-05).
 * A legacy entry without times starts with empty time inputs: it cannot be saved until both are set.
 */
export function draftFromEntry(entry: EditableEntry): EntryDraft {
  return {
    sessionDate: entry.session_date,
    categoryId: entry.category.id,
    startTime: entry.start_time ?? '',
    endTime: entry.end_time ?? '',
    clientIds: entry.clients.map((client) => client.id),
    onSite: entry.on_site,
    notes: entry.notes ?? '',
  };
}

/** The request body for a valid draft. Hours are never sent: the server calculates them (FE-39). */
export function requestFromDraft(draft: EntryDraft): EntryRequest {
  return {
    session_date: draft.sessionDate,
    start_time: draft.startTime,
    end_time: draft.endTime,
    category_id: draft.categoryId,
    client_ids: draft.clientIds,
    on_site: draft.onSite,
    notes: draft.notes,
  };
}

/** The overlap message from US-04, naming the clashing session by date and times. */
export function overlapMessage(conflict: ConflictingEntry | undefined): string {
  if (!conflict) return 'This overlaps an existing session.';
  const times = formatTimeRange(conflict.start_time, conflict.end_time) ?? '';
  return `This overlaps an existing session on ${conflict.session_date} (${times})`;
}

/** One line naming an entry, for the delete confirmation: `Jan 12, 2026, 13:00 to 14:15, Individual Counseling`. */
export function describeEntry(entry: Pick<Entry, 'session_date' | 'start_time' | 'end_time' | 'category'>): string {
  const times = formatTimeRange(entry.start_time, entry.end_time);
  return [formatSessionDate(entry.session_date), times, entry.category.name].filter(Boolean).join(', ');
}
