import { useEffect, useState } from 'react';
import { Button } from '../../../components';
import { useEntriesQuery } from '../api/useEntriesQuery';
import { useEntriesView } from '../hooks/useEntriesView';
import { PAGE_SIZE, hasFilters, isRangeBackwards, pageCount } from '../model/viewState';
import { EntriesEmpty } from './EntriesEmpty';
import { EntriesFilters } from './EntriesFilters';
import { EntriesPagination } from './EntriesPagination';
import { EntriesTable } from './EntriesTable';
import styles from './EntriesTable.module.css';

/** The caller's entries: loads one page in the chosen order and shows its loading, error, empty and table states. */
export function EntriesPanel() {
  const { view, sortBy, goToPage, setFilters, clearFilters } = useEntriesView();
  // A range that runs backwards is a 400, so it is flagged on the field and not sent.
  const rangeBackwards = isRangeBackwards(view);
  const query = useEntriesQuery(view, !rangeBackwards);
  const data = query.data;
  const filtered = hasFilters(view);
  // Clearing also drops client text that is typed but not applied yet, which the URL does not know about.
  const [clearCount, setClearCount] = useState(0);

  // A page past the end (entries deleted elsewhere, or a hand-edited link) goes to the last real page.
  const lastPage = data ? pageCount(data.page.total_items, PAGE_SIZE) : undefined;
  useEffect(() => {
    if (lastPage !== undefined && view.page > lastPage) goToPage(lastPage, { replace: true });
  }, [lastPage, view.page, goToPage]);

  let body;
  if (rangeBackwards) {
    body = <p role="status">Choose an end date that is not before the start date to see entries.</p>;
  } else if (data) {
    body =
      data.page.total_items === 0 ? (
        <EntriesEmpty filtered={filtered} />
      ) : (
        <>
          <EntriesTable entries={data.items} view={view} onSort={sortBy} />
          <EntriesPagination
            page={view.page}
            pageSize={PAGE_SIZE}
            totalItems={data.page.total_items}
            onPageChange={goToPage}
          />
        </>
      );
  } else if (query.isError) {
    body = (
      <div role="alert" className={styles.error}>
        <p>Your entries could not be loaded. Check your connection and try again.</p>
        {query.error.requestId ? <p>Reference: {query.error.requestId}</p> : null}
        <Button
          onClick={() => {
            void query.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  } else {
    body = <p role="status">Loading entries…</p>;
  }

  return (
    <section className={styles.panel} aria-labelledby="entries-title" aria-busy={query.isFetching}>
      <div className={styles.header}>
        <h2 id="entries-title" className={styles.title}>
          Entries
        </h2>
        <div className={styles.actions}>
          <Button
            variant="ghost"
            onClick={() => {
              clearFilters();
              setClearCount((count) => count + 1);
            }}
          >
            Clear filters
          </Button>
          {/* Placeholders until the import and export stories (E4) wire them up. */}
          <Button variant="ghost" disabled>
            Export
          </Button>
          <Button variant="ghost" disabled>
            Import
          </Button>
        </div>
      </div>
      <EntriesFilters key={clearCount} filters={view} onChange={setFilters} />
      {data && !rangeBackwards ? (
        <p className={styles.count} aria-live="polite">
          {data.page.total_items} {filtered ? 'matching' : 'in total'}
        </p>
      ) : null}
      {body}
    </section>
  );
}
