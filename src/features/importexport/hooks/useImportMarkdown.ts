import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, useApiClient, type components } from '../../../lib/api';
import { clientKeys } from '../../clients';

type ImportReport = components['schemas']['ImportReport'];

export interface ImportInput {
  file: File;
  /** One key per user action, reused when the same file is retried (FE-34). */
  idempotencyKey: string;
}

/**
 * Uploads a Markdown ledger and resolves to the server's report. A bad row does not fail the import (it is listed in
 * the report), so only a refused or unreachable request is an error. Merged clients change the saved client list.
 */
export function useImportMarkdown() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<ImportReport, ApiError, ImportInput>({
    mutationFn: async ({ file, idempotencyKey }) => {
      let result;
      try {
        result = await client.POST('/import/markdown', {
          // The generated type calls a binary part a string; the serializer below sends the real file.
          body: { file: file as unknown as string },
          bodySerializer: () => {
            const form = new FormData();
            // Browsers often give a .md file no type, and the server accepts only text types.
            form.append('file', new File([file], file.name, { type: 'text/markdown' }));
            return form;
          },
          params: { header: { 'Idempotency-Key': idempotencyKey } },
        });
      } catch {
        throw new ApiError(undefined, undefined);
      }
      if (result.data) return result.data;
      // A gateway rejection is `{ message }`, not a problem body.
      throw new ApiError(result.response.status, 'type' in result.error ? result.error : undefined);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientKeys.list() }),
  });
}
