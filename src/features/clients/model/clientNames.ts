import type { components } from '../../../lib/api';

/** The parts of a saved client the picker needs (FE-21). */
export type ClientOption = Pick<components['schemas']['Client'], 'id' | 'name'>;

/** From the spec: `ClientRequest.name` and `Entry` client_ids limits. */
export const MAX_CLIENT_NAME_LENGTH = 64;
export const MAX_CLIENTS_PER_ENTRY = 50;

/** Leading and trailing spaces never count; the server stays the authority on everything else (FE-40). */
export function normalizeClientName(raw: string): string {
  return raw.trim();
}

/** A plain-language message when the name cannot be saved, or `undefined` when it can. */
export function validateClientName(raw: string): string | undefined {
  const name = normalizeClientName(raw);
  if (name === '') return 'Enter a name or initials for the client.';
  if (name.length > MAX_CLIENT_NAME_LENGTH) {
    return `Use ${String(MAX_CLIENT_NAME_LENGTH)} characters or fewer.`;
  }
  return undefined;
}

/** The saved client with this name, ignoring letter case, as the server does (FR-LOG-06). */
export function findClientByName(clients: readonly ClientOption[], raw: string): ClientOption | undefined {
  const wanted = normalizeClientName(raw).toLowerCase();
  return clients.find((client) => client.name.toLowerCase() === wanted);
}

/** Text for the closed dropdown: nothing chosen, one or two names, or a count. */
export function summarizeSelection(clients: readonly ClientOption[], selectedIds: readonly string[]): string {
  if (selectedIds.length === 0) return 'Choose clients';
  // Names appear in list order, so the same selection always reads the same.
  const names = clients.filter((client) => selectedIds.includes(client.id)).map((client) => client.name);
  if (selectedIds.length <= 2 && names.length === selectedIds.length) return names.join(', ');
  const count = selectedIds.length;
  return `${String(count)} ${count === 1 ? 'client' : 'clients'} selected`;
}

/** Ids with `id` switched on or off, keeping the order they were chosen in. */
export function toggleId(selectedIds: readonly string[], id: string): string[] {
  return selectedIds.includes(id) ? selectedIds.filter((existing) => existing !== id) : [...selectedIds, id];
}
