import { useRef } from 'react';
import { Button } from '../../../components';
import { useClientsQuery } from '../api/useClientsQuery';
import { useAddClient } from '../hooks/useAddClient';
import { AddClientInline } from './AddClientInline';
import { ClientMultiSelect } from './ClientMultiSelect';
import styles from './ClientPicker.module.css';

export interface ClientPickerProps {
  /** Ids of the chosen clients, in the order they were chosen. */
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
}

const CLIENT_WARNING = 'Use pseudonyms or initials only, never real names.';

/** Saved clients as a checkbox dropdown with a "+" that adds one inline (FR-LOG-06, FR-LOG-09). */
export function ClientPicker({ selectedIds, onChange }: ClientPickerProps) {
  const query = useClientsQuery();
  const clients = query.data ?? [];
  const add = useAddClient({ clients, selectedIds, onChange });
  const plusRef = useRef<HTMLButtonElement>(null);

  const finish = async () => {
    if (await add.submit()) plusRef.current?.focus();
  };
  const cancel = () => {
    add.cancel();
    plusRef.current?.focus();
  };

  return (
    <>
      <ClientMultiSelect
        label="Clients / groups"
        clients={clients}
        selectedIds={selectedIds}
        onChange={onChange}
        loading={query.isPending}
        onRetry={query.isError ? () => void query.refetch() : undefined}
        hint={CLIENT_WARNING}
        actions={
          <Button
            ref={plusRef}
            variant="ghost"
            className={styles.plus}
            aria-label="Add a new client or group"
            aria-expanded={add.open}
            onClick={add.open ? cancel : add.openInput}
          >
            +
          </Button>
        }
      >
        {add.open ? (
          <AddClientInline
            name={add.name}
            error={add.error}
            saving={add.saving}
            onChange={add.edit}
            onSubmit={() => void finish()}
            onCancel={cancel}
          />
        ) : null}
      </ClientMultiSelect>
      {/* Announces the outcome of an add after the input has closed. */}
      <p role="status" className={styles.srOnly}>
        {add.notice}
      </p>
    </>
  );
}
