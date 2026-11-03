import { Button, useToast } from '../../../components';
import { CSV_EXPORT_FAILURE, useCsvExport } from '../hooks/useCsvExport';

/** Downloads every entry as a CSV file (FR-IO-05) and announces the result by toast. */
export function ExportCsvButton() {
  const toast = useToast();
  const { mutate, isPending } = useCsvExport();
  return (
    <Button
      variant="ghost"
      disabled={isPending}
      onClick={() => {
        mutate(undefined, {
          onSuccess: (count) => {
            toast.show(`Exported ${String(count)} ${count === 1 ? 'entry' : 'entries'} to CSV.`, { tone: 'success' });
          },
          onError: () => {
            toast.show(CSV_EXPORT_FAILURE, { tone: 'error' });
          },
        });
      }}
    >
      {isPending ? 'Exporting…' : 'Export CSV'}
    </Button>
  );
}
