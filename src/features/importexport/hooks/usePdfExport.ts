import { useMutation } from '@tanstack/react-query';
import { ApiError, useApiClient } from '../../../lib/api';
import { saveBlob } from '../../../lib/download';
import { loadExportEntries } from '../api/loadExportEntries';
import type { GoalTargets } from '../model/goalSummary';
import { buildPdfReport } from '../model/pdfReport';

export interface PdfExportOptions {
  /** The person's goal targets, once the goals feature can supply them; the defaults apply to any goal left out. */
  targets?: GoalTargets;
  /** The clock, so a test can fix the date on the file (FE-25). */
  now?: () => Date;
}

/** Plain-language reason an export failed, for a toast (FE-37). */
export function pdfExportFailure(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) return 'Too many requests. Wait a moment and try again.';
  if (error instanceof ApiError && error.status === undefined) {
    return 'The PDF could not be made because your hours could not be loaded. Check your connection and try again.';
  }
  return 'The PDF could not be made. Try again.';
}

/**
 * Exports the whole ledger as a PDF: reads every page of `GET /export/entries`, then loads the PDF library and builds
 * the file in the browser, with no request once the data is in hand. The library is a separate chunk that is fetched
 * here, on the first export, and not before (FE-55).
 */
export function usePdfExport({ targets, now = () => new Date() }: PdfExportOptions = {}) {
  const client = useApiClient();
  return useMutation<string>({
    mutationFn: async () => {
      // Start fetching the chunk while the entries load; it is not requested at all until an export is asked for.
      const library = import('../pdf/buildPdf');
      const entries = await loadExportEntries(client);
      const report = buildPdfReport(entries, now(), targets);
      const { buildPdf } = await library;
      const bytes = await buildPdf(report);
      const filename = `service-hours-${report.generatedOn}.pdf`;
      saveBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), filename);
      return filename;
    },
  });
}
