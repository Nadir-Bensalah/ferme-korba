import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToast, type Toast } from '@/hooks/useToast';

const STYLE: Record<Toast['kind'], { icon: typeof Bell; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'border-prairie/30 bg-paper' },
  error: { icon: XCircle, cls: 'border-paprika/40 bg-paper' },
  info: { icon: Info, cls: 'border-line-2 bg-paper' },
  order: { icon: Bell, cls: 'border-yolk bg-yolk-soft' },
};

const ICON_CLS: Record<Toast['kind'], string> = {
  success: 'text-prairie',
  error: 'text-paprika',
  info: 'text-ink-3',
  order: 'text-yolk-deep',
};

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  const navigate = useNavigate();
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[80] flex flex-col items-center gap-2 px-3" role="status" aria-live="polite">
      {toasts.map((t) => {
        const S = STYLE[t.kind];
        const Icon = S.icon;
        const open = () => {
          if (t.to) navigate(t.to);
          dismiss(t.id);
        };
        return (
          <div key={t.id} className={`pointer-events-auto animate-slide-down flex w-full max-w-md items-start gap-3 rounded-md border p-3 shadow-float ${S.cls}`}>
            <Icon className={`mt-0.5 size-5 shrink-0 ${ICON_CLS[t.kind]}`} />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={open}>
              <div className="text-sm font-bold">{t.title}</div>
              {t.body && <div className="mt-0.5 text-sm text-ink-2">{t.body}</div>}
              {t.to && <div className="mt-1 text-xs font-semibold text-prairie">Ouvrir</div>}
            </button>
            <button type="button" aria-label="Fermer" className="-m-1 flex size-10 items-center justify-center rounded-pill hover:bg-ink/5" onClick={() => dismiss(t.id)}>
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
