import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Route, X } from 'lucide-react';
import { ORDER_STATUSES, type OrderFilters, type OrderStatus } from '@ferme/core';
import { useOrders, useZones } from '@/lib/queries';
import { STATUS, addDaysISO, todayISO } from '@/lib/format';
import { OrderList } from '@/components/OrderList';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

const PAGE_SIZE = 25;
const ALL = [...ORDER_STATUSES] as string[];

/** Les filtres vivent dans l'adresse : ils survivent au rechargement et se partagent. */
export function filtersFromParams(sp: URLSearchParams): OrderFilters {
  const status = sp.get('status') ?? 'actives';
  const f: OrderFilters = { page: Math.max(1, Number(sp.get('page') ?? 1) || 1), page_size: PAGE_SIZE };
  if (status === 'actives') f.status = 'actives';
  else if (ALL.includes(status)) f.status = status as OrderStatus;
  const date = sp.get('date');
  if (date) f.delivery_date = date;
  const zone = sp.get('zone');
  if (zone) f.zone_id = zone;
  const q = sp.get('q');
  if (q) f.q = q;
  return f;
}

export function Orders() {
  const [sp, setSp] = useSearchParams();
  const filters = filtersFromParams(sp);
  const orders = useOrders(filters);
  const zones = useZones();
  const [q, setQ] = useState(sp.get('q') ?? '');
  useEffect(() => setQ(sp.get('q') ?? ''), [sp]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setSp(next, { replace: true });
  };

  const status = sp.get('status') ?? 'actives';
  const date = sp.get('date') ?? '';
  const today = todayISO();
  const hasFilters = status !== 'actives' || date || sp.get('zone') || sp.get('q');

  return (
    <div>
      <PageHeader
        title="Commandes"
        subtitle={orders.data ? `${orders.data.total} commande${orders.data.total > 1 ? 's' : ''}` : undefined}
        actions={
          <>
            <Link to="/commandes/aujourdhui" className="btn-soft btn-sm">
              <Route className="size-4" /> Tournée
            </Link>
            <Link to={`/export?${sp.toString()}`} className="btn-ghost btn-sm">
              <Download className="size-4" /> CSV
            </Link>
          </>
        }
      />

      <form
        className="card-flat mb-3 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: q.trim() || null });
        }}
      >
        <input type="search" className="field field-sm" placeholder="Numéro, nom, téléphone" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => set({ q: q.trim() || null })} aria-label="Recherche" />
        <select className="field field-sm" value={status} onChange={(e) => set({ status: e.target.value })} aria-label="Statut">
          <option value="actives">En cours (actives)</option>
          <option value="toutes">Toutes</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <input type="date" className="field field-sm" value={date} onChange={(e) => set({ date: e.target.value || null })} aria-label="Date de livraison" />
          {date && (
            <button type="button" className="btn-ghost btn-icon size-10 shrink-0" aria-label="Effacer la date" onClick={() => set({ date: null })}>
              <X className="size-4" />
            </button>
          )}
        </div>
        <select className="field field-sm" value={sp.get('zone') ?? ''} onChange={(e) => set({ zone: e.target.value || null })} aria-label="Zone">
          <option value="">Toutes les zones</option>
          {zones.data?.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name.fr}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5 sm:col-span-2 lg:col-span-4">
          <button type="button" className={`chip ${date === today ? 'bg-prairie text-white' : 'bg-cream-2 text-ink-2'}`} onClick={() => set({ date: date === today ? null : today })}>
            Livraison aujourd'hui
          </button>
          <button type="button" className={`chip ${date === addDaysISO(today, 1) ? 'bg-prairie text-white' : 'bg-cream-2 text-ink-2'}`} onClick={() => set({ date: date === addDaysISO(today, 1) ? null : addDaysISO(today, 1) })}>
            Demain
          </button>
          <button type="button" className={`chip ${status === 'nouvelle' ? 'bg-yolk text-ink' : 'bg-cream-2 text-ink-2'}`} onClick={() => set({ status: status === 'nouvelle' ? 'actives' : 'nouvelle' })}>
            À confirmer
          </button>
          {hasFilters && (
            <button type="button" className="chip bg-paper text-ink-3 underline" onClick={() => setSp(new URLSearchParams(), { replace: true })}>
              Tout effacer
            </button>
          )}
        </div>
      </form>

      {orders.isPending ? (
        <SkeletonRows rows={6} height={64} />
      ) : orders.isError ? (
        <ErrorState error={orders.error} retry={() => void orders.refetch()} />
      ) : orders.data.rows.length === 0 ? (
        <EmptyState
          title="Aucune commande"
          hint={hasFilters ? 'Essayez d’élargir les filtres.' : 'Les commandes passées sur la boutique arrivent ici.'}
          action={
            hasFilters ? (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setSp(new URLSearchParams(), { replace: true })}>
                Effacer les filtres
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <OrderList orders={orders.data.rows} actions />
          <Pagination page={filters.page ?? 1} pageSize={PAGE_SIZE} total={orders.data.total} onChange={(p) => set({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
