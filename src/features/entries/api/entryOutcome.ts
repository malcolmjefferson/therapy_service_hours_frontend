import type { components } from '../../../lib/api';

type EntryConflictProblem = components['schemas']['EntryConflictProblem'];
type ConflictingEntry = components['schemas']['ConflictingEntry'];

const OVERLAP = 'urn:therapy-service-hours:problem:entry-overlap';
const LOCKED = 'urn:therapy-service-hours:problem:entry-locked';

/**
 * A 409 the form can explain, so it is a normal outcome and not an error: the session overlaps another
 * one (`conflicting` names it), or the entry was approved and is locked (FR-LOG-04, FR-LOG-05).
 */
export type EntryConflict = { kind: 'overlap'; conflicting: ConflictingEntry | undefined } | { kind: 'locked' };

/** The problem body of a failed response, or `undefined` when the body was empty or not a problem (a gateway error). */
export function entryProblem(error: unknown): EntryConflictProblem | undefined {
  return typeof error === 'object' && error !== null && 'type' in error ? (error as EntryConflictProblem) : undefined;
}

/** Reads a 409 body. Returns `undefined` for any other conflict, which the caller treats as a failure. */
export function entryConflict(problem: EntryConflictProblem | undefined): EntryConflict | undefined {
  if (problem?.type === OVERLAP) return { kind: 'overlap', conflicting: problem.conflicting_entry };
  if (problem?.type === LOCKED) return { kind: 'locked' };
  return undefined;
}
