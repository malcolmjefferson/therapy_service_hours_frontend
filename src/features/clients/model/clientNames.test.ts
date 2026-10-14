import { describe, expect, test } from 'vitest';
import {
  MAX_CLIENT_NAME_LENGTH,
  findClientByName,
  normalizeClientName,
  summarizeSelection,
  toggleId,
  validateClientName,
  type ClientOption,
} from './clientNames';

const clients: ClientOption[] = [
  { id: 'c1', name: 'A.B.' },
  { id: 'c2', name: 'Group Alpha' },
  { id: 'c3', name: 'C.D.' },
];

describe('validateClientName', () => {
  test.each([
    ['', 'Enter a name or initials for the client.'],
    ['   ', 'Enter a name or initials for the client.'],
    ['x'.repeat(MAX_CLIENT_NAME_LENGTH + 1), 'Use 64 characters or fewer.'],
  ])('rejects %j', (input, message) => {
    expect(validateClientName(input)).toBe(message);
  });

  test('accepts initials and the longest allowed name', () => {
    expect(validateClientName('A.B.')).toBeUndefined();
    expect(validateClientName(` ${'x'.repeat(MAX_CLIENT_NAME_LENGTH)} `)).toBeUndefined();
  });
});

describe('normalizeClientName', () => {
  test('trims the ends and keeps the inside as typed', () => {
    expect(normalizeClientName('  A.  B.  ')).toBe('A.  B.');
  });
});

describe('findClientByName', () => {
  test('matches ignoring letter case and surrounding spaces', () => {
    expect(findClientByName(clients, ' a.b. ')).toBe(clients[0]);
    expect(findClientByName(clients, 'GROUP ALPHA')).toBe(clients[1]);
  });

  test('does not match a different name, a prefix or an empty name', () => {
    expect(findClientByName(clients, 'A.B')).toBeUndefined();
    expect(findClientByName(clients, '')).toBeUndefined();
  });
});

describe('summarizeSelection', () => {
  test('says so when nothing is chosen', () => {
    expect(summarizeSelection(clients, [])).toBe('Choose clients');
  });

  test('lists one or two names', () => {
    expect(summarizeSelection(clients, ['c2'])).toBe('Group Alpha');
    expect(summarizeSelection(clients, ['c3', 'c1'])).toBe('A.B., C.D.');
  });

  test('counts three or more', () => {
    expect(summarizeSelection(clients, ['c1', 'c2', 'c3'])).toBe('3 clients selected');
  });

  test('counts when a chosen client is not in the list yet', () => {
    expect(summarizeSelection([], ['c1'])).toBe('1 client selected');
  });
});

describe('toggleId', () => {
  test('adds at the end and removes in place', () => {
    expect(toggleId(['c1'], 'c3')).toEqual(['c1', 'c3']);
    expect(toggleId(['c1', 'c3'], 'c1')).toEqual(['c3']);
  });
});
