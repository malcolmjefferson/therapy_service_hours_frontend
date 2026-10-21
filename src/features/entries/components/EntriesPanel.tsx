import { useEffect, useRef, useState } from 'react';
import { Button, useToast } from '../../../components';
import { useDeleteEntry, type DeleteEntryOutcome } from '../api/useDeleteEntry';
import { useEntriesQuery } from '../api/useEntriesQuery';
import { useEntriesView } from '../hooks/useEntriesView';
import { PAGE_SIZE, pageCount } from '../model/viewState';
import { deleteFailure } from '../model/saveFailure';
import { DeleteEntryDialog } from './DeleteEntryDialog';
import { EntriesEmpty } from './EntriesEmpty';
import { EntriesPagination } from './EntriesPagination';
import { EntriesTable } from './EntriesTable';
import type { EntryRow } from './EntryTableRow';
import styles from './EntriesTable.module.css';

export interface EntriesPanelProps {
  /** Called when the person chooses Edit on a row. Without it the table has no Edit or Delete. */
  onEdit?: (entry: EntryRow) => void;
  /** Called after an entry is deleted, so an open edit of it can close. */
  onDeleted?: (id: string) => void;
}

const DELETE_OUTCOME: Record<DeleteEntryOutcome, { message: string; tone: 'success' | 'info' | 'error' }> = {
  deleted: { message: 'Entry deleted.', tone: 'success' },
  gone: { message: 'That entry was already deleted.', tone: 'info' },
  locked: { message: 'This entry was approved, so it can no longer be deleted.', tone: 'error' },
};

/** The caller's entries: loads one page in the chosen order and shows its loading, error, empty and table states. */
export function EntriesPanel({ onEdit, onDeleted }: EntriesPanelProps) {
  const { view, sortBy, goToPage } = useEntriesView();
  const query = useEntriesQuery(view);
  const data = query.data;
  const toast = useToast();
  const remove = useDeleteEntry();
  const [pendingDelete, setPendingDelete] = useState<EntryRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const askToDelete = (entry: EntryRow) => {
    setDeleteError(undefined);
    setPendingDelete(entry);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    let outcome;
    try {
      outcome = await remove.mutateAsync(pendingDelete.id);
    } catch (failure) {
      setDeleteError(deleteFailure(failure));
      return;
    }
    // The row is gone, so focus moves to the table heading rather than falling back to the page.
    headingRef.current?.focus();
    setPendingDelete(null);
    onDeleted?.(pendingDelete.id);
    toast.show(DELETE_OUTCOME[outcome].message, { tone: DELETE_OUTCOME[outcome].tone });
  };

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
          <EntriesTable
            entries={data.items}
            view={view}
            onSort={sortBy}
            actions={onEdit ? { onEdit, onDelete: askToDelete } : undefined}
          />
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
      <h2 id="entries-title" ref={headingRef} tabIndex={-1} className={styles.title}>
        Entries
      </h2>
      {data ? <p className={styles.count}>{data.page.total_items} in total</p> : null}
      {body}
      <DeleteEntryDialog
        entry={pendingDelete}
        deleting={remove.isPending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          setPendingDelete(null);
        }}
      />
    </section>
  );
}
