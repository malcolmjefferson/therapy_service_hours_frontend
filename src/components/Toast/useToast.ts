import { createContext, useContext } from 'react';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastOptions {
  tone?: ToastTone;
  /** Milliseconds before it closes itself. Defaults to 6 s, or 10 s for errors. */
  durationMs?: number;
}

export interface ToastApi {
  /** Shows a message. The text is rendered as text only (FE-60). */
  show: (message: string, options?: ToastOptions) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** The toast service, provided once in `AppProviders` (FE-23). */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return api;
}
