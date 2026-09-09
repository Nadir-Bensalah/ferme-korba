import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'order';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
  /** Route vers laquelle mener quand on touche le toast. */
  to?: string;
  /** Reste affiché jusqu'à ce qu'on le ferme. */
  persistent?: boolean;
}

interface ToastApi {
  toasts: Toast[];
  push(t: Omit<Toast, 'id'>): number;
  dismiss(id: number): void;
  success(title: string, body?: string): void;
  error(title: string, body?: string): void;
  info(title: string, body?: string): void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++seq.current;
      setToasts((all) => [...all, { ...t, id }].slice(-5));
      if (!t.persistent) setTimeout(() => dismiss(id), t.kind === 'error' ? 6000 : 3500);
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toasts,
      push,
      dismiss,
      success: (title, body) => void push({ kind: 'success', title, body }),
      error: (title, body) => void push({ kind: 'error', title, body }),
      info: (title, body) => void push({ kind: 'info', title, body }),
    }),
    [toasts, push, dismiss],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useToast(): ToastApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('ToastProvider manquant');
  return api;
}
