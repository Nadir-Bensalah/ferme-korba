import { useEffect, useRef, useState } from 'react';
import type { ConfirmOptions } from '@/hooks/useConfirm';

export function ConfirmDialog({
  options,
  onCancel,
  onConfirm,
}: {
  options: ConfirmOptions;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 p-3 sm:items-center" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="card animate-pop w-full max-w-md p-5 safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-bold">
          {options.title}
        </h2>
        {options.message && <p className="mt-2 text-sm text-ink-2">{options.message}</p>}
        {options.noteLabel && (
          <label className="mt-4 block">
            <span className="label">{options.noteLabel}</span>
            <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </label>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {options.cancelLabel ?? 'Retour'}
          </button>
          <button ref={first} type="button" className={options.danger ? 'btn-danger' : 'btn-primary'} onClick={() => onConfirm(note.trim())}>
            {options.confirmLabel ?? 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
