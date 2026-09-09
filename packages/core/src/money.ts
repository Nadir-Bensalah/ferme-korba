import type { Lang, Pricing, Product } from './types';
import { currency } from './config';

/** Arrondit au millime, en évitant les erreurs binaires (0.1 + 0.2). */
export function roundMillimes(amount: number): number {
  return Math.round(amount * 1000) / 1000;
}

const formatters: Partial<Record<Lang, Intl.NumberFormat>> = {};

export function formatPrice(amount: number, lang: Lang = 'fr'): string {
  let f = formatters[lang];
  if (!f) {
    f = new Intl.NumberFormat(lang === 'ar' ? 'ar-TN' : 'fr-TN', {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    });
    formatters[lang] = f;
  }
  const n = f.format(roundMillimes(amount));
  return lang === 'ar' ? `${n} ${currency.symbol.ar}` : `${n} ${currency.symbol.fr}`;
}

/** Prix « à partir de » affiché sur une carte produit, avec son unité. */
export function displayPrice(pricing: Pricing, lang: Lang = 'fr'): { amount: string; unit: string } {
  const perKg = lang === 'ar' ? '/ كغ' : '/ kg';
  const perPiece = lang === 'ar' ? '/ قطعة' : '/ pièce';
  switch (pricing.mode) {
    case 'per_piece':
      return { amount: formatPrice(pricing.price, lang), unit: perPiece };
    case 'per_kg':
    case 'per_kg_estimated':
      return { amount: formatPrice(pricing.price_per_kg, lang), unit: perKg };
  }
}

/** Quantité par défaut quand on ajoute au panier. */
export function defaultQty(pricing: Pricing): number {
  switch (pricing.mode) {
    case 'per_piece':
    case 'per_kg_estimated':
      return pricing.min_qty ?? 1;
    case 'per_kg':
      return pricing.min_kg;
  }
}

/** Pas d'incrément du sélecteur de quantité. */
export function qtyStep(pricing: Pricing): number {
  return pricing.mode === 'per_kg' ? pricing.step_kg : 1;
}

export function qtyBounds(pricing: Pricing): { min: number; max: number } {
  switch (pricing.mode) {
    case 'per_piece':
    case 'per_kg_estimated':
      return { min: pricing.min_qty ?? 1, max: pricing.max_qty ?? 30 };
    case 'per_kg':
      return { min: pricing.min_kg, max: pricing.max_kg ?? 20 };
  }
}

/** Ramène une quantité dans les bornes et sur le bon pas. */
export function clampQty(pricing: Pricing, qty: number): number {
  const { min, max } = qtyBounds(pricing);
  const step = qtyStep(pricing);
  if (!Number.isFinite(qty)) return min;
  const snapped = Math.round(qty / step) * step;
  const clamped = Math.min(max, Math.max(min, snapped));
  return roundMillimes(clamped);
}

/** Montant estimé d'une ligne. Pour les produits pesés, c'est une estimation. */
export function lineTotal(pricing: Pricing, qty: number): number {
  switch (pricing.mode) {
    case 'per_piece':
      return roundMillimes(pricing.price * qty);
    case 'per_kg_estimated':
      return roundMillimes(pricing.price_per_kg * pricing.est_weight_kg * qty);
    case 'per_kg':
      return roundMillimes(pricing.price_per_kg * qty);
  }
}

/** Vrai si le montant de la ligne dépend d'une pesée. */
export function isEstimated(pricing: Pricing): boolean {
  return pricing.mode === 'per_kg_estimated';
}

/** Libellé de quantité : « 2 pièces », « 1,5 kg », « 2 pièces (≈ 3,4 kg) ». */
export function formatQty(pricing: Pricing, qty: number, lang: Lang = 'fr'): string {
  const nf = new Intl.NumberFormat(lang === 'ar' ? 'ar-TN' : 'fr-TN', { maximumFractionDigits: 2 });
  if (pricing.mode === 'per_kg') {
    return lang === 'ar' ? `${nf.format(qty)} كغ` : `${nf.format(qty)} kg`;
  }
  const pieces =
    lang === 'ar'
      ? `${nf.format(qty)} ${qty === 1 ? 'قطعة' : 'قطع'}`
      : `${nf.format(qty)} ${qty === 1 ? 'pièce' : 'pièces'}`;
  if (pricing.mode === 'per_kg_estimated') {
    const kg = nf.format(roundMillimes(pricing.est_weight_kg * qty));
    return lang === 'ar' ? `${pieces} (≈ ${kg} كغ)` : `${pieces} (≈ ${kg} kg)`;
  }
  return pieces;
}

export function productLineTotal(product: Pick<Product, 'pricing'>, qty: number): number {
  return lineTotal(product.pricing, qty);
}

/** Frais de livraison selon la zone et le sous-total des produits. */
export function deliveryFee(zone: { fee: number; free_from: number }, subtotal: number): number {
  if (zone.free_from > 0 && subtotal >= zone.free_from) return 0;
  return roundMillimes(zone.fee);
}
