import { useEffect } from 'react';
import styles from './Toast.module.css';
import type { ToastTone } from './useToast';

const toneClass = {
  info: styles.info,
  success: styles.success,
  error: styles.error,
} as const satisfies Record<ToastTone, string | undefined>;

export interface ToastItemProps {
  id: number;
  message: string;
  tone: ToastTone;
  durationMs: number;
  onDismiss: (id: number) => void;
}

/** One message with a dismiss button; closes itself after `durationMs`. */
export function ToastItem({ id, message, tone, durationMs, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDismiss(id);
    }, durationMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [id, durationMs, onDismiss]);

  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={`${styles.toast ?? ''} ${toneClass[tone] ?? ''}`}>
      <p className={styles.message}>{message}</p>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss notification"
        onClick={() => {
          onDismiss(id);
        }}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
