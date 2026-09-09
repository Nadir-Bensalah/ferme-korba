import { persistentAtom } from '@nanostores/persistent';
import { atom, computed } from 'nanostores';
import type { Localized, Pricing, Product } from '@ferme/core';
import { clampQty, defaultQty, lineTotal, roundMillimes } from '@ferme/core';

/**
 * Panier : un instantané léger de chaque produit (nom, image, tarif) plus la
 * quantité. Au moment de commander, seuls id + quantité partent au serveur,
 * qui recalcule tout. Persisté dans localStorage, partagé entre les îlots.
 */

export interface CartLine {
  product_id: string;
  slug: string;
  name: Localized;
  image: string;
  pricing: Pricing;
  qty: number;
  added_at: number;
}

export const cartLines = persistentAtom<CartLine[]>('ferme-korba:cart:v1', [], {
  encode: JSON.stringify,
  decode: (raw) => {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? (v as CartLine[]).filter((l) => l && typeof l.product_id === 'string' && Number.isFinite(l.qty) && l.qty > 0) : [];
    } catch {
      return [];
    }
  },
});

/** Dernier ajout, pour l'animation et le toast. */
export const lastAdded = atom<{ product_id: string; at: number } | null>(null);

/** Dernière suppression, pour le bouton « Annuler ». */
export const lastRemoved = atom<CartLine | null>(null);

export const cartCount = computed(cartLines, (lines) => lines.length);

export const cartSubtotal = computed(cartLines, (lines) => roundMillimes(lines.reduce((s, l) => s + lineTotal(l.pricing, l.qty), 0)));

export const cartHasEstimated = computed(cartLines, (lines) => lines.some((l) => l.pricing.mode === 'per_kg_estimated'));

function snapshot(p: Pick<Product, 'id' | 'slug' | 'name' | 'images' | 'pricing'>): Omit<CartLine, 'qty' | 'added_at'> {
  return { product_id: p.id, slug: p.slug, name: p.name, image: p.images[0] ?? '', pricing: p.pricing };
}

export function addToCart(p: Pick<Product, 'id' | 'slug' | 'name' | 'images' | 'pricing' | 'stock'>, qty?: number): void {
  if (p.stock === 'rupture') return;
  const lines = cartLines.get();
  const existing = lines.find((l) => l.product_id === p.id);
  const add = qty ?? defaultQty(p.pricing);
  if (existing) {
    const next = clampQty(p.pricing, existing.qty + add);
    cartLines.set(lines.map((l) => (l.product_id === p.id ? { ...l, ...snapshot(p), qty: next } : l)));
  } else {
    cartLines.set([...lines, { ...snapshot(p), qty: clampQty(p.pricing, add), added_at: Date.now() }]);
  }
  lastAdded.set({ product_id: p.id, at: Date.now() });
}

export function setQty(product_id: string, qty: number): void {
  const lines = cartLines.get();
  const line = lines.find((l) => l.product_id === product_id);
  if (!line) return;
  const { min } = { min: clampQty(line.pricing, 0) };
  if (qty < min) {
    removeFromCart(product_id);
    return;
  }
  cartLines.set(lines.map((l) => (l.product_id === product_id ? { ...l, qty: clampQty(l.pricing, qty) } : l)));
}

export function removeFromCart(product_id: string): void {
  const lines = cartLines.get();
  const line = lines.find((l) => l.product_id === product_id);
  if (!line) return;
  lastRemoved.set(line);
  cartLines.set(lines.filter((l) => l.product_id !== product_id));
}

export function undoRemove(): void {
  const line = lastRemoved.get();
  if (!line) return;
  cartLines.set([...cartLines.get().filter((l) => l.product_id !== line.product_id), line]);
  lastRemoved.set(null);
}

export function clearCart(): void {
  cartLines.set([]);
}

export function lineQty(product_id: string): number {
  return cartLines.get().find((l) => l.product_id === product_id)?.qty ?? 0;
}

/** Remplace le panier par le contenu d'une ancienne commande (« Commander à nouveau »). */
export function replaceCart(lines: Omit<CartLine, 'added_at'>[]): void {
  const now = Date.now();
  cartLines.set(lines.map((l, i) => ({ ...l, qty: clampQty(l.pricing, l.qty), added_at: now + i })));
}
