import { useQueryClient } from '@tanstack/react-query';
import { NEXT_STATUSES, type Order, type OrderStatus } from '@ferme/core';
import { source } from '@/lib/data';
import { STATUS } from '@/lib/format';
import { invalidateOrders } from '@/lib/queries';
import { useConfirm } from '@/hooks/useConfirm';
import { useMutate } from '@/hooks/useMutate';

const STYLE: Record<OrderStatus, string> = {
  nouvelle: 'btn-ghost',
  confirmee: 'btn-primary',
  en_preparation: 'btn-primary',
  en_livraison: 'btn-primary',
  livree: 'btn-yolk',
  annulee: 'btn-ghost text-paprika',
  refusee: 'btn-danger',
};

/** N'affiche que les transitions permises par `NEXT_STATUSES`. Annuler et refuser demandent confirmation. */
export function OrderActions({ order, size = 'md', onDone }: { order: Order; size?: 'sm' | 'md'; onDone?: (o: Order) => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const m = useMutate((args: { status: OrderStatus; note?: string }) => source.setOrderStatus(order.id, args.status, args.note), {
    success: 'Statut mis à jour',
    onSuccess: (o) => {
      invalidateOrders(qc);
      onDone?.(o);
    },
  });
  const next = NEXT_STATUSES[order.status];
  if (next.length === 0) return null;

  const go = async (status: OrderStatus) => {
    if (status === 'annulee' || status === 'refusee') {
      const r = await confirm({
        title: status === 'annulee' ? `Annuler la commande ${order.number} ?` : `Commande ${order.number} refusée à la livraison ?`,
        message: 'Le client n’est pas prévenu automatiquement : appelez-le si besoin.',
        confirmLabel: status === 'annulee' ? 'Annuler la commande' : 'Marquer refusée',
        cancelLabel: 'Retour',
        danger: true,
        noteLabel: 'Motif (facultatif)',
      });
      if (!r.ok) return;
      m.mutate({ status, note: r.note || undefined });
      return;
    }
    m.mutate({ status });
  };

  const sz = size === 'sm' ? 'btn-sm' : '';
  return (
    <div className="flex flex-wrap gap-2">
      {next.map((s) => (
        <button key={s} type="button" className={`${STYLE[s]} ${sz}`} disabled={m.isPending} onClick={() => void go(s)}>
          {STATUS[s].action}
        </button>
      ))}
    </div>
  );
}
