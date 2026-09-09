import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Users } from 'lucide-react';
import { ORDER_STATUSES, type OrderFilters, type OrderStatus } from '@ferme/core';
import { source } from '@/lib/data';
import { STATUS, todayISO } from '@/lib/format';
import { customersCSV, downloadCSV, ordersCSV } from '@/lib/csv';
import { useToast } from '@/hooks/useToast';
import { PageHeader } from '@/components/PageHeader';
import { Input, Select } from '@/components/Field';

const ALL = [...ORDER_STATUSES] as string[];

export function Export() {
  const [sp] = useSearchParams();
  const toast = useToast();
  const [status, setStatus] = useState(sp.get('status') ?? 'toutes');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [delivery, setDelivery] = useState(sp.get('date') ?? '');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [busy, setBusy] = useState<'orders' | 'customers' | null>(null);

  const exportOrders = async () => {
    setBusy('orders');
    try {
      const f: OrderFilters = { page: 1, page_size: 5000 };
      if (status === 'actives') f.status = 'actives';
      else if (ALL.includes(status)) f.status = status as OrderStatus;
      if (from) f.date_from = from;
      if (to) f.date_to = to;
      if (delivery) f.delivery_date = delivery;
      if (q.trim()) f.q = q.trim();
      const zone = sp.get('zone');
      if (zone) f.zone_id = zone;
      const { rows } = await source.listOrders(f);
      if (rows.length === 0) {
        toast.info('Rien à exporter', 'Aucune commande ne correspond.');
        return;
      }
      downloadCSV(`commandes-${todayISO()}.csv`, ordersCSV(rows));
      toast.success(`${rows.length} commande${rows.length > 1 ? 's' : ''} exportée${rows.length > 1 ? 's' : ''}`);
    } catch (e) {
      toast.error('Export impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const exportCustomers = async () => {
    setBusy('customers');
    try {
      const rows = await source.listCustomers();
      if (rows.length === 0) {
        toast.info('Rien à exporter', 'Aucun client.');
        return;
      }
      downloadCSV(`clients-${todayISO()}.csv`, customersCSV(rows));
      toast.success(`${rows.length} client${rows.length > 1 ? 's' : ''} exporté${rows.length > 1 ? 's' : ''}`);
    } catch (e) {
      toast.error('Export impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Export" subtitle="Fichiers CSV lisibles dans Excel : séparateur point-virgule, montants avec virgule" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-flat flex flex-col gap-3 p-4">
          <h2 className="text-base font-bold">Commandes</h2>
          <Select label="Statut" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="toutes">Toutes</option>
            <option value="actives">En cours (actives)</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Passées du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="au" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Input label="Livraison le" type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)} help="Vide : toutes les dates" />
          <Input label="Recherche" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Numéro, nom, téléphone" />
          <button type="button" className="btn-primary self-start" onClick={() => void exportOrders()} disabled={busy !== null}>
            <Download className="size-4" /> {busy === 'orders' ? 'Préparation…' : 'Télécharger le CSV des commandes'}
          </button>
        </section>
        <section className="card-flat flex flex-col gap-3 p-4">
          <h2 className="text-base font-bold">Clients</h2>
          <p className="text-sm text-ink-2">Nom, téléphone, e-mail, nombre de commandes et total dépensé.</p>
          <button type="button" className="btn-soft self-start" onClick={() => void exportCustomers()} disabled={busy !== null}>
            <Users className="size-4" /> {busy === 'customers' ? 'Préparation…' : 'Télécharger le CSV des clients'}
          </button>
        </section>
      </div>
    </div>
  );
}
