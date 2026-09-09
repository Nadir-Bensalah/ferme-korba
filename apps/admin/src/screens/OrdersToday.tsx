import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, Phone, Printer } from 'lucide-react';
import { formatPhone, formatPrice, formatQty, type Order } from '@ferme/core';
import { useOrders } from '@/lib/queries';
import { addDaysISO, fmtDateLong, mapsHref, orderAmount, relativeDay, telHref, todayISO } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { OrderActions } from '@/components/OrderActions';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

/** La tournée : les livraisons d'un jour, créneau par créneau. */
export function OrdersToday() {
  const [sp, setSp] = useSearchParams();
  const date = sp.get('date') ?? todayISO();
  const orders = useOrders({ delivery_date: date, page: 1, page_size: 500 });

  const groups = useMemo(() => {
    const rows = (orders.data?.rows ?? []).filter((o) => o.status !== 'annulee' && o.status !== 'refusee');
    const bySlot = new Map<string, { label: string; from: string; to: string; rows: Order[] }>();
    for (const o of rows) {
      const g = bySlot.get(o.slot.id) ?? { label: o.slot.label.fr, from: o.slot.from, to: o.slot.to, rows: [] };
      g.rows.push(o);
      bySlot.set(o.slot.id, g);
    }
    return [...bySlot.values()].sort((a, b) => a.from.localeCompare(b.from));
  }, [orders.data]);

  const all = groups.flatMap((g) => g.rows);
  const toCollect = all.filter((o) => o.status !== 'livree').reduce((s, o) => s + orderAmount(o), 0);
  const setDate = (d: string) => setSp(d === todayISO() ? {} : { date: d }, { replace: true });

  return (
    <div>
      <PageHeader
        title={`Tournée : ${relativeDay(date)}`}
        subtitle={fmtDateLong(date)}
        back="/commandes"
        actions={
          <div className="flex items-center gap-1">
            <button type="button" className="btn-ghost btn-icon" aria-label="Jour précédent" onClick={() => setDate(addDaysISO(date, -1))}>
              <ChevronLeft className="size-5" />
            </button>
            <input type="date" className="field field-sm w-40" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
            <button type="button" className="btn-ghost btn-icon" aria-label="Jour suivant" onClick={() => setDate(addDaysISO(date, 1))}>
              <ChevronRight className="size-5" />
            </button>
          </div>
        }
      />

      {orders.isPending ? (
        <SkeletonRows rows={4} height={120} />
      ) : orders.isError ? (
        <ErrorState error={orders.error} retry={() => void orders.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState title="Aucune livraison ce jour" hint="Changez de date ou revenez plus tard." />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="stat-tile">
              <div className="caption">Livraisons</div>
              <div className="value">{all.length}</div>
            </div>
            <div className="stat-tile">
              <div className="caption">Reste à encaisser</div>
              <div className="value text-lg sm:text-2xl">{formatPrice(toCollect, 'fr')}</div>
            </div>
            <div className="stat-tile col-span-2 sm:col-span-1">
              <div className="caption">Livrées</div>
              <div className="value">
                {all.filter((o) => o.status === 'livree').length} / {all.length}
              </div>
            </div>
          </div>

          {groups.map((g) => (
            <section key={g.from} className="mb-6">
              <h2 className="mb-2 flex items-baseline gap-2 text-base font-bold">
                {g.label}
                <span className="text-sm font-medium text-ink-3">
                  {g.from} à {g.to} · {g.rows.length}
                </span>
              </h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {g.rows.map((o) => (
                  <li key={o.id} className={`card-flat p-3 ${o.status === 'livree' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/commandes/${o.id}`} className="min-w-0">
                        <div className="font-bold tabular">{o.number}</div>
                        <div className="truncate font-semibold">{o.customer.name}</div>
                      </Link>
                      <StatusBadge status={o.status} size="sm" />
                    </div>
                    <div className="mt-1 text-sm text-ink-2">
                      {o.address.street}, {o.address.city}
                      {o.address.landmark && <span className="text-ink-3"> · {o.address.landmark}</span>}
                    </div>
                    <ul className="mt-2 text-sm text-ink-2">
                      {o.items.map((it) => (
                        <li key={it.id} className="flex justify-between gap-2">
                          <span className="truncate">{it.name.fr}</span>
                          <span className="shrink-0 tabular">{it.weighed_kg != null ? `${it.weighed_kg} kg pesé` : formatQty(it.pricing, it.qty, 'fr')}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-bold tabular">{formatPrice(orderAmount(o), 'fr')}</span>
                      <span className="text-xs text-ink-3">{o.final_total != null ? 'après pesée' : 'estimé'}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <a href={telHref(o.customer.phone)} className="btn-soft btn-sm" aria-label={`Appeler ${formatPhone(o.customer.phone)}`}>
                        <Phone className="size-4" /> {formatPhone(o.customer.phone)}
                      </a>
                      <a href={mapsHref(o)} target="_blank" rel="noopener" className="btn-ghost btn-sm">
                        <MapPin className="size-4" /> Plan
                      </a>
                      <Link to={`/commandes/${o.id}/imprimer`} className="btn-ghost btn-icon size-10" aria-label="Bon de livraison">
                        <Printer className="size-4" />
                      </Link>
                    </div>
                    <div className="mt-2">
                      <OrderActions order={o} size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
