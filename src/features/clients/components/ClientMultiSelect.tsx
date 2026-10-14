import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '../../../components';
import { MAX_CLIENTS_PER_ENTRY, summarizeSelection, toggleId, type ClientOption } from '../model/clientNames';
import styles from './ClientPicker.module.css';

export interface ClientMultiSelectProps {
  label: string;
  clients: readonly ClientOption[];
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
  loading: boolean;
  /** Set when the saved clients could not be loaded; the panel offers a retry. */
  onRetry?: (() => void) | undefined;
  /** Helper text under the control (the pseudonym warning). */
  hint?: ReactNode;
  /** Sits beside the dropdown button (the "+" button). */
  actions?: ReactNode;
  /** Sits under the dropdown (the inline add input). */
  children?: ReactNode;
}

/**
 * A dropdown of checkboxes, not a list box: a button opens a panel in the page flow, so nothing is
 * clipped by the form around it. Native checkboxes give Tab and Space with no extra key handling.
 */
export function ClientMultiSelect({
  label,
  clients,
  selectedIds,
  onChange,
  loading,
  onRetry,
  hint,
  actions,
  children,
}: ClientMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const triggerId = useId();
  const panelId = useId();
  const hintId = useId();
  const atMax = selectedIds.length >= MAX_CLIENTS_PER_ENTRY;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    // The Escape handler only closes the panel; every control inside stays reachable by Tab.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={rootRef}
      className={styles.field}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        // Tabbing out closes the panel. A null relatedTarget (some browsers on click) is ignored.
        if (event.relatedTarget instanceof Node && !rootRef.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`${labelId} ${triggerId}`}
        aria-describedby={hint ? hintId : undefined}
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
        }}
      >
        {summarizeSelection(clients, selectedIds)}
      </button>
      {open ? (
        <div id={panelId} role="group" aria-labelledby={labelId} className={styles.panel}>
          {loading ? <p className={styles.note}>Loading clients…</p> : null}
          {onRetry ? (
            <div className={styles.note}>
              <p role="alert">Your clients could not be loaded.</p>
              <Button variant="ghost" onClick={onRetry}>
                Try again
              </Button>
            </div>
          ) : null}
          {!loading && !onRetry && clients.length === 0 ? (
            <p className={styles.note}>No saved clients yet. Use + to add one.</p>
          ) : null}
          <ul className={styles.options}>
            {clients.map((client) => {
              const checked = selectedIds.includes(client.id);
              return (
                <li key={client.id}>
                  <label className={styles.option}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && atMax}
                      onChange={() => {
                        onChange(toggleId(selectedIds, client.id));
                      }}
                    />
                    <span>{client.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {atMax ? <p className={styles.note}>An entry can have up to {MAX_CLIENTS_PER_ENTRY} clients.</p> : null}
        </div>
      ) : null}
      <div className={styles.actions}>{actions}</div>
      {children}
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
