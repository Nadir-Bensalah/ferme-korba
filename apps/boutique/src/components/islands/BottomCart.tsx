import { useStore } from '@nanostores/react';
import { useCallback } from 'react';
import type { Lang } from '@ferme/core';
import { cartCount, cartDrawerOpen, openCartDrawer } from '@/stores/cart';

interface Props {
  lang: Lang;
  href: string;
  label: string;
  active?: boolean;
}

/**
 * Onglet panier de la barre du bas, avec compteur. Comme l'icône de l'en-tête,
 * il reste un lien : le panneau ne prend la main que si le script tourne, et
 * jamais quand on est déjà sur la page panier.
 */
export default function BottomCart({ href, label, active }: Props) {
  const count = useStore(cartCount);
  const open = useStore(cartDrawerOpen);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (active || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      openCartDrawer();
    },
    [active],
  );

  return (
    <a
      href={href}
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[11px] font-bold transition-colors ${active ? 'text-prairie' : 'text-ink-3'}`}
      aria-current={active ? 'page' : undefined}
      aria-haspopup={active ? undefined : 'dialog'}
      aria-expanded={active ? undefined : open}
      aria-label={`${label}${count ? ` (${count})` : ''}`}
    >
      <span className="relative">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7h16l-1.5 12.5a1 1 0 0 1-1 .9h-11a1 1 0 0 1-1-.9z" />
          <path d="M8 7a4 4 0 0 1 8 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -end-2.5 -top-1.5 min-w-5 rounded-pill bg-yolk px-1.5 text-center text-[11px] font-extrabold leading-5 text-ink tabular" aria-hidden="true">
            {count}
          </span>
        )}
      </span>
      {label}
    </a>
  );
}
