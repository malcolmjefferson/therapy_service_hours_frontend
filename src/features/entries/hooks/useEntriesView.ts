import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  applyView,
  filteredBy,
  parseView,
  sortedBy,
  withoutFilters,
  type EntriesFilters,
  type EntriesView,
  type EntrySortField,
} from '../model/viewState';

/** The table's filters, sort and page, kept in the URL so a reload or a shared link shows the same view (FE-31). */
export function useEntriesView() {
  const [params, setParams] = useSearchParams();
  const view = useMemo(() => parseView(params), [params]);

  const update = useCallback(
    (change: (current: EntriesView) => EntriesView, replace = false) => {
      setParams((current) => applyView(current, change(parseView(current))), { replace });
    },
    [setParams],
  );

  const sortBy = useCallback(
    (field: EntrySortField) => {
      update((current) => sortedBy(current, field));
    },
    [update],
  );

  const goToPage = useCallback(
    (page: number, options: { replace?: boolean } = {}) => {
      update((current) => ({ ...current, page }), options.replace ?? false);
    },
    [update],
  );

  /** Changes some filters and goes back to page 1. Typing replaces the history entry so Back is not flooded. */
  const setFilters = useCallback(
    (change: EntriesFilters, options: { replace?: boolean } = {}) => {
      update((current) => filteredBy(current, change), options.replace ?? false);
    },
    [update],
  );

  const clearFilters = useCallback(() => {
    update(withoutFilters);
  }, [update]);

  return { view, sortBy, goToPage, setFilters, clearFilters };
}
