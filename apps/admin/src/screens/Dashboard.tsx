import { Link } from 'react-router-dom';
import { Route } from 'lucide-react';
import { formatPrice } from '@ferme/core';
import { useOffers, useOrders, useStats } from '@/lib/queries';
import { fmtDateLong, todayISO } from '@/lib/format';
import { Sparkline } from '@/components/Sparkline';
import { OrderList } from '@/components/OrderList';
import { EmptyState, ErrorState, SkeletonRows, SkeletonTiles } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

function Tile({ caption, value, sub, to, warn }: { caption: string; value: string; sub?: string; to?: string; warn?: boolean }) {
  const inner = (
    <>
      <div className="caption">{caption}</div>
      <div className={`value ${warn ? 'text-paprika' : ''}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </>
  );
  return to ? (
    <Link to={to} className={`stat-tile block hover:border-prairie ${warn ? 'border-paprika/40 bg-paprika-soft/40' : ''}`}>
      {inner}
    </Link>
  ) : (
    <div className="stat-tile">{inner}</div>
  );
}

export function Dashboard() {
  const today = todayISO();
  const stats = useStats();
  const todays = useOrders({ delivery_date: today, status: 'actives', page: 1, page_size: 100 });
  const offers = useOffers();
  const activeOffers = offers.data?.filter((o) => o.active).length;

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle={fmtDateLong(today)}
        actions={
          <Link to="/commandes/aujourdhui" className="btn-primary btn-sm">
            <Route className="size-4" /> Tournée du jour
          </Link>
        }
      />

      {stats.isPending ? (
        <SkeletonTiles count={6} />
      ) : stats.isError ? (
        <ErrorState error={stats.error} retry={() => void stats.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile caption="Commandes du jour" value={String(stats.data.today_orders)} sub={formatPrice(stats.data.today_revenue, 'fr')} />
            <Tile caption="Chiffre du jour" value={formatPrice(stats.data.today_revenue, 'fr')} />
            <Tile caption="À confirmer" value={String(stats.data.pending)} to="/commandes?status=nouvelle" warn={stats.data.pending > 0} sub={stats.data.pending > 0 ? 'Appelez le client' : 'Rien en attente'} />
            <Tile caption="7 derniers jours" value={formatPrice(stats.data.week_revenue, 'fr')} sub={`${stats.data.week_orders} commande${stats.data.week_orders > 1 ? 's' : ''}`} />
            <Tile caption="30 derniers jours" value={formatPrice(stats.data.month_revenue, 'fr')} />
            <Tile caption="Rupture ou bientôt" value={String(stats.data.low_stock)} to="/produits?stock=hors" warn={stats.data.low_stock > 0} sub="produits" />
            <Tile caption="Offres actives" value={activeOffers === undefined ? '…' : String(activeOffers)} to="/offres" sub={activeOffers === 0 ? 'Rien en avant sur la boutique' : 'sur l’accueil et la boutique'} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <section className="card-flat p-4 lg:col-span-2">
              <h2 className="text-base font-bold">14 derniers jours</h2>
              <div className="mt-2">
                <Sparkline data={stats.data.daily} />
              </div>
            </section>
            <section className="card-flat p-4">
              <h2 className="text-base font-bold">Les plus vendus (30 jours)</h2>
              {stats.data.top_products.length === 0 ? (
                <p className="mt-2 text-sm text-ink-3">Pas encore de vente.</p>
              ) : (
                <ol className="mt-2 flex flex-col gap-1.5">
                  {stats.data.top_products.map((p, i) => (
                    <li key={p.product_id} className="flex items-center gap-3 text-sm">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-prairie-soft text-xs font-bold text-prairie-deep">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{p.name.fr}</span>
                      <span className="font-semibold tabular">{Number.isInteger(p.qty) ? p.qty : p.qty.toFixed(1)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold">À livrer aujourd'hui</h2>
          {todays.data && todays.data.total > 0 && <span className="text-sm text-ink-3">{todays.data.total} en cours</span>}
        </div>
        {todays.isPending ? (
          <SkeletonRows rows={3} />
        ) : todays.isError ? (
          <ErrorState error={todays.error} retry={() => void todays.refetch()} />
        ) : todays.data.rows.length === 0 ? (
          <EmptyState
            title="Rien à livrer aujourd'hui"
            hint="Les commandes du jour apparaîtront ici avec leurs actions."
            action={
              <Link to="/commandes" className="btn-ghost btn-sm">
                Voir toutes les commandes
              </Link>
            }
          />
        ) : (
          <OrderList orders={todays.data.rows} actions />
        )}
      </section>
    </div>
  );
}
