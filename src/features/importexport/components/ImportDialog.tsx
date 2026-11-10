import { useRef, useState, type ChangeEvent } from 'react';
import { Button, Dialog, FormField, Input } from '../../../components';
import { saveBlob } from '../../../lib/download';
import { useImportMarkdown } from '../hooks/useImportMarkdown';
import { checkLedgerFile, importFailureMessage, reportFileName, reportToText } from '../model/importReport';
import { ImportReportView } from './ImportReportView';
import styles from './Import.module.css';

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called once an import has finished, so the page can refresh what it shows. */
  onImported?: (() => void) | undefined;
  /** The clock, so a test can fix the date on the report (FE-25). */
  now?: () => Date;
}

/** Chooses a Markdown ledger, uploads it, and shows the report. Escape and Close work at every step (FE-50). */
export function ImportDialog({ open, onClose, onImported, now = () => new Date() }: ImportDialogProps) {
  const upload = useImportMarkdown();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const keyRef = useRef(crypto.randomUUID());
  const report = upload.data;
  const busy = upload.isPending;

  const close = () => {
    if (busy) return;
    setFile(null);
    setFileError(undefined);
    upload.reset();
    keyRef.current = crypto.randomUUID();
    onClose();
  };

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    setFile(chosen);
    setFileError(chosen ? checkLedgerFile(chosen) : undefined);
    upload.reset();
    keyRef.current = crypto.randomUUID(); // a different file is a different action
  };

  const submit = () => {
    if (!file || fileError) return;
    upload.mutate({ file, idempotencyKey: keyRef.current }, onImported ? { onSuccess: onImported } : {});
  };

  const failure = upload.error ? importFailureMessage(upload.error.status, upload.error.problem?.type) : undefined;
  const footer = report ? (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          const date = now();
          const text = reportToText(report, file?.name ?? 'ledger.md', date);
          saveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), reportFileName(date));
        }}
      >
        Download report
      </Button>
      <Button onClick={close}>Close</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={close} disabled={busy}>
        Cancel
      </Button>
      <Button onClick={submit} disabled={!file || Boolean(fileError) || busy}>
        {busy ? 'Importing…' : 'Import'}
      </Button>
    </>
  );

  return (
    <Dialog open={open} onClose={close} title={report ? 'Import report' : 'Import a Markdown ledger'} footer={footer}>
      {report ? (
        <ImportReportView report={report} />
      ) : (
        <>
          <FormField
            label="Markdown ledger (.md)"
            error={fileError}
            hint="Entries you already have are skipped. Use pseudonyms or initials only."
          >
            {(control) => (
              <Input {...control} type="file" accept=".md,.markdown,.txt,text/markdown" onChange={choose} />
            )}
          </FormField>
          {busy ? <progress aria-label="Importing" className={styles.progress} /> : null}
          {failure ? (
            <p role="alert" className={styles.error}>
              {failure}
              {upload.error?.requestId ? ` Reference: ${upload.error.requestId}` : ''}
            </p>
          ) : null}
        </>
      )}
    </Dialog>
  );
}
