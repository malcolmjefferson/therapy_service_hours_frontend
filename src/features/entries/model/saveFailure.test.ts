import { describe, expect, test } from 'vitest';
import { ApiError } from '../../../lib/api';
import { deleteFailure, saveFailure } from './saveFailure';

const problem = (status: number, extra: object = {}) => ({
  type: 'urn:therapy-service-hours:problem:test',
  title: 'Problem',
  status,
  ...extra,
});

describe('saveFailure', () => {
  test('maps API field names to form fields and keeps the first message per field', () => {
    const failure = saveFailure(
      new ApiError(
        400,
        problem(400, {
          errors: [
            { field: 'start_time', message: 'Start time must be in 15-minute steps.' },
            { field: 'start_time', message: 'Ignored second message.' },
            { field: 'unknown_field', message: 'Not a form field.' },
          ],
        }),
      ),
    );
    expect(failure.fieldErrors).toEqual({ startTime: 'Start time must be in 15-minute steps.' });
    expect(failure.message).toBe('The entry was not saved. Fix the fields marked below.');
  });

  test('a 400 without usable fields falls back to the problem detail', () => {
    expect(saveFailure(new ApiError(400, problem(400, { detail: 'Too many clients.' }))).message).toBe(
      'Too many clients.',
    );
  });

  test('the in-progress 409 tells the person the first save is still running and is safe to repeat', () => {
    const failure = saveFailure(
      new ApiError(409, problem(409, { type: 'urn:therapy-service-hours:problem:idempotency-key-in-progress' })),
    );
    expect(failure.message).toBe(
      'Your earlier save of this entry is still being processed. Wait a moment and try again. It will not be saved twice.',
    );
  });

  test.each([
    [undefined, 'The server could not be reached. Check your connection and try again.'],
    [404, 'This entry no longer exists. Reload your entries.'],
    [429, 'Too many requests. Wait a moment and try again.'],
    [500, 'The entry could not be saved. Try again.'],
  ])('status %s', (status, message) => {
    expect(saveFailure(new ApiError(status, undefined)).message).toBe(message);
  });

  test('a non-API error is generic and never exposes its text', () => {
    expect(saveFailure(new Error('secret detail')).message).toBe('The entry could not be saved. Try again.');
  });
});

describe('deleteFailure', () => {
  test.each([
    [undefined, 'The server could not be reached. Check your connection and try again.'],
    [429, 'Too many requests. Wait a moment and try again.'],
    [500, 'The entry could not be deleted. Try again.'],
  ])('status %s', (status, message) => {
    expect(deleteFailure(new ApiError(status, undefined))).toBe(message);
  });
});
