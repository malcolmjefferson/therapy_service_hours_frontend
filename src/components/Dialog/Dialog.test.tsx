import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { useEffect, useRef, useState } from 'react';
import { describe, expect, test } from 'vitest';
import { Button } from '../Button';
import { Dialog } from './Dialog';

/** A confirm button that takes focus as soon as it mounts, as a caller choosing the safe default might. */
function FocusOnMountButton({ onClick }: { onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <Button ref={ref} onClick={onClick}>
      Delete
    </Button>
  );
}

function Harness({ autoFocusConfirm = false }: { autoFocusConfirm?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Delete entry
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Delete this entry?"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Keep
            </Button>
            {autoFocusConfirm ? <FocusOnMountButton onClick={close} /> : <Button onClick={close}>Delete</Button>}
          </>
        }
      >
        <p>This cannot be undone.</p>
      </Dialog>
    </>
  );
}

async function openDialog(autoFocusConfirm = false) {
  const user = userEvent.setup();
  render(<Harness autoFocusConfirm={autoFocusConfirm} />);
  await user.click(screen.getByRole('button', { name: 'Delete entry' }));
  return user;
}

describe('Dialog', () => {
  test('renders nothing while closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('is a modal dialog named by its title, with focus moved into it', async () => {
    await openDialog();
    const dialog = screen.getByRole('dialog', { name: 'Delete this entry?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  test('keeps focus on a control that asked for it', async () => {
    await openDialog(true);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
  });

  test('traps Tab and Shift+Tab inside the dialog', async () => {
    const user = await openDialog();
    const keep = screen.getByRole('button', { name: 'Keep' });
    const del = screen.getByRole('button', { name: 'Delete' });
    await user.tab();
    expect(keep).toHaveFocus();
    await user.tab();
    expect(del).toHaveFocus();
    await user.tab();
    expect(keep).toHaveFocus();
    await user.tab({ shift: true });
    expect(del).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Delete entry', hidden: true })).not.toHaveFocus();
  });

  test('closes on Escape and returns focus to the button that opened it', async () => {
    const user = await openDialog();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete entry' })).toHaveFocus();
  });

  test('closes from a footer button and restores focus', async () => {
    const user = await openDialog();
    await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete entry' })).toHaveFocus();
  });

  test('closes on a click outside the panel but not inside it', async () => {
    const user = await openDialog();
    await user.click(screen.getByText('This cannot be undone.'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const overlay = screen.getByRole('dialog').parentElement;
    if (!overlay) {
      throw new Error('the dialog panel sits inside its overlay');
    }
    await user.click(overlay);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('stops the page behind from scrolling only while open', async () => {
    const user = await openDialog();
    expect(document.body).toHaveAttribute('data-scroll-locked');
    await user.keyboard('{Escape}');
    expect(document.body).not.toHaveAttribute('data-scroll-locked');
  });

  test('has no axe violations while open', async () => {
    await openDialog();
    const results = await axe.run(document.body, { resultTypes: ['violations'] });
    expect(results.violations).toEqual([]);
  });
});
