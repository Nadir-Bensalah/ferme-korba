import { useStore } from '@nanostores/react';
import { useEffect, useRef, useState } from 'react';
import type { Lang } from '@ferme/core';
import { cartCount, lastAdded, openCartDrawer } from '@/stores/cart';
import { t } from '@/i18n';

interface Props {
  lang: Lang;
}

/**
 * La bulle du panier, dans le coin bas du côté de fin, sur ordinateur seulement :
 * sur téléphone, la barre du bas a déjà son onglet panier. Elle porte le nombre
 * d'articles, rebondit à chaque ajout, et s'écarte vers le haut quand le bouton
 * « retour en haut » prend sa place, pour que les deux restent atteignables.
 */
export default function FloatingCart({ lang }: Props) {
  const d = t(lang);
  const count = useStore(cartCount);
  const added = useStore(lastAdded);
  const [bump, setBump] = useState(false);
  const [lifted, setLifted] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!added) return;
    setBump(true);
    const id = setTimeout(() => setBump(false), 600);
    return () => clearTimeout(id);
  }, [added]);

  // Même seuil que le bouton « retour en haut » : quand il est là, on monte.
  useEffect(() => {
    const hasBackToTop = () => Boolean(document.querySelector('[data-back-to-top]'));
    const footerTopVisible = () => {
      const el = document.querySelector('[data-footer-top]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    };
    const onScroll = () => setLifted((hasBackToTop() && window.scrollY > window.innerHeight * 1.5) || footerTopVisible());
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('astro:page-load', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('astro:page-load', onScroll);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={openCartDrawer}
      aria-label={`${d.cart.floating}${count ? ` (${d.cart.items(count)})` : ''}`}
      aria-haspopup="dialog"
      className={`fixed end-6 z-30 hidden h-14 w-14 items-center justify-center rounded-pill bg-prairie text-paper shadow-float transition-[transform,bottom,background-color] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-prairie-deep active:scale-95 motion-reduce:transition-none lg:flex ${bump ? 'scale-110' : ''}`}
      style={{ bottom: lifted ? 'calc(1.5rem + 3rem + 0.75rem)' : '1.5rem' }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16l-1.5 12.5a1 1 0 0 1-1 .9h-11a1 1 0 0 1-1-.9z" />
        <path d="M8 7a4 4 0 0 1 8 0" />
      </svg>
      {count > 0 && (
        <span className={`absolute -end-1 -top-1 min-w-6 rounded-pill bg-yolk px-1.5 text-center text-xs font-extrabold leading-6 text-ink tabular ${bump ? 'animate-pop' : ''}`} aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  );
}
