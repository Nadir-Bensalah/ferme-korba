import { useEffect, useState } from 'react';
import type { Lang, Pricing, Product, StockStatus } from '@ferme/core';
import { clampQty, defaultQty, displayPrice, formatPrice, isEstimated, lineTotal, qtyBounds, roundMillimes } from '@ferme/core';
import { data } from '@/lib/data';
import { t, L, locale } from '@/i18n';
import AddButton from './AddButton';
import RollingText from './RollingText';
import { Stepper, badgeLabels, whenIdle } from './shared';

type Snapshot = Pick<Product, 'id' | 'slug' | 'name' | 'images' | 'pricing' | 'stock' | 'badges'>;

/** Part servie par personne, en kilos. La règle est écrite sous les raccourcis. */
const PER_PERSON_KG = 0.35;

/**
 * Raccourcis « pour N personnes ». La quantité vient du produit lui-même
 * (poids d'une pièce, pas du sélecteur, bornes), jamais d'un chiffre inventé.
 * Deux nombres de convives qui tombent sur la même quantité n'en font qu'un,
 * et c'est le plus grand qu'on garde : mieux vaut annoncer moins que trop.
 */
function suggestions(pricing: Pricing): { people: number; qty: number }[] {
  if (pricing.mode === 'per_piece') return [];
  const { min, max } = qtyBounds(pricing);
  const byQty = new Map<number, number>();
  for (const people of [2, 4, 6, 8]) {
    const need = people * PER_PERSON_KG;
    const raw = pricing.mode === 'per_kg' ? need : Math.ceil(need / pricing.est_weight_kg);
    const qty = clampQty(pricing, raw);
    if (qty < min || qty > max) continue;
    byQty.set(qty, people);
  }
  return [...byQty.entries()].map(([qty, people]) => ({ people, qty })).sort((a, b) => a.qty - b.qty);
}

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
  const presets = soldOut ? [] : suggestions(pricing);
  const nf = new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 2 });
  // Sous le sélecteur : ce qu'on va vraiment poser dans le cageot.
  const recap =
    pricing.mode === 'per_kg_estimated'
      ? `${d.shop.totalPieces(qty)} · ${d.shop.totalWeight(nf.format(roundMillimes(pricing.est_weight_kg * qty)))}`
      : null;

  return (
    <div className="flex flex-col gap-4">
      {!soldOut && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label mb-1">{pricing.mode === 'per_kg' ? d.shop.weight : pricing.mode === 'per_kg_estimated' ? d.shop.pieces : d.shop.qty}</p>
              <Stepper pricing={pricing} qty={qty} onChange={setQty} lang={lang} d={d} />
            </div>
            <div className="text-end">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{d.shop.priceEstimate}</p>
              <p className="font-display text-2xl font-extrabold tabular" aria-live="polite">
                {estimated && <span className="me-1 text-base font-semibold text-ink-3">≈</span>}
                <RollingText value={formatPrice(amount, lang)} />
              </p>
            </div>
          </div>
          {recap && (
            <p className="text-sm font-semibold text-ink-2 tabular" aria-live="polite">
              {recap}
            </p>
          )}
          {presets.length > 1 && (
            <div>
              <p className="label mb-1.5">{d.shop.suggest.title}</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((s) => (
                  <button
                    key={s.qty}
                    type="button"
                    className="choice-pill gap-1.5 active:scale-[0.97] motion-reduce:active:scale-100"
                    aria-pressed={qty === s.qty}
                    onClick={() => setQty(s.qty)}
                  >
                    <PeopleIcon />
                    {d.shop.suggest.people(s.people)}
                  </button>
                ))}
              </div>
              <p className="help">{d.shop.suggest.note}</p>
            </div>
          )}
        </div>
      )}
      {stock === 'bientot' && !gone && <p className="text-sm font-semibold text-ink-2">{d.shop.soonBack}</p>}
      <AddButton product={{ id: product.id, slug: product.slug, name: product.name, images: product.images, pricing, stock: soldOut ? 'rupture' : stock }} lang={lang} qty={qty} />
      {estimated && !soldOut && <p className="text-sm text-ink-3">{d.common.estimated}</p>}
      <span className="sr-only">{L(product.name, lang)}</span>
    </div>
  );
}

/** Deux convives, dessinés au trait : le picto des raccourcis de quantité. */
function PeopleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-prairie" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8.8" cy="7.6" r="3.2" />
      <path d="M2.6 20.4a6.2 6.2 0 0 1 12.4 0" />
      <circle cx="17.4" cy="9" r="2.4" />
      <path d="M15.8 14.4a4.9 4.9 0 0 1 5.6 5" />
    </svg>
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
