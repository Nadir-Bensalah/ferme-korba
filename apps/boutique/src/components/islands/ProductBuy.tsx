import { useEffect, useState } from 'react';
import type { Lang, Pricing, Product, StockStatus } from '@ferme/core';
import { defaultQty, displayPrice, formatPrice, isEstimated, lineTotal } from '@ferme/core';
import { data } from '@/lib/data';
import { t, L } from '@/i18n';
import AddButton from './AddButton';
import { Stepper, badgeLabels, whenIdle } from './shared';

type Snapshot = Pick<Product, 'id' | 'slug' | 'name' | 'images' | 'pricing' | 'stock' | 'badges'>;

interface Props {
  product: Snapshot;
  lang: Lang;
}

/**
 * Bloc d'achat de la fiche produit : quantité, montant estimé, ajout au panier.
 * Relit le produit à l'exécution et corrige le prix, le stock et les badges
 * affichés par la page (éléments #live-price-amount, #live-price-unit,
 * #live-stock, #live-badges), ou masque la fiche si le produit a disparu.
 */
export default function ProductBuy({ product, lang }: Props) {
  const d = t(lang);
  const [pricing, setPricing] = useState<Pricing>(product.pricing);
  const [stock, setStock] = useState<StockStatus>(product.stock);
  const [gone, setGone] = useState(false);
  const [qty, setQty] = useState(() => defaultQty(product.pricing));

  useEffect(() => {
    let alive = true;
    const cancel = whenIdle(() => {
      data()
        .getProduct(product.slug)
        .then((p) => {
          if (!alive) return;
          if (!p) {
            setGone(true);
            setStock('rupture');
            patchStock('rupture', lang);
            return;
          }
          if (JSON.stringify(p.pricing) !== JSON.stringify(pricing)) {
            setPricing(p.pricing);
            setQty((q) => defaultQty(p.pricing) > q ? defaultQty(p.pricing) : q);
            const price = displayPrice(p.pricing, lang);
            const a = document.getElementById('live-price-amount');
            const u = document.getElementById('live-price-unit');
            if (a) a.textContent = price.amount;
            if (u) u.textContent = price.unit;
          }
          if (p.stock !== stock) {
            setStock(p.stock);
            patchStock(p.stock, lang);
          }
          const badges = document.getElementById('live-badges');
          if (badges && (p.badges.length !== product.badges.length || p.badges.some((b, i) => b !== product.badges[i]))) {
            badges.replaceChildren(
              ...p.badges.map((b) => {
                const el = document.createElement('span');
                el.className = badgeLabels[b].cls;
                el.textContent = badgeLabels[b][lang];
                return el;
              }),
            );
          }
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
      cancel();
    };
    // Lecture unique au montage : les valeurs de départ viennent de la construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  const amount = lineTotal(pricing, qty);
  const estimated = isEstimated(pricing);
  const soldOut = stock === 'rupture' || gone;

  return (
    <div className="flex flex-col gap-4">
      {!soldOut && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label mb-1">{pricing.mode === 'per_kg' ? d.shop.weight : pricing.mode === 'per_kg_estimated' ? d.shop.pieces : d.shop.qty}</p>
            <Stepper pricing={pricing} qty={qty} onChange={setQty} lang={lang} d={d} />
          </div>
          <div className="text-end">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{d.shop.priceEstimate}</p>
            <p className="font-display text-2xl font-extrabold tabular" aria-live="polite">
              {estimated ? `≈ ${formatPrice(amount, lang)}` : formatPrice(amount, lang)}
            </p>
          </div>
        </div>
      )}
      {stock === 'bientot' && !gone && <p className="text-sm font-semibold text-ink-2">{d.shop.soonBack}</p>}
      <AddButton product={{ id: product.id, slug: product.slug, name: product.name, images: product.images, pricing, stock: soldOut ? 'rupture' : stock }} lang={lang} qty={qty} />
      {estimated && !soldOut && <p className="text-sm text-ink-3">{d.common.estimated}</p>}
      <span className="sr-only">{L(product.name, lang)}</span>
    </div>
  );
}

function patchStock(stock: StockStatus, lang: Lang) {
  const d = t(lang);
  const el = document.getElementById('live-stock');
  if (!el) return;
  el.hidden = stock === 'en_stock';
  el.className = stock === 'rupture' ? 'chip bg-ink text-paper' : 'chip bg-cream text-ink-2';
  el.textContent = stock === 'rupture' ? d.common.outOfStock : d.common.soon;
}
