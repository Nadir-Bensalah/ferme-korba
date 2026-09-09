import { describe, expect, it } from 'vitest';
import { OrderError } from '../orders';
import {
  jsonToSummary,
  rowToOrder,
  rowToProduct,
  rowToSettings,
  rowToSlot,
  rowToZone,
  searchTerm,
  slotToRow,
  techEmail,
  toAuthError,
  toOrderError,
  toReadableError,
  tunisDayBounds,
  type OrderRow,
  type ProductRow,
} from './supabase';
import type { OrderSummaryForCustomer } from '../types';

/**
 * Le client Supabase n'est jamais instancié ici : on teste les fonctions pures
 * (mappage colonnes → types, transformation des erreurs) avec des objets qui
 * imitent ce que PostgREST renvoie, y compris les numeric en chaîne.
 */

describe('erreurs de create_order', () => {
  it('transforme un code connu en OrderError', () => {
    const e = toOrderError({ message: 'min_order', code: 'P0001', details: null, hint: null });
    expect(e).toBeInstanceOf(OrderError);
    expect((e as OrderError).code).toBe('min_order');
    expect((toOrderError({ message: 'bot' }) as OrderError).code).toBe('bot');
    expect((toOrderError({ message: 'date_not_allowed ' }) as OrderError).code).toBe('date_not_allowed');
  });
  it('laisse passer une OrderError déjà construite', () => {
    const src = new OrderError('zone_unknown');
    expect(toOrderError(src)).toBe(src);
  });
  it('rend une Error lisible pour le reste', () => {
    const e = toOrderError({ message: 'permission denied for table orders', code: '42501' });
    expect(e).not.toBeInstanceOf(OrderError);
    expect(e.message).toBe('permission denied for table orders');
    expect(toOrderError({ message: 'TypeError: Failed to fetch' }).message).toBe('network');
    expect(toOrderError(new TypeError('fetch failed')).message).toBe('network');
    expect(toOrderError(undefined).message).toBe('undefined');
  });
});

describe('erreurs réseau et auth', () => {
  it('reconnaît une panne réseau', () => {
    expect(toReadableError(new TypeError('Failed to fetch')).message).toBe('network');
    expect(toReadableError({ message: 'NetworkError when attempting to fetch resource.' }).message).toBe('network');
  });
  it('mappe les messages Supabase Auth vers les codes du mode démo', () => {
    expect(toAuthError({ message: 'User already registered' }).message).toBe('phone_taken');
    expect(toAuthError({ message: 'Invalid login credentials' }).message).toBe('bad_credentials');
    expect(toAuthError({ message: 'Password should be at least 8 characters' }).message).toBe('password.short');
    expect(toAuthError({ message: 'Request rate limit reached' }).message).toBe('rate_limited');
    expect(toAuthError({ message: 'something else' }).message).toBe('something else');
  });
});

describe('e-mail technique dérivé du téléphone', () => {
  it('retire le + et ajoute le domaine des clients', () => {
    expect(techEmail('+21651788518')).toBe('21651788518@clients.ferme-korba.tn');
  });
});

describe('mappage du catalogue', () => {
  const row: ProductRow = {
    id: 'p-poulet-fermier',
    slug: 'poulet-fermier-entier',
    category_id: 'cat-volailles',
    name: { fr: 'Poulet fermier entier', ar: 'دجاج بلدي كامل' },
    short: { fr: 'Court', ar: 'قصير' },
    description: { fr: 'Long', ar: 'طويل' },
    images: ['/images/products/poulet-entier.jpg'],
    pricing: { mode: 'per_kg_estimated', price_per_kg: 14.9, est_weight_kg: 1.7, max_qty: 10 },
    compare_at: '16.500',
    badges: ['fermier', 'best', 'inconnu'],
    stock: 'en_stock',
    is_featured: true,
    sort: 1,
    tips: null,
    updated_at: '2026-09-09T10:00:00+00:00',
  };
  it('renvoie exactement un Product', () => {
    const p = rowToProduct(row);
    expect(p).toEqual({
      id: 'p-poulet-fermier',
      slug: 'poulet-fermier-entier',
      category_id: 'cat-volailles',
      name: row.name,
      short: row.short,
      description: row.description,
      images: ['/images/products/poulet-entier.jpg'],
      pricing: row.pricing,
      compare_at: 16.5,
      badges: ['fermier', 'best'],
      stock: 'en_stock',
      is_featured: true,
      sort: 1,
      updated_at: '2026-09-09T10:00:00.000Z',
    });
    expect('tips' in p).toBe(false);
  });
  it('tolère les colonnes nulles et un stock inconnu', () => {
    const p = rowToProduct({ ...row, images: null, badges: null, compare_at: null, stock: 'bizarre', updated_at: null });
    expect(p.images).toEqual([]);
    expect(p.badges).toEqual([]);
    expect(p.compare_at).toBeUndefined();
    expect(p.stock).toBe('en_stock');
    expect(p.updated_at).toBeUndefined();
  });
  it('remappe slot_from / slot_to vers from / to, dans les deux sens', () => {
    const s = rowToSlot({ id: 's-matin', label: { fr: 'Matin', ar: 'صباحاً' }, slot_from: '09:00', slot_to: '12:00', days: [1, 2, 3], active: true, sort: 1 });
    expect(s.from).toBe('09:00');
    expect(s.to).toBe('12:00');
    expect(slotToRow(s)).toEqual({ id: 's-matin', label: s.label, slot_from: '09:00', slot_to: '12:00', days: [1, 2, 3], active: true, sort: 1 });
  });
  it('convertit les montants numeric en nombres', () => {
    const z = rowToZone({ id: 'z-korba', name: { fr: 'Korba', ar: 'قربة' }, areas: { fr: '', ar: '' }, fee: '3.000', free_from: '60.000', lead_days: 0, active: true, sort: 1 });
    expect(z.fee).toBe(3);
    expect(z.free_from).toBe(60);
    const st = rowToSettings({ shop_open: true, announcement: { fr: '', ar: '' }, min_order: '20.000', max_days_ahead: 6, cutoff_time: '18:00', closed_days: [0] });
    expect(st.min_order).toBe(20);
    expect(st.updated_at).toBeUndefined();
  });
});

describe('mappage des commandes', () => {
  const row: OrderRow = {
    id: '2490c53f-f3ca-4b24-a540-77c37c3f4556',
    number: 'FK-2026-00001',
    status: 'confirmee',
    lang: 'fr',
    customer_name: 'Salma Ben Ali',
    customer_phone: '+21651788518',
    customer_email: null,
    customer_user_id: null,
    zone_id: 'z-korba',
    zone_name: { fr: 'Korba et alentours', ar: 'قربة وضواحيها' },
    street: '12 rue des Orangers',
    city: 'Korba',
    landmark: null,
    delivery_date: '2026-09-10',
    slot_id: 's-matin',
    slot_label: { fr: 'Matin', ar: 'صباحاً' },
    slot_from: '09:00',
    slot_to: '12:00',
    subtotal: '32.530',
    delivery_fee: '3.000',
    total: '35.530',
    final_total: null,
    payment: 'cod',
    notes: null,
    tracking_token: 'ccda193e701c26ba751b7bda',
    created_at: '2026-09-09T13:26:23.369725+01:00',
    updated_at: '2026-09-09T13:30:00+01:00',
    order_items: [
      {
        id: 'b2',
        sort: 1,
        product_id: 'p-oeufs-6',
        name: { fr: 'Œufs x6', ar: 'بيض' },
        slug: 'oeufs-fermiers-x6',
        image: '',
        pricing: { mode: 'per_piece', price: 3.6 },
        qty: '2.000',
        line_total: '7.200',
        weighed_kg: null,
        final_total: null,
      },
      {
        id: 'a1',
        sort: 0,
        product_id: 'p-poulet-fermier',
        name: { fr: 'Poulet', ar: 'دجاج' },
        slug: 'poulet-fermier-entier',
        image: '/images/products/poulet-entier.jpg',
        pricing: { mode: 'per_kg_estimated', price_per_kg: 14.9, est_weight_kg: 1.7 },
        qty: '1.000',
        line_total: '25.330',
        weighed_kg: '1.900',
        final_total: '28.310',
      },
    ],
    order_events: [
      { id: 2, status: 'confirmee', at: '2026-09-09T13:30:00+01:00', note: 'Appel client ok', by: 'Nadir' },
      { id: 1, status: 'nouvelle', at: '2026-09-09T13:26:23+01:00', note: null, by: null },
    ],
  };
  it('renvoie un Order complet, lignes et historique dans l’ordre', () => {
    const o = rowToOrder(row);
    expect(o.number).toBe('FK-2026-00001');
    expect(o.customer).toEqual({ name: 'Salma Ben Ali', phone: '+21651788518' });
    expect(o.address).toEqual({ zone_id: 'z-korba', zone_name: row.zone_name, street: '12 rue des Orangers', city: 'Korba' });
    expect(o.slot).toEqual({ id: 's-matin', label: row.slot_label, from: '09:00', to: '12:00' });
    expect(o.items.map((i) => i.product_id)).toEqual(['p-poulet-fermier', 'p-oeufs-6']);
    expect(o.items[0]).toMatchObject({ qty: 1, line_total: 25.33, weighed_kg: 1.9, final_total: 28.31 });
    expect(o.items[1]).toMatchObject({ qty: 2, line_total: 7.2, weighed_kg: null, final_total: null });
    expect(o.subtotal).toBe(32.53);
    expect(o.delivery_fee).toBe(3);
    expect(o.total).toBe(35.53);
    expect(o.final_total).toBeNull();
    expect(o.payment).toBe('cod');
    expect(o.history).toEqual([
      { status: 'nouvelle', at: '2026-09-09T12:26:23.000Z' },
      { status: 'confirmee', at: '2026-09-09T12:30:00.000Z', note: 'Appel client ok', by: 'Nadir' },
    ]);
    expect(o.created_at).toBe('2026-09-09T12:26:23.369Z');
    expect(o.customer_user_id).toBeNull();
    expect('notes' in o).toBe(false);
  });
  it('garde e-mail, repère et notes quand ils existent', () => {
    const o = rowToOrder({ ...row, customer_email: 'salma@example.com', landmark: 'Face à la pharmacie', notes: 'Sonner deux fois', order_items: null, order_events: null });
    expect(o.customer.email).toBe('salma@example.com');
    expect(o.address.landmark).toBe('Face à la pharmacie');
    expect(o.notes).toBe('Sonner deux fois');
    expect(o.items).toEqual([]);
    expect(o.history).toEqual([]);
  });
  it('normalise le résumé client sans jamais y ajouter le jeton', () => {
    const j = {
      number: 'FK-2026-00001',
      status: 'nouvelle',
      delivery_date: '2026-09-10',
      slot: { id: 's-matin', label: row.slot_label, from: '09:00', to: '12:00' },
      items: [{ name: { fr: 'Poulet', ar: 'دجاج' }, qty: '1.000', pricing: { mode: 'per_piece', price: 3.6 }, line_total: '3.600', image: '', slug: 'x' }],
      subtotal: '3.600',
      delivery_fee: '3.000',
      total: '6.600',
      final_total: null,
      history: [{ status: 'nouvelle', at: '2026-09-09T13:26:23+01:00' }],
      created_at: '2026-09-09T13:26:23+01:00',
      address: { zone_id: 'z-korba', zone_name: row.zone_name, street: '12 rue des Orangers', city: 'Korba' },
      customer: { name: 'Salma', phone: '+21651788518' },
    } as unknown as OrderSummaryForCustomer;
    const s = jsonToSummary(j);
    expect(s.total).toBe(6.6);
    expect(s.items[0]?.qty).toBe(1);
    expect(s.history[0]?.at).toBe('2026-09-09T12:26:23.000Z');
    expect(Object.keys(s)).not.toContain('tracking_token');
  });
});

describe('filtres de la liste des commandes', () => {
  it('neutralise les caractères spéciaux du filtre or()', () => {
    expect(searchTerm(' Salma, (Ben) %Ali* ')).toBe('Salma Ben Ali');
    expect(searchTerm('51 788 518')).toBe('51 788 518');
  });
  it('borne les dates en heure de Tunis', () => {
    expect(tunisDayBounds('2026-09-01', '2026-09-09')).toEqual({ from: '2026-09-01T00:00:00+01:00', to: '2026-09-09T23:59:59.999+01:00' });
    expect(tunisDayBounds(undefined, undefined)).toEqual({});
  });
});
