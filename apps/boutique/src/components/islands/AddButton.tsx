import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang, Product } from '@ferme/core';
import { addToCart, cartLines, openCartDrawer } from '@/stores/cart';
import { t } from '@/i18n';

type Snapshot = Pick<Product, 'id' | 'slug' | 'name' | 'images' | 'pricing' | 'stock'>;

interface Props {
  product: Snapshot;
  lang: Lang;
  /** Bouton rond « + » (cartes) ou bouton large (fiche produit). */
  compact?: boolean;
  qty?: number;
  className?: string;
}

/**
 * Bouton d'ajout au panier. Au clic : la photo du produit « vole » vers
 * l'icône panier, le bouton passe en « Ajouté » une seconde, le compteur rebondit.
 */
export default function AddButton({ product, lang, compact = false, qty, className = '' }: Props) {
  const d = t(lang);
  const lines = useStore(cartLines);
  const inCart = lines.some((l) => l.product_id === product.id);
  const [state, setState] = useState<'idle' | 'added'>('idle');
  const btn = useRef<HTMLButtonElement>(null);
  const drawerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soldOut = product.stock === 'rupture';

  useEffect(() => () => {
    if (drawerTimer.current) clearTimeout(drawerTimer.current);
  }, []);

  useEffect(() => {
    if (state !== 'added') return;
    const id = setTimeout(() => setState('idle'), 1100);
    return () => clearTimeout(id);
  }, [state]);

  const fly = useCallback(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = document.getElementById('cart-anchor');
    const from = btn.current?.closest('article')?.querySelector('img') ?? btn.current;
    if (!target || !from || !product.images[0]) return;
    const a = from.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const ghost = document.createElement('img');
    ghost.src = (from as HTMLImageElement).currentSrc || product.images[0];
    ghost.alt = '';
    Object.assign(ghost.style, {
      position: 'fixed',
      left: `${a.left}px`,
      top: `${a.top}px`,
      width: `${Math.min(a.width, 96)}px`,
      height: `${Math.min(a.height, 96)}px`,
      objectFit: 'cover',
      borderRadius: '14px',
      zIndex: '80',
      pointerEvents: 'none',
      boxShadow: '0 12px 40px -12px rgba(22,32,26,.5)',
    } as CSSStyleDeclaration);
    document.body.appendChild(ghost);
    const dx = b.left + b.width / 2 - (a.left + Math.min(a.width, 96) / 2);
    const dy = b.top + b.height / 2 - (a.top + Math.min(a.height, 96) / 2);
    const anim = ghost.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(0.7)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.15)`, opacity: 0.4 },
      ],
      { duration: 650, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'forwards' },
    );
    anim.onfinish = () => ghost.remove();
  }, [product.images]);

  const onClick = () => {
    if (soldOut) return;
    fly();
    addToCart(product, qty);
    setState('added');
    // Sur une fiche produit, l'ajout est un geste unique et réfléchi : le
    // panneau s'ouvre pour montrer le panier, une fois la photo arrivée.
    // Sur les cartes de la boutique, il se mettrait en travers de celui qui
    // remplit vite son panier : la photo qui vole et le compteur suffisent.
    if (!compact) {
      if (drawerTimer.current) clearTimeout(drawerTimer.current);
      drawerTimer.current = setTimeout(openCartDrawer, 450);
    }
  };

  if (compact) {
    return (
      <button
        ref={btn}
        type="button"
        onClick={onClick}
        disabled={soldOut}
        aria-label={soldOut ? d.shop.unavailable : `${d.common.add} · ${product.name[lang]}`}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-pill shadow-card transition-[transform,background-color] duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 ${
          state === 'added' ? 'bg-prairie text-white' : inCart ? 'bg-prairie-soft text-prairie-deep' : 'bg-yolk text-ink hover:bg-yolk-deep'
        } ${className}`}
      >
        {state === 'added' ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-pop">
            <path d="M5 12.5 10 17.5 19 7" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      ref={btn}
      type="button"
      onClick={onClick}
      disabled={soldOut}
      className={`btn-lg w-full ${state === 'added' ? 'btn bg-prairie text-white' : 'btn-yolk'} ${className}`}
    >
      {soldOut ? (
        d.shop.unavailable
      ) : state === 'added' ? (
        <>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-pop">
            <path d="M5 12.5 10 17.5 19 7" />
          </svg>
          {d.common.added}
        </>
      ) : (
        <>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16l-1.5 12.5a1 1 0 0 1-1 .9h-11a1 1 0 0 1-1-.9z" />
            <path d="M8 7a4 4 0 0 1 8 0" />
          </svg>
          {d.shop.addToCart}
        </>
      )}
    </button>
  );
}
