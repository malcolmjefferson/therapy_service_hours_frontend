import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Dialog.module.css';
import { trappedFocusTarget } from './focus';

export interface DialogProps {
  open: boolean;
  /** Called on Escape and on a click outside the panel. The caller decides whether to close. */
  onClose: () => void;
  /** Accessible name, shown as the heading. */
  title: string;
  children: ReactNode;
  /** Slot for the action buttons (FE-13). */
  footer?: ReactNode;
}

/** A modal dialog: traps Tab, closes on Escape, and returns focus to what opened it (FE-50). */
export function Dialog({ open, ...rest }: DialogProps) {
  return open ? createPortal(<DialogPanel {...rest} />, document.body) : null;
}

function DialogPanel({ onClose, title, children, footer }: Omit<DialogProps, 'open'>) {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // A child with `autoFocus` has already taken focus; otherwise focus the panel so the title is read first.
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus();
    }
    document.body.setAttribute('data-scroll-locked', '');

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === 'Tab' && panel) {
        const target = trappedFocusTarget(panel, document.activeElement, event.shiftKey);
        if (target) {
          event.preventDefault();
          target.focus();
        }
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      if (event.target === overlayRef.current) {
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
      document.body.removeAttribute('data-scroll-locked');
      opener?.focus();
    };
  }, []);

  return (
    <div ref={overlayRef} className={styles.overlay}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.panel}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}
