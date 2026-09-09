import type {
  DeliverySlot,
  DeliveryZone,
  Order,
  OrderInput,
  OrderItem,
  OrderStatus,
  Product,
  Settings,
} from './types';
import { deliveryFee, lineTotal, clampQty, roundMillimes } from './money';
import { orderInputSchema, isDeliveryDateAllowed } from './validation';
import { ORDER_PREFIX } from './config';

/**
 * Construction d'une commande à partir d'une saisie client.
 * Le même code tourne en mode démo dans le navigateur et sert de référence
 * pour la fonction SQL côté Supabase : mêmes règles, mêmes messages.
 */

export class OrderError extends Error {
  constructor(
    public code:
      | 'invalid'
      | 'shop_closed'
      | 'bot'
      | 'zone_unknown'
      | 'slot_unknown'
      | 'slot_day'
      | 'date_not_allowed'
      | 'product_unknown'
      | 'product_unavailable'
      | 'min_order',
    public details?: unknown,
  ) {
    super(code);
  }
}

export interface BuildOrderContext {
  products: Product[];
  zones: DeliveryZone[];
  slots: DeliverySlot[];
  settings: Settings;
  now?: Date;
  nextNumber: () => string;
  makeId: () => string;
  makeToken: () => string;
}

export function buildOrder(raw: OrderInput, ctx: BuildOrderContext): Order {
  const parsed = orderInputSchema.safeParse(raw);
  if (!parsed.success) {
    const bot = parsed.error.issues.some((i) => i.message === 'bot');
    throw new OrderError(bot ? 'bot' : 'invalid', parsed.error.issues);
  }
  const input = parsed.data;
  const now = ctx.now ?? new Date();

  if (!ctx.settings.shop_open) throw new OrderError('shop_closed');

  const zone = ctx.zones.find((z) => z.id === input.address.zone_id && z.active);
  if (!zone) throw new OrderError('zone_unknown');

  const slot = ctx.slots.find((s) => s.id === input.slot_id && s.active);
  if (!slot) throw new OrderError('slot_unknown');

  if (
    !isDeliveryDateAllowed(input.delivery_date, {
      now,
      maxDaysAhead: ctx.settings.max_days_ahead,
      cutoffTime: ctx.settings.cutoff_time,
      closedDays: ctx.settings.closed_days,
      leadDays: zone.lead_days,
    })
  ) {
    throw new OrderError('date_not_allowed');
  }
  const [y, m, d] = input.delivery_date.split('-').map(Number) as [number, number, number];
  const day = new Date(y, m - 1, d).getDay();
  if (!slot.days.includes(day)) throw new OrderError('slot_day');

  // Fusion des lignes en double sur le même produit.
  const merged = new Map<string, number>();
  for (const it of input.items) merged.set(it.product_id, (merged.get(it.product_id) ?? 0) + it.qty);

  const items: OrderItem[] = [];
  for (const [product_id, qtyRaw] of merged) {
    const p = ctx.products.find((x) => x.id === product_id);
    if (!p) throw new OrderError('product_unknown', product_id);
    if (p.stock === 'rupture') throw new OrderError('product_unavailable', p.slug);
    const qty = clampQty(p.pricing, qtyRaw);
    items.push({
      id: ctx.makeId(),
      product_id,
      qty,
      name: p.name,
      slug: p.slug,
      image: p.images[0] ?? '',
      pricing: p.pricing,
      line_total: lineTotal(p.pricing, qty),
      weighed_kg: null,
      final_total: null,
    });
  }

  const subtotal = roundMillimes(items.reduce((s, i) => s + i.line_total, 0));
  if (subtotal < ctx.settings.min_order) throw new OrderError('min_order', ctx.settings.min_order);
  const fee = deliveryFee(zone, subtotal);
  const total = roundMillimes(subtotal + fee);
  const iso = now.toISOString();

  return {
    id: ctx.makeId(),
    number: ctx.nextNumber(),
    status: 'nouvelle',
    lang: input.lang,
    customer: input.customer,
    address: { ...input.address, zone_name: zone.name },
    delivery_date: input.delivery_date,
    slot: { id: slot.id, label: slot.label, from: slot.from, to: slot.to },
    items,
    subtotal,
    delivery_fee: fee,
    total,
    final_total: null,
    payment: 'cod',
    notes: input.notes,
    tracking_token: ctx.makeToken(),
    history: [{ status: 'nouvelle', at: iso }],
    customer_user_id: input.customer_user_id ?? null,
    created_at: iso,
    updated_at: iso,
  };
}

/** Numéro lisible : FK-2026-00042 */
export function formatOrderNumber(seq: number, year = new Date().getFullYear()): string {
  return `${ORDER_PREFIX}-${year}-${String(seq).padStart(5, '0')}`;
}

/** Transitions autorisées depuis chaque statut. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  nouvelle: ['confirmee', 'annulee'],
  confirmee: ['en_preparation', 'annulee'],
  en_preparation: ['en_livraison', 'livree', 'annulee'],
  en_livraison: ['livree', 'refusee'],
  livree: [],
  annulee: [],
  refusee: [],
};

export const ACTIVE_STATUSES: OrderStatus[] = ['nouvelle', 'confirmee', 'en_preparation', 'en_livraison'];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT_STATUSES[from].includes(to);
}

/** Total final après pesée : les lignes pesées prennent leur poids réel, les autres gardent l'estimation. */
export function computeFinalTotal(order: Order): number {
  const sub = order.items.reduce((s, it) => {
    if (it.weighed_kg != null && it.pricing.mode !== 'per_piece') {
      return s + it.pricing.price_per_kg * it.weighed_kg;
    }
    return s + it.line_total;
  }, 0);
  return roundMillimes(sub + order.delivery_fee);
}

export function applyWeighing(order: Order, lines: { item_id: string; weighed_kg: number | null }[]): Order {
  const items = order.items.map((it) => {
    const l = lines.find((x) => x.item_id === it.id);
    if (!l) return it;
    if (it.pricing.mode === 'per_piece') return it;
    const kg = l.weighed_kg == null ? null : Math.max(0, roundMillimes(l.weighed_kg));
    return {
      ...it,
      weighed_kg: kg,
      final_total: kg == null ? null : roundMillimes(it.pricing.price_per_kg * kg),
    };
  });
  const next = { ...order, items };
  return { ...next, final_total: computeFinalTotal(next), updated_at: new Date().toISOString() };
}
