import { Button } from '../../../components';
import { pageCount } from '../model/viewState';
import styles from './EntriesTable.module.css';

export interface EntriesPaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

/** Previous / Next with the position announced politely. Hidden when everything fits on one page. */
export function EntriesPagination({ page, pageSize, totalItems, onPageChange }: EntriesPaginationProps) {
  const pages = pageCount(totalItems, pageSize);
  if (pages === 1) return null;
  return (
    <nav className={styles.pagination} aria-label="Entries pages">
      <Button
        variant="ghost"
        disabled={page <= 1}
        onClick={() => {
          onPageChange(page - 1);
        }}
      >
        Previous
      </Button>
      <p role="status" className={styles.position}>
        Page {page} of {pages}
      </p>
      <Button
        variant="ghost"
        disabled={page >= pages}
        onClick={() => {
          onPageChange(page + 1);
        }}
      >
        Next
      </Button>
    </nav>
  );
}
