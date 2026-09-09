import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { formatPhone, formatPrice, type Order } from '@ferme/core';
import { StatusBadge } from './StatusBadge';
import { OrderActions } from './OrderActions';
import { fmtDateTime, fmtTime, orderAmount, relativeDay, telHref } from '@/lib/format';

/** Cartes sur téléphone, tableau sur bureau. Les deux mènent au détail. */
export function OrderList({ orders, actions }: { orders: Order[]; actions?: boolean }) {
  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {orders.map((o) => (
          <li key={o.id} className="card-flat p-3">
            <div className="flex items-start justify-between gap-2">
              <Link to={`/commandes/${o.id}`} className="min-w-0">
                <div className="font-bold tabular">{o.number}</div>
                <div className="text-xs text-ink-3">{fmtDateTime(o.created_at)}</div>
              </Link>
              <StatusBadge status={o.status} size="sm" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Link to={`/commandes/${o.id}`} className="min-w-0 flex-1">
                <div className="truncate font-semibold">{o.customer.name}</div>
                <div className="truncate text-sm text-ink-2">
                  {o.address.zone_name.fr} · {relativeDay(o.delivery_date)}, {o.slot.from} à {o.slot.to}
                </div>
              </Link>
              <a href={telHref(o.customer.phone)} className="btn-soft btn-icon shrink-0" aria-label={`Appeler ${formatPhone(o.customer.phone)}`}>
                <Phone className="size-5" />
              </a>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-bold tabular">{formatPrice(orderAmount(o), 'fr')}</span>
              <span className="text-xs text-ink-3">
                {o.items.length} article{o.items.length > 1 ? 's' : ''}
              </span>
            </div>
            {actions && (
              <div className="mt-3">
                <OrderActions order={o} size="sm" />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="card-flat hidden overflow-x-auto md:block">
        <table className="table">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Heure</th>
              <th>Client</th>
              <th>Zone</th>
              <th>Livraison</th>
              <th className="text-right">Total</th>
              <th>Statut</th>
              {actions && <th />}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link to={`/commandes/${o.id}`} className="font-bold tabular hover:underline">
                    {o.number}
                  </Link>
                </td>
                <td className="whitespace-nowrap text-ink-2">
                  <div>{fmtTime(o.created_at)}</div>
                  <div className="text-xs text-ink-3">{relativeDay(o.created_at.slice(0, 10))}</div>
                </td>
                <td>
                  <div className="font-semibold">{o.customer.name}</div>
                  <a href={telHref(o.customer.phone)} className="inline-flex items-center gap-1 text-sm text-prairie hover:underline">
                    <Phone className="size-3.5" /> {formatPhone(o.customer.phone)}
                  </a>
                </td>
                <td className="text-ink-2">{o.address.zone_name.fr}</td>
                <td className="whitespace-nowrap">
                  <div className="font-medium">{relativeDay(o.delivery_date)}</div>
                  <div className="text-xs text-ink-3">
                    {o.slot.label.fr}, {o.slot.from} à {o.slot.to}
                  </div>
                </td>
                <td className="text-right font-bold tabular">{formatPrice(orderAmount(o), 'fr')}</td>
                <td>
                  <StatusBadge status={o.status} size="sm" />
                </td>
                {actions && (
                  <td className="text-right">
                    <OrderActions order={o} size="sm" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
