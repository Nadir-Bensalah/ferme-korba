import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { formatPhone, formatPrice } from '@ferme/core';
import { useCustomers } from '@/lib/queries';
import { fmtDate, telHref } from '@/lib/format';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

export function Customers() {
  const [q, setQ] = useState('');
  const customers = useCustomers(q.trim());
  const local = (phone: string) => phone.replace(/^\+216/, '');

  return (
    <div>
      <PageHeader title="Clients" subtitle={customers.data ? `${customers.data.length} client${customers.data.length > 1 ? 's' : ''}` : undefined} />
      <input type="search" className="field field-sm mb-3" placeholder="Nom ou téléphone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un client" />
      {customers.isPending ? (
        <SkeletonRows rows={6} />
      ) : customers.isError ? (
        <ErrorState error={customers.error} retry={() => void customers.refetch()} />
      ) : customers.data.length === 0 ? (
        <EmptyState title="Aucun client" hint={q ? 'Personne ne correspond.' : 'Les clients apparaissent dès leur première commande.'} />
      ) : (
        <div className="card-flat overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Téléphone</th>
                <th className="text-right">Commandes</th>
                <th className="text-right">Total dépensé</th>
                <th className="hidden sm:table-cell">Depuis</th>
              </tr>
            </thead>
            <tbody>
              {customers.data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/commandes?q=${local(c.phone)}&status=toutes`} className="font-semibold hover:underline">
                      {c.name}
                    </Link>
                    {c.email && <div className="text-xs text-ink-3">{c.email}</div>}
                  </td>
                  <td>
                    <a href={telHref(c.phone)} className="inline-flex min-h-10 items-center gap-1 text-prairie hover:underline">
                      <Phone className="size-3.5" /> {formatPhone(c.phone)}
                    </a>
                  </td>
                  <td className="text-right tabular">
                    <Link to={`/commandes?q=${local(c.phone)}&status=toutes`} className="hover:underline">
                      {c.orders_count}
                    </Link>
                  </td>
                  <td className="text-right font-semibold tabular">{formatPrice(c.total_spent, 'fr')}</td>
                  <td className="hidden text-ink-3 sm:table-cell">{fmtDate(c.created_at.slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
