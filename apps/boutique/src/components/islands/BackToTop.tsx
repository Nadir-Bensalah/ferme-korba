import { useEffect, useState } from 'react';
import type { Lang } from '@ferme/core';
import { t } from '@/i18n';

/**
 * Le bouton « retour en haut ». Il n'apparaît qu'après un long défilement, et
 * se pose au-dessus de la barre du bas sur mobile pour ne rien recouvrir.
 * Caché, il sort aussi de l'ordre de tabulation.
 */
export default function BackToTop({ lang }: { lang: Lang }) {
  const d = t(lang);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 1.5);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const up = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={up}
      aria-label={d.common.backToTop}
      data-back-to-top
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={`fixed end-4 z-30 flex h-12 w-12 items-center justify-center rounded-pill bg-ink text-paper shadow-float transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-prairie-deep active:scale-95 motion-reduce:transition-none bottom-[calc(var(--bottom-bar-h)+1rem+env(safe-area-inset-bottom))] lg:bottom-6 ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20V5.4M6.4 11 12 5.4 17.6 11" />
      </svg>
    </button>
  );
}
