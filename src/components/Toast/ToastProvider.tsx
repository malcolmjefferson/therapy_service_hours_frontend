import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastItem } from './ToastItem';
import styles from './Toast.module.css';
import { ToastContext, type ToastApi, type ToastTone } from './useToast';

interface ToastEntry {
  id: number;
  message: string;
  tone: ToastTone;
  durationMs: number;
}

const DEFAULT_DURATION_MS = 6000;
const ERROR_DURATION_MS = 10_000;

/** Holds the visible toasts and renders them with polite or assertive announcements. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastEntry[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show: (message, options = {}) => {
        const tone = options.tone ?? 'info';
        const durationMs = options.durationMs ?? (tone === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);
        nextId.current += 1;
        const entry: ToastEntry = { id: nextId.current, message, tone, durationMs };
        setToasts((current) => [...current, entry]);
      },
    }),
    [],
  );

  const renderGroup = (errors: boolean) =>
    toasts
      .filter((toast) => (toast.tone === 'error') === errors)
      .map((toast) => <ToastItem key={toast.id} {...toast} onDismiss={dismiss} />);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.viewport}>
        {/* Stays mounted when empty so screen readers announce messages added later. */}
        <div role="status" aria-label="Notifications" className={styles.group}>
          {renderGroup(false)}
        </div>
        {/* Each error is its own alert, announced assertively as it is inserted. */}
        <div className={styles.group}>{renderGroup(true)}</div>
      </div>
    </ToastContext.Provider>
  );
}
