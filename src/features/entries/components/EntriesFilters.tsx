import { useEffect, useState, type SyntheticEvent } from 'react';
import { FormField, Input, Select } from '../../../components';
import {
  MAX_CLIENT_FILTER,
  groupLabels,
  isRangeBackwards,
  normalizeClientFilter,
  type CategoryGroup,
  type EntriesFilters as Filters,
} from '../model/viewState';
import styles from './EntriesTable.module.css';

/** How long typing in the client box waits before the table asks the API (FE-58). */
export const CLIENT_DEBOUNCE_MS = 300;

export interface EntriesFiltersProps {
  filters: Filters;
  onChange: (change: Filters, options?: { replace?: boolean }) => void;
}

const groupOptions = [
  {
    label: 'Category group',
    options: (Object.keys(groupLabels) as CategoryGroup[]).map((group) => ({
      value: group,
      label: groupLabels[group],
    })),
  },
];

function isGroup(value: string): value is CategoryGroup {
  return Object.keys(groupLabels).includes(value);
}

/**
 * Group, client text and date range. The filters combine, live in the URL (the panel owns them), and
 * every change goes back to page 1. The client box waits for a pause in typing before it applies.
 */
export function EntriesFilters({ filters, onChange }: EntriesFiltersProps) {
  const [clientText, setClientText] = useState(filters.client ?? '');

  // Follow the URL when it changes elsewhere (Clear filters, Back), but not while the typed text
  // already means the same thing: that would eat a space typed mid-phrase.
  useEffect(() => {
    setClientText((typed) => (normalizeClientFilter(typed) === filters.client ? typed : (filters.client ?? '')));
  }, [filters.client]);

  // Apply typing once it pauses. The wanted value is compared with the URL's, so a change that came
  // from the URL does not echo back as a second request.
  useEffect(() => {
    const wanted = normalizeClientFilter(clientText);
    if (wanted === filters.client) return;
    const timer = setTimeout(() => {
      onChange({ client: wanted }, { replace: true });
    }, CLIENT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [clientText, filters.client, onChange]);

  const backwards = isRangeBackwards(filters);

  const apply = (event: SyntheticEvent<HTMLFormElement>) => {
    // Enter in the client box applies it now rather than after the pause.
    event.preventDefault();
    const wanted = normalizeClientFilter(clientText);
    if (wanted !== filters.client) onChange({ client: wanted }, { replace: true });
  };

  return (
    <form className={styles.filters} role="search" aria-label="Filter entries" onSubmit={apply}>
      <FormField label="Group">
        {(control) => (
          <Select
            {...control}
            groups={groupOptions}
            placeholder="All groups"
            value={filters.group ?? ''}
            onChange={(event) => {
              const { value } = event.target;
              onChange({ group: isGroup(value) ? value : undefined });
            }}
          />
        )}
      </FormField>
      <FormField label="Client contains">
        {(control) => (
          <Input
            {...control}
            type="search"
            autoComplete="off"
            maxLength={MAX_CLIENT_FILTER}
            value={clientText}
            onChange={(event) => {
              setClientText(event.target.value);
            }}
          />
        )}
      </FormField>
      <FormField label="From">
        {(control) => (
          <Input
            {...control}
            type="date"
            value={filters.from ?? ''}
            onChange={(event) => {
              onChange({ from: event.target.value || undefined });
            }}
          />
        )}
      </FormField>
      <FormField label="To" error={backwards ? 'The end date is before the start date.' : undefined}>
        {(control) => (
          <Input
            {...control}
            type="date"
            value={filters.to ?? ''}
            onChange={(event) => {
              onChange({ to: event.target.value || undefined });
            }}
          />
        )}
      </FormField>
    </form>
  );
}
