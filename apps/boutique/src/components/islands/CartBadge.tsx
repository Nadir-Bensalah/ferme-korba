import { useStore } from '@nanostores/react';
import { useEffect, useRef, useState } from 'react';
import type { Lang } from '@ferme/core';
import { cartCount, lastAdded } from '@/stores/cart';

interface Props {
  lang: Lang;
  href: string;
  label: string;
}

/** Icône panier du haut de page, avec compteur et petit rebond à chaque ajout. */
export default function CartBadge({ href, label }: Props) {
  const count = useStore(cartCount);
  const added = useStore(lastAdded);
  const [bump, setBump] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!added) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 500);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <a
      href={href}
      id="cart-anchor"
      className={`relative inline-flex rounded-pill p-2.5 text-ink transition-transform hover:bg-cream ${bump ? 'scale-110' : ''}`}
      aria-label={`${label}${count ? ` (${count})` : ''}`}
      style={{ transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16l-1.5 12.5a1 1 0 0 1-1 .9h-11a1 1 0 0 1-1-.9z" />
        <path d="M8 7a4 4 0 0 1 8 0" />
      </svg>
      {count > 0 && (
        <span className={`absolute -end-0.5 -top-0.5 min-w-5 rounded-pill bg-yolk px-1.5 text-center text-[11px] font-extrabold leading-5 text-ink tabular ${bump ? 'animate-pop' : ''}`} aria-hidden="true">
          {count}
        </span>
      )}
    </a>
  );
}
