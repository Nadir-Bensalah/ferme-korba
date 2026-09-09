import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { Lang } from '@ferme/core';

const SearchPanel = lazy(() => import('./SearchPanel'));

interface Props {
  lang: Lang;
  label: string;
  /** Rendu en bouton large avec le texte (page boutique) ou en icône (en-tête). */
  wide?: boolean;
  placeholder?: string;
}

/**
 * Bouton de recherche. Le panneau et les données ne se chargent qu'au premier
 * clic, pour ne rien coûter aux pages qui ne cherchent rien.
 * Raccourcis : Ctrl K ou Cmd K, et « / » hors d'un champ de saisie.
 */
export default function SearchButton({ lang, label, wide = false, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [warm, setWarm] = useState(false);

  const show = useCallback(() => {
    setWarm(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        show();
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        show();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [show]);

  const icon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );

  return (
    <>
      {wide ? (
        <button
          type="button"
          onClick={show}
          onPointerEnter={() => setWarm(true)}
          className="field flex items-center gap-3 text-start text-ink-3 shadow-card hover:border-ink"
          aria-label={label}
        >
          {icon}
          <span className="flex-1 truncate">{placeholder ?? label}</span>
          <kbd className="hidden rounded-sm border border-line-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-3 sm:inline">Ctrl K</kbd>
        </button>
      ) : (
        <button type="button" onClick={show} onPointerEnter={() => setWarm(true)} className="inline-flex rounded-pill p-2.5 text-ink hover:bg-cream" aria-label={label} aria-haspopup="dialog" aria-expanded={open}>
          {icon}
        </button>
      )}
      {warm && (
        <Suspense fallback={null}>
          <SearchPanel lang={lang} open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
