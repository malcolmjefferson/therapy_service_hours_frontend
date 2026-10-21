import type { EntriesView } from '../model/viewState';

/** Query key factory for the entries feature (FE-32). */
export const entryKeys = {
  all: ['entries'] as const,
  lists: () => [...entryKeys.all, 'list'] as const,
  list: (view: EntriesView) => [...entryKeys.lists(), view] as const,
};
