import { useEffect } from 'react';
import { Button } from '../../../components';
import { useEntriesQuery } from '../api/useEntriesQuery';
import { useEntriesView } from '../hooks/useEntriesView';
import { PAGE_SIZE, pageCount } from '../model/viewState';
import { EntriesEmpty } from './EntriesEmpty';
import { EntriesPagination } from './EntriesPagination';
import { EntriesTable } from './EntriesTable';
import styles from './EntriesTable.module.css';

/** The caller's entries: loads one page in the chosen order and shows its loading, error, empty and table states. */
export function EntriesPanel() {
  const { view, sortBy, goToPage } = useEntriesView();
  const query = useEntriesQuery(view);
  const data = query.data;

  // A page past the end (entries deleted elsewhere, or a hand-edited link) goes to the last real page.
  const lastPage = data ? pageCount(data.page.total_items, PAGE_SIZE) : undefined;
  useEffect(() => {
    if (lastPage !== undefined && view.page > lastPage) goToPage(lastPage, { replace: true });
  }, [lastPage, view.page, goToPage]);

  let body;
  if (data) {
    body =
      data.page.total_items === 0 ? (
        // Filters arrive with S2-14; until then an empty list always means "no entries yet".
        <EntriesEmpty filtered={false} />
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
      <h2 id="entries-title" className={styles.title}>
        Entries
      </h2>
      {data ? <p className={styles.count}>{data.page.total_items} in total</p> : null}
      {body}
    </section>
  );
}
