import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { errorMessage } from '@/lib/format';

export function SkeletonRows({ rows = 5, height = 56 }: { rows?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function SkeletonTiles({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton h-24" />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint, action, icon }: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card-flat flex flex-col items-center px-4 py-10 text-center">
      <div className="mb-3 text-ink-3">{icon ?? <Inbox className="size-8" />}</div>
      <div className="font-bold">{title}</div>
      {hint && <p className="mt-1 max-w-sm text-sm text-ink-3">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="card-flat flex flex-col items-center px-4 py-8 text-center" role="alert">
      <AlertTriangle className="mb-2 size-7 text-paprika" />
      <div className="font-bold">Impossible de charger</div>
      <p className="mt-1 text-sm text-ink-3">{errorMessage(error)}</p>
      {retry && (
        <button type="button" className="btn-ghost btn-sm mt-4" onClick={retry}>
          <RefreshCw className="size-4" /> Réessayer
        </button>
      )}
    </div>
  );
}
