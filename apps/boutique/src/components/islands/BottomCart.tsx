import { useStore } from '@nanostores/react';
import type { Lang } from '@ferme/core';
import { cartCount } from '@/stores/cart';

interface Props {
  lang: Lang;
  href: string;
  label: string;
  active?: boolean;
}

/** Onglet panier de la barre du bas, avec compteur. */
export default function BottomCart({ href, label, active }: Props) {
  const count = useStore(cartCount);
  return (
    <a
      href={href}
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[11px] font-bold transition-colors ${active ? 'text-prairie' : 'text-ink-3'}`}
      aria-current={active ? 'page' : undefined}
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
