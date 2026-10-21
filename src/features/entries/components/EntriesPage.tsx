import { useEffect, useRef, useState } from 'react';
import { EntriesPanel } from './EntriesPanel';
import { EntryEditor } from './EntryEditor';
import type { EntryRow } from './EntryTableRow';
import styles from './EntriesPage.module.css';

/**
 * `/app/entries`: the add form (or the edit form, once Edit is chosen on a row) above the entries table.
 * Only one form shows at a time. Closing an edit returns focus to that row's Edit button (FE-50).
 */
export function EntriesPage() {
  const [editing, setEditing] = useState<EntryRow | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<string | null>(null);

  const stopEditing = () => {
    returnTo.current = editing?.id ?? null;
    setEditing(null);
  };

  useEffect(() => {
    if (editing !== null || returnTo.current === null) return;
    const page = pageRef.current;
    // The edited row may have moved to another page or sort position, so fall back to the table heading.
    const button = [...(page?.querySelectorAll<HTMLElement>('[data-entry-edit]') ?? [])].find(
      (element) => element.dataset.entryEdit === returnTo.current,
    );
    (button ?? page?.querySelector<HTMLElement>('#entries-title'))?.focus();
    returnTo.current = null;
  }, [editing]);

  return (
    <div ref={pageRef} className={styles.page}>
      <EntryEditor
        key={editing?.id ?? 'new'}
        entry={editing ?? undefined}
        onSaved={stopEditing}
        onCancel={stopEditing}
      />
      <EntriesPanel
        onEdit={setEditing}
        onDeleted={(id) => {
          if (editing?.id === id) setEditing(null);
        }}
      />
    </div>
  );
}
