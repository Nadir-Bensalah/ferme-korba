import { useEffect, useState } from 'react';
import type { Lang, Product } from '@ferme/core';
import { addToCart } from '@/stores/cart';
import { t } from '@/i18n';

type Snapshot = Pick<Product, 'id' | 'slug' | 'name' | 'images' | 'pricing' | 'stock'>;

interface Props {
  products: Snapshot[];
  lang: Lang;
}

/** Bouton « Ajouter les produits au panier » d'une recette : chaque produit à sa quantité par défaut. */
export default function RecipeCart({ products, lang }: Props) {
  const d = t(lang);
  const [state, setState] = useState<'idle' | 'added'>('idle');
  const available = products.filter((p) => p.stock !== 'rupture');

  useEffect(() => {
    if (state !== 'added') return;
    const id = setTimeout(() => setState('idle'), 2200);
    return () => clearTimeout(id);
  }, [state]);

  if (!available.length) return null;

  return (
    <button
      type="button"
      onClick={() => {
        available.forEach((p) => addToCart(p));
        setState('added');
      }}
      className={`btn-lg shrink-0 ${state === 'added' ? 'btn bg-prairie text-white' : 'btn-yolk'}`}
      aria-live="polite"
    >
      {state === 'added' ? (
        <>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-pop">
            <path d="M5 12.5 10 17.5 19 7" />
          </svg>
          {d.recipes.addedAll}
        </>
      ) : (
        <>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16l-1.5 12.5a1 1 0 0 1-1 .9h-11a1 1 0 0 1-1-.9z" />
            <path d="M8 7a4 4 0 0 1 8 0" />
          </svg>
          {d.recipes.addAll}
        </>
      )}
    </button>
  );
}
