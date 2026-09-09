import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Printer } from 'lucide-react';
import { brand, formatPhone, formatPrice, formatQty, roundMillimes } from '@ferme/core';
import { useOrder } from '@/lib/queries';
import { fmtDateLong, fmtDateTimeNum, orderAmount } from '@/lib/format';
import { ErrorState, SkeletonRows } from '@/components/States';

/** Bon de livraison : une feuille, rien d'autre à l'impression. */
export function OrderPrint() {
  const { id = '' } = useParams();
  const order = useOrder(id);

  if (order.isPending) return <div className="p-6"><SkeletonRows rows={6} /></div>;
  if (order.isError) return <div className="p-6"><ErrorState error={order.error} retry={() => void order.refetch()} /></div>;
  const o = order.data;
  if (!o) return <div className="p-6">Commande introuvable.</div>;

  return (
    <div className="min-h-dvh bg-cream p-3 sm:p-6">
      <div className="no-print mx-auto mb-3 flex max-w-2xl items-center justify-between gap-2">
        <Link to={`/commandes/${o.id}`} className="btn-ghost btn-sm">
          <ChevronLeft className="size-4" /> Retour
        </Link>
        <button type="button" className="btn-primary btn-sm" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimer
        </button>
      </div>

      <article className="print-sheet card mx-auto max-w-2xl bg-paper p-6 text-sm text-ink sm:p-8">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="font-display text-xl font-bold">{brand.name.fr}</div>
            <div className="text-ink-2">{brand.address.fr}</div>
            <div className="text-ink-2">Tél. {brand.phoneDisplay}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wide text-ink-3">Bon de livraison</div>
            <div className="font-display text-xl font-bold tabular">{o.number}</div>
            <div className="text-xs text-ink-3">Commande du {fmtDateTimeNum(o.created_at)}</div>
          </div>
        </header>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-ink-3">Client</div>
            <div className="font-semibold">{o.customer.name}</div>
            <div>{formatPhone(o.customer.phone)}</div>
            <div className="mt-1">{o.address.street}</div>
            <div>
              {o.address.city} · {o.address.zone_name.fr}
            </div>
            {o.address.landmark && <div className="text-ink-2">Repère : {o.address.landmark}</div>}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-ink-3">Livraison</div>
            <div className="font-semibold">{fmtDateLong(o.delivery_date)}</div>
            <div>
              {o.slot.label.fr}, {o.slot.from} à {o.slot.to}
            </div>
            <div className="mt-1 font-semibold">Paiement à la livraison</div>
          </div>
        </div>

        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-b border-ink text-left text-xs uppercase tracking-wide text-ink-3">
              <th className="py-1.5">Article</th>
              <th className="py-1.5">Quantité</th>
              <th className="py-1.5 text-right">Poids pesé</th>
              <th className="py-1.5 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((it) => {
              const final = it.final_total ?? it.line_total;
              return (
                <tr key={it.id} className="border-b border-line">
                  <td className="py-2">
                    <div className="font-semibold">{it.name.fr}</div>
                    {it.pricing.mode !== 'per_piece' && <div className="text-xs text-ink-3">{formatPrice(it.pricing.price_per_kg, 'fr')} / kg</div>}
                  </td>
                  <td className="py-2 tabular">{formatQty(it.pricing, it.qty, 'fr')}</td>
                  <td className="py-2 text-right tabular">{it.pricing.mode === 'per_piece' ? '' : it.weighed_kg != null ? `${it.weighed_kg} kg` : '______ kg'}</td>
                  <td className="py-2 text-right tabular">{formatPrice(final, 'fr')}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 text-right text-ink-2">
                Sous-total
              </td>
              <td className="pt-3 text-right tabular">{formatPrice(roundMillimes(orderAmount(o) - o.delivery_fee), 'fr')}</td>
            </tr>
            <tr>
              <td colSpan={3} className="text-right text-ink-2">
                Livraison
              </td>
              <td className="text-right tabular">{o.delivery_fee === 0 ? 'Offerte' : formatPrice(o.delivery_fee, 'fr')}</td>
            </tr>
            <tr>
              <td colSpan={3} className="pt-2 text-right text-base font-bold">
                Total à encaisser
              </td>
              <td className="pt-2 text-right text-base font-bold tabular">{formatPrice(orderAmount(o), 'fr')}</td>
            </tr>
          </tfoot>
        </table>
        {o.final_total == null && o.items.some((it) => it.pricing.mode !== 'per_piece') && (
          <p className="mt-2 text-xs text-ink-3">Montant estimé : le prix des produits au kilo est ajusté au poids réel à la pesée.</p>
        )}
        {o.notes && (
          <div className="mt-4">
            <div className="text-xs font-bold uppercase tracking-wide text-ink-3">Notes</div>
            <p>{o.notes}</p>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-ink-3">Livré par</div>
            <div className="mt-8 border-t border-ink" />
          </div>
          <div>
            <div className="text-xs text-ink-3">Signature du client</div>
            <div className="mt-8 border-t border-ink" />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-ink-3">{brand.tagline.fr}</p>
      </article>
    </div>
  );
}
