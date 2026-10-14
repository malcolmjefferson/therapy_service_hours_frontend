import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { useCreateClient } from '../api/useCreateClient';
import {
  MAX_CLIENTS_PER_ENTRY,
  findClientByName,
  normalizeClientName,
  validateClientName,
  type ClientOption,
} from '../model/clientNames';

interface Options {
  clients: readonly ClientOption[];
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
}

/** Plain-language text for a failed save; the raw problem payload is never shown (FE-37). */
function saveFailure(error: unknown): string {
  if (!(error instanceof ApiError)) return 'The client could not be saved. Try again.';
  if (error.status === undefined) return 'The server could not be reached. Check your connection and try again.';
  if (error.status === 400) return error.problem?.detail ?? 'That name cannot be saved.';
  if (error.status === 429) return 'Too many requests. Wait a moment and try again.';
  return 'The client could not be saved. Try again.';
}

/** The inline "+" flow: validate, reuse a saved client of the same name, otherwise save, then select it. */
export function useAddClient({ clients, selectedIds, onChange }: Options) {
  const create = useCreateClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState('');
  // The save is async, so it reads the latest props rather than the ones from when it started.
  const latest = useRef({ clients, selectedIds, onChange });
  useEffect(() => {
    latest.current = { clients, selectedIds, onChange };
  });
  // One Idempotency-Key per user action, kept across retries of the same name (FE-34).
  const attempt = useRef<{ name: string; key: string } | null>(null);

  const openInput = () => {
    setError(undefined);
    setNotice('');
    setOpen(true);
  };

  const cancel = () => {
    setOpen(false);
    setName('');
    setError(undefined);
  };

  const edit = (value: string) => {
    setName(value);
    setError(undefined);
  };

  /** Selects the client, or explains why it cannot be. Returns whether the add is finished. */
  const finish = (client: ClientOption, message: string): boolean => {
    const current = latest.current;
    if (!current.selectedIds.includes(client.id)) {
      if (current.selectedIds.length >= MAX_CLIENTS_PER_ENTRY) {
        setError(`An entry can have up to ${String(MAX_CLIENTS_PER_ENTRY)} clients. Clear one first.`);
        return false;
      }
      current.onChange([...current.selectedIds, client.id]);
    }
    setNotice(message);
    setName('');
    setError(undefined);
    setOpen(false);
    return true;
  };

  /** Resolves true when the client ended up saved and selected. */
  const submit = async (): Promise<boolean> => {
    const problem = validateClientName(name);
    if (problem) {
      setError(problem);
      return false;
    }
    const wanted = normalizeClientName(name);
    const saved = findClientByName(latest.current.clients, wanted);
    if (saved) return finish(saved, `"${saved.name}" is already saved. Selected it.`);

    attempt.current = attempt.current?.name === wanted ? attempt.current : { name: wanted, key: crypto.randomUUID() };
    try {
      const result = await create.mutateAsync({ name: wanted, idempotencyKey: attempt.current.key });
      attempt.current = null;
      const { client } = result;
      return finish(
        client,
        result.kind === 'created'
          ? `Saved "${client.name}" and selected it.`
          : `"${client.name}" is already saved. Selected it.`,
      );
    } catch (failure) {
      setError(saveFailure(failure));
      return false;
    }
  };

  return { open, name, error, notice, saving: create.isPending, openInput, cancel, edit, submit };
}
