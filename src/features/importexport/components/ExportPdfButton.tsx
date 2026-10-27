import { Button, useToast } from '../../../components';
import { pdfExportFailure, usePdfExport, type PdfExportOptions } from '../hooks/usePdfExport';

/**
 * "Export PDF": saves the whole ledger as a PDF made in the browser (FR-IO-06). While it works the button stays
 * focusable but ignores clicks (`aria-disabled`), so keyboard focus is not lost mid-export. The result is announced
 * by toast.
 */
export function ExportPdfButton(options: PdfExportOptions) {
  const toast = useToast();
  const { mutate, isPending } = usePdfExport(options);
  return (
    <Button
      variant="ghost"
      aria-disabled={isPending}
      onClick={() => {
        if (isPending) return;
        mutate(undefined, {
          onSuccess: (filename) => {
            toast.show(`Saved ${filename}.`, { tone: 'success' });
          },
          onError: (error) => {
            toast.show(pdfExportFailure(error), { tone: 'error' });
          },
        });
      }}
    >
      {isPending ? 'Making PDF…' : 'Export PDF'}
    </Button>
  );
}
