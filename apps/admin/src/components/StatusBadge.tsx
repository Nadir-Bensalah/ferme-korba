import type { OrderStatus } from '@ferme/core';
import { STATUS } from '@/lib/format';

export function StatusBadge({ status, size = 'md' }: { status: OrderStatus; size?: 'sm' | 'md' }) {
  const s = STATUS[status];
  return (
    <span className={`chip ${s.cls} ${size === 'sm' ? 'px-2 text-[10px]' : ''}`}>
      <span className={`size-1.5 rounded-pill ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}
