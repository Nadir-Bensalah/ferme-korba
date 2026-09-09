import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="flex items-center justify-between gap-3 py-2 text-sm" aria-label="Pagination">
      <span className="text-ink-3">
        {from} à {to} sur {total}
      </span>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost btn-icon" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Page précédente">
          <ChevronLeft className="size-5" />
        </button>
        <span className="flex min-w-12 items-center justify-center font-semibold tabular">
          {page} / {pages}
        </span>
        <button type="button" className="btn-ghost btn-icon" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Page suivante">
          <ChevronRight className="size-5" />
        </button>
      </div>
    </nav>
  );
}
