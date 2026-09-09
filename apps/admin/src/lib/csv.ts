import type { CustomerProfile, Order } from '@ferme/core';
import { formatPhone, formatQty } from '@ferme/core';
import { STATUS, fmtDateNum, fmtDateTimeNum, orderAmount } from './format';

type Cell = string | number | null | undefined;

/** Montant avec virgule, trois décimales : Excel en français le lit comme un nombre. */
export function csvAmount(n: number): string {
  return n.toFixed(3).replace('.', ',');
}

function escapeCell(v: Cell): string {
  if (v == null) return '';
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Séparateur « ; » et fins de ligne CRLF : ce qu'Excel attend en français. */
export function toCSV(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(';'));
  return lines.join('\r\n');
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ordersCSV(orders: Order[]): string {
  const headers = [
    'Numéro',
    'Créée le',
    'Statut',
    'Client',
    'Téléphone',
    'Zone',
    'Adresse',
    'Ville',
    'Repère',
    'Livraison',
    'Créneau',
    'Articles',
    'Sous-total',
    'Livraison (frais)',
    'Total estimé',
    'Total final',
    'Notes',
  ];
  const rows = orders.map((o) => [
    o.number,
    fmtDateTimeNum(o.created_at),
    STATUS[o.status].label,
    o.customer.name,
    formatPhone(o.customer.phone),
    o.address.zone_name.fr,
    o.address.street,
    o.address.city,
    o.address.landmark ?? '',
    fmtDateNum(o.delivery_date),
    `${o.slot.label.fr} ${o.slot.from}-${o.slot.to}`,
    o.items.map((it) => `${it.name.fr} × ${formatQty(it.pricing, it.qty, 'fr')}`).join(' | '),
    csvAmount(o.subtotal),
    csvAmount(o.delivery_fee),
    csvAmount(o.total),
    o.final_total != null ? csvAmount(o.final_total) : '',
    o.notes ?? '',
  ]);
  return toCSV(headers, rows);
}

export function customersCSV(rows: (CustomerProfile & { orders_count: number; total_spent: number })[]): string {
  const headers = ['Nom', 'Téléphone', 'E-mail', 'Commandes', 'Total dépensé', 'Client depuis'];
  return toCSV(
    headers,
    rows.map((c) => [c.name, formatPhone(c.phone), c.email ?? '', c.orders_count, csvAmount(c.total_spent), fmtDateNum(c.created_at.slice(0, 10))]),
  );
}

export { orderAmount };
