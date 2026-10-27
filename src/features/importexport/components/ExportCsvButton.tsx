import { Button, useToast } from '../../../components';
import { downloadTextFile } from '../../../lib/download';
import { useExportEntries } from '../api/useExportEntries';
import { csvFileName, entriesToCsv } from '../model/csv';

/** Downloads every entry as a CSV file (FR-IO-05). Excel is the usual reader, so the file starts with a UTF-8 byte-order mark. */
export function ExportCsvButton() {
  const toast = useToast();
  const exportEntries = useExportEntries();

  const save = async () => {
    let entries;
    try {
      entries = await exportEntries.mutateAsync();
    } catch {
      toast.show('Your entries could not be exported. Check your connection and try again.', { tone: 'error' });
      return;
    }
    downloadTextFile(csvFileName(new Date()), 'text/csv;charset=utf-8', entriesToCsv(entries, { bom: true }));
    toast.show(`Exported ${String(entries.length)} ${entries.length === 1 ? 'entry' : 'entries'} to CSV.`, {
      tone: 'success',
    });
  };

  return (
    <Button
      variant="ghost"
      disabled={exportEntries.isPending}
      onClick={() => {
        void save();
      }}
    >
      {exportEntries.isPending ? 'Exporting…' : 'Export CSV'}
    </Button>
  );
}
