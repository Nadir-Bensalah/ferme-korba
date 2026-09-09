import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import type { Lang } from '@ferme/core';
import { cartLines, lastAdded, lastRemoved, undoRemove } from '@/stores/cart';
import { t, L } from '@/i18n';
import { href, routes } from '@/lib/paths';

interface Props {
  lang: Lang;
}

interface Toast {
  id: number;
  kind: 'added' | 'removed';
  text: string;
  image?: string;
}

/**
 * Petites notifications en bas d'écran : « Ajouté » avec la photo du produit,
 * « Article retiré » avec un bouton Annuler. Une seule à la fois, 3 secondes.
 */
export default function Toasts({ lang }: Props) {
  const d = t(lang);
  const added = useStore(lastAdded);
  const removed = useStore(lastRemoved);
  const [toast, setToast] = useState<Toast | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !added) return;
    const line = cartLines.get().find((l) => l.product_id === added.product_id);
    if (!line) return;
    setToast({ id: added.at, kind: 'added', text: `${L(line.name, lang)} · ${d.common.added}`, image: line.image });
  }, [added, mounted]);

  useEffect(() => {
    if (!mounted || !removed) return;
    setToast({ id: Date.now(), kind: 'removed', text: `${L(removed.name, lang)} · ${d.cart.removed}` });
  }, [removed, mounted]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.kind === 'removed' ? 5000 : 2800);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ bottom: 'calc(var(--bottom-bar-h) + env(safe-area-inset-bottom) + 12px)' }} role="status" aria-live="polite">
      <div key={toast.id} className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-ink px-3 py-2.5 text-paper shadow-float animate-pop">
        {toast.image ? <img src={toast.image} alt="" className="h-10 w-10 rounded-md object-cover" width={40} height={40} /> : null}
        <span className="text-sm font-semibold">{toast.text}</span>
        {toast.kind === 'added' ? (
          <a href={href(lang, routes.cart)} className="ms-1 shrink-0 rounded-pill bg-yolk px-3 py-1.5 text-xs font-extrabold text-ink">
            {d.shop.goToCart}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => {
              undoRemove();
              setToast(null);
            }}
            className="ms-1 shrink-0 rounded-pill bg-paper/15 px-3 py-1.5 text-xs font-extrabold"
          >
            {d.cart.undo}
          </button>
        )}
      </div>
    </div>
  );
}
