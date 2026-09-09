import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Affiche un champ de note facultative, avec ce libellé. */
  noteLabel?: string;
}

export type ConfirmResult = { ok: false } | { ok: true; note: string };
type ConfirmFn = (opts: ConfirmOptions) => Promise<ConfirmResult>;

const Ctx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((r: ConfirmResult) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<ConfirmResult>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (r: ConfirmResult) => {
    resolver.current?.(r);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && <ConfirmDialog options={opts} onCancel={() => finish({ ok: false })} onConfirm={(note) => finish({ ok: true, note })} />}
    </Ctx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const fn = useContext(Ctx);
  if (!fn) throw new Error('ConfirmProvider manquant');
  return fn;
}
