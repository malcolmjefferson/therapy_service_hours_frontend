import { useState } from 'react';
import { Button } from '../../../components';
import { ImportDialog } from './ImportDialog';

/** The Import button for the Entries header: opens the import dialog. */
export function ImportButton({ onImported }: { onImported?: (() => void) | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          setOpen(true);
        }}
      >
        Import
      </Button>
      <ImportDialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        onImported={onImported}
      />
    </>
  );
}
