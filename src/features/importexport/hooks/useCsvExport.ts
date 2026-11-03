import { useMutation } from '@tanstack/react-query';
import { useApiClient } from '../../../lib/api';
import { saveBlob } from '../../../lib/download';
import { loadExportEntries } from '../api/loadExportEntries';
import { csvFileName, entriesToCsv } from '../model/csv';

export interface CsvExportOptions {
  /** The clock, so a test can fix the date on the file (FE-25). */
  now?: () => Date;
}

/** What the person is told when an export fails (FE-37). */
export const CSV_EXPORT_FAILURE = 'Your entries could not be exported. Check your connection and try again.';

/**
 * Exports the whole ledger as a CSV file: reads every page of `GET /export/entries`, builds the file in the browser
 * and saves it. Excel is the usual reader, so the file starts with a UTF-8 byte-order mark. Resolves to the number of
 * entries written. Nothing is saved if any page fails.
 */
export function useCsvExport({ now = () => new Date() }: CsvExportOptions = {}) {
  const client = useApiClient();
  return useMutation<number>({
    mutationFn: async () => {
      const entries = await loadExportEntries(client);
      const csv = entriesToCsv(entries, { bom: true });
      saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), csvFileName(now()));
      return entries.length;
    },
  });
}
