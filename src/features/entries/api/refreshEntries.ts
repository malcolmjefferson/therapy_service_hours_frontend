import type { QueryClient } from '@tanstack/react-query';
import { goalKeys } from '../../goals';
import { entryKeys } from './entryKeys';

/** Refreshes the entry lists and the goal cards, because any entry change moves pending hours (FR-GOAL-03). */
export function refreshEntries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: entryKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: goalKeys.all }),
  ]);
}
