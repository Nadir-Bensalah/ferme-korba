import { useEffect } from 'react';
import type { Badge, Lang, Product, StockStatus } from '@ferme/core';
import { displayPrice } from '@ferme/core';
import { data } from '@/lib/data';
import { t } from '@/i18n';
import { badgeLabels, whenIdle } from './shared';

export interface CardSeed {
  id: string;
  amount: string;
  unit: string;
  stock: StockStatus;
  badges: Badge[];
}

interface Props {
  lang: Lang;
  category?: string;
  seed: CardSeed[];
}

/**
 * Mise à jour « live » de la grille : le HTML est construit avec le jeu de
 * données, cet îlot relit la source à l'exécution et corrige ce qui a changé
 * (prix, stock, badges) ou masque un produit qui n'existe plus.
 * Il s'appuie sur la structure de ProductCard.astro : chaque carte est dans
 * un conteneur [data-product-id] posé par Shop.astro.
 */
export default function ShopLive({ lang, category, seed }: Props) {
  const d = t(lang);
  useEffect(() => {
    let alive = true;
    const cancel = whenIdle(() => {
      data()
        .listProducts(category ? { category } : undefined)
        .then((rows) => {
          if (!alive) return;
          const byId = new Map(rows.map((p) => [p.id, p]));
          let visible = 0;
          for (const s of seed) {
            const wrap = document.querySelector<HTMLElement>(`[data-product-id="${s.id}"]`);
            if (!wrap) continue;
            const p = byId.get(s.id);
            if (!p) {
              wrap.hidden = true;
              continue;
            }
            visible += 1;
            patchCard(wrap, s, p, lang);
          }
          const count = document.querySelector<HTMLElement>('[data-product-count]');
          if (count) count.textContent = d.shop.count(visible);
          const empty = document.querySelector<HTMLElement>('[data-shop-empty]');
          if (empty) empty.hidden = visible > 0;
        })
        .catch(() => {
          /* la version construite reste affichée */
        });
    });
    return () => {
      alive = false;
      cancel();
    };
  }, [category, lang, seed]);
  return null;
}

function patchCard(wrap: HTMLElement, s: CardSeed, p: Product, lang: Lang) {
  const d = t(lang);
  const price = displayPrice(p.pricing, lang);
  if (price.amount !== s.amount || price.unit !== s.unit) {
    const amount = wrap.querySelector<HTMLElement>('span.font-display');
    if (amount) {
      amount.textContent = price.amount;
      const unit = amount.nextElementSibling as HTMLElement | null;
      if (unit) unit.textContent = price.unit;
    }
  }
  const sameBadges = p.badges.length === s.badges.length && p.badges.every((b, i) => b === s.badges[i]);
  if (p.stock !== s.stock || !sameBadges) {
    const chips = wrap.querySelector<HTMLElement>('a[aria-hidden="true"] > div');
    if (chips) {
      chips.replaceChildren(
        ...p.badges.map((b) => chip(badgeLabels[b].cls, badgeLabels[b][lang])),
        ...(p.stock === 'bientot' ? [chip('chip bg-paper/90 text-ink-2', d.common.soon)] : []),
        ...(p.stock === 'rupture' ? [chip('chip bg-ink text-paper', d.common.outOfStock)] : []),
      );
    }
    const img = wrap.querySelector<HTMLElement>('img');
    if (img) img.classList.toggle('grayscale', p.stock === 'rupture');
    const add = wrap.querySelector<HTMLElement>('.relative.z-10');
    if (add) add.hidden = p.stock === 'rupture';
  }
}

function chip(cls: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = cls;
  el.textContent = text;
  return el;
}
