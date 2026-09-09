import { describe, expect, it } from 'vitest';
import { normalizePhone, orderInputSchema, isDeliveryDateAllowed, allowedDeliveryDates, cleanText } from './validation';
import { clampQty, lineTotal, deliveryFee, formatPrice } from './money';
import { buildOrder, OrderError, applyWeighing } from './orders';
import { seed } from './seed';

describe('téléphones tunisiens', () => {
  it('normalise les formats courants', () => {
    expect(normalizePhone('51 788 518')).toBe('+21651788518');
    expect(normalizePhone('+216 51 788 518')).toBe('+21651788518');
    expect(normalizePhone('00216-51-788-518')).toBe('+21651788518');
    expect(normalizePhone('51.788.518')).toBe('+21651788518');
  });
  it('refuse ce qui n’est pas un numéro tunisien', () => {
    expect(normalizePhone('0612345678')).toBeNull();
    expect(normalizePhone('5178851')).toBeNull();
    expect(normalizePhone('11788518')).toBeNull();
    expect(normalizePhone('+33612345678')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
});

describe('nettoyage du texte', () => {
  it('retire les balises et les espaces bizarres', () => {
    expect(cleanText('  <b>Ali</b>  Ben   Salah ')).toBe('Ali Ben Salah');
  });
});

describe('quantités et montants', () => {
  const perKg = { mode: 'per_kg', price_per_kg: 22.9, step_kg: 0.25, min_kg: 0.5, max_kg: 10 } as const;
  const est = { mode: 'per_kg_estimated', price_per_kg: 14.9, est_weight_kg: 1.7, max_qty: 10 } as const;
  const piece = { mode: 'per_piece', price: 3.6, max_qty: 20 } as const;
  it('cale la quantité sur le pas et les bornes', () => {
    expect(clampQty(perKg, 0.3)).toBe(0.5);
    expect(clampQty(perKg, 0.6)).toBe(0.5);
    expect(clampQty(perKg, 0.88)).toBe(1);
    expect(clampQty(perKg, 50)).toBe(10);
    expect(clampQty(piece, 0)).toBe(1);
    expect(clampQty(piece, 2.7)).toBe(3);
    expect(clampQty(est, Number.NaN)).toBe(1);
  });
  it('calcule les lignes au millime', () => {
    expect(lineTotal(perKg, 0.75)).toBe(17.175);
    expect(lineTotal(est, 2)).toBe(50.66);
    expect(lineTotal(piece, 3)).toBe(10.8);
  });
  it('offre la livraison au seuil', () => {
    expect(deliveryFee({ fee: 3, free_from: 60 }, 59.999)).toBe(3);
    expect(deliveryFee({ fee: 3, free_from: 60 }, 60)).toBe(0);
    expect(deliveryFee({ fee: 12, free_from: 0 }, 1000)).toBe(12);
  });
  it('formate en dinars avec trois décimales', () => {
    expect(formatPrice(12.5, 'fr')).toMatch(/12,500\s?DT/);
  });
});

describe('dates de livraison', () => {
  const base = { maxDaysAhead: 6, cutoffTime: '18:00', closedDays: [0], leadDays: 0 };
  it('accepte aujourd’hui avant l’heure limite, pas après', () => {
    const morning = new Date(2026, 8, 9, 10, 0); // mercredi
    expect(isDeliveryDateAllowed('2026-09-09', { ...base, now: morning })).toBe(true);
    const evening = new Date(2026, 8, 9, 18, 30);
    expect(isDeliveryDateAllowed('2026-09-09', { ...base, now: evening })).toBe(false);
    expect(isDeliveryDateAllowed('2026-09-10', { ...base, now: evening })).toBe(true);
  });
  it('refuse le dimanche, le passé et trop loin', () => {
    const now = new Date(2026, 8, 9, 10, 0);
    expect(isDeliveryDateAllowed('2026-09-13', { ...base, now })).toBe(false);
    expect(isDeliveryDateAllowed('2026-09-08', { ...base, now })).toBe(false);
    expect(isDeliveryDateAllowed('2026-09-16', { ...base, now })).toBe(false);
    expect(isDeliveryDateAllowed('2026-13-01', { ...base, now })).toBe(false);
  });
  it('décale le délai de zone quand l’heure limite est passée', () => {
    // Tunis livre à J+1. Commandé à 18 h 30, la préparation ne peut plus partir
    // demain matin : le premier jour possible est J+2.
    const evening = new Date(2026, 8, 9, 18, 30);
    expect(isDeliveryDateAllowed('2026-09-10', { ...base, now: evening, leadDays: 1 })).toBe(false);
    expect(isDeliveryDateAllowed('2026-09-11', { ...base, now: evening, leadDays: 1 })).toBe(true);
  });
  it('respecte le délai de la zone', () => {
    const now = new Date(2026, 8, 9, 10, 0);
    expect(isDeliveryDateAllowed('2026-09-09', { ...base, now, leadDays: 1 })).toBe(false);
    expect(allowedDeliveryDates({ ...base, now, leadDays: 1 })).toEqual(['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-14', '2026-09-15']);
  });
});

describe('construction de commande', () => {
  const ctx = () => ({
    ...seed,
    now: new Date(2026, 8, 9, 10, 0),
    nextNumber: () => 'FK-2026-00001',
    makeId: () => 'id',
    makeToken: () => 'tok',
  });
  const valid = () => ({
    lang: 'fr' as const,
    customer: { name: 'Salma Ben Ali', phone: '51 788 518', email: '' },
    address: { zone_id: 'z-korba', street: '12 rue des Orangers', city: 'Korba' },
    delivery_date: '2026-09-09',
    slot_id: 's-matin',
    items: [
      { product_id: 'p-poulet-fermier', qty: 1 },
      { product_id: 'p-oeufs-6', qty: 2 },
    ],
  });
  it('construit une commande complète', () => {
    const o = buildOrder(valid(), ctx());
    expect(o.number).toBe('FK-2026-00001');
    expect(o.items).toHaveLength(2);
    expect(o.subtotal).toBe(25.33 + 7.2);
    expect(o.delivery_fee).toBe(3);
    expect(o.total).toBe(35.53);
    expect(o.customer.phone).toBe('+21651788518');
    expect(o.customer.email).toBeUndefined();
  });
  it('fusionne les doublons et cale les quantités', () => {
    const o = buildOrder({ ...valid(), items: [{ product_id: 'p-oeufs-6', qty: 1 }, { product_id: 'p-oeufs-6', qty: 99 }] }, ctx());
    expect(o.items).toHaveLength(1);
    expect(o.items[0]!.qty).toBe(20);
  });
  it('refuse sous le minimum, le robot, la boutique fermée', () => {
    expect(() => buildOrder({ ...valid(), items: [{ product_id: 'p-oeufs-6', qty: 1 }] }, ctx())).toThrow(OrderError);
    expect(() => buildOrder({ ...valid(), website: 'spam' }, ctx())).toThrowError(/bot/);
    expect(() => buildOrder(valid(), { ...ctx(), settings: { ...seed.settings, shop_open: false } })).toThrowError(/shop_closed/);
    expect(() => buildOrder({ ...valid(), address: { ...valid().address, zone_id: 'nope' } }, ctx())).toThrowError(/zone_unknown/);
    expect(() => buildOrder({ ...valid(), delivery_date: '2026-09-13' }, ctx())).toThrowError(/date_not_allowed/);
  });
  it('refuse la zone à J+1 pour le jour même', () => {
    expect(() => buildOrder({ ...valid(), address: { ...valid().address, zone_id: 'z-tunis' } }, ctx())).toThrowError(/date_not_allowed/);
  });
  it('applique la pesée', () => {
    const o = buildOrder(valid(), ctx());
    const w = applyWeighing(o, [{ item_id: o.items[0]!.id, weighed_kg: 1.9 }]);
    expect(w.items[0]!.final_total).toBe(28.31);
    expect(w.final_total).toBe(28.31 + 7.2 + 3);
  });
});
