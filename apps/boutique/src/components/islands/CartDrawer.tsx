import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DeliveryZone, Lang, Product, Settings } from '@ferme/core';
import { displayPrice, formatPrice, isEstimated, lineTotal, roundMillimes, seedProducts, seedSettings, seedZones } from '@ferme/core';
import type { CartLine } from '@/stores/cart';
import { addToCart, cartHasEstimated, cartLines, cartSubtotal, removeFromCart, setQty, undoRemove } from '@/stores/cart';
import { data } from '@/lib/data';
import { href, routes } from '@/lib/paths';
import { t, L } from '@/i18n';
import { ProductImage, Stepper, preferredZoneId } from './shared';
import { DecoArt, Money } from './tunnel';

interface Props {
  lang: Lang;
  open: boolean;
  onClose: () => void;
}

/**
 * Panneau de panier : il glisse depuis le bord de l'écran sans quitter la page.
 * Collé au bord sur ordinateur, plein écran sur téléphone. Il porte ses propres
 * styles : les feuilles du tunnel de commande ne sont chargées que sur les pages
 * du tunnel, alors que le panneau, lui, peut s'ouvrir partout.
 */

const CSS = `
.cd-root { position: fixed; inset: 0; z-index: 75; }
.cd-veil {
  position: absolute; inset: 0;
  background: color-mix(in srgb, var(--color-ink) 45%, transparent);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  opacity: 0; transition: opacity .3s var(--ease-out-expo);
}
.cd-root[data-open='true'] .cd-veil { opacity: 1; }
.cd-panel {
  position: absolute; inset-block: 0; inset-inline-end: 0;
  display: flex; flex-direction: column;
  width: 100%; max-width: 600px;
  background: var(--color-paper);
  box-shadow: var(--shadow-float);
  transform: translateX(var(--cd-off));
  transition: transform .3s var(--ease-out-expo);
  will-change: transform;
}
.cd-root[data-open='true'] .cd-panel { transform: none; }
@media (width >= 640px) {
  .cd-panel {
    border-start-start-radius: var(--radius-lg);
    border-end-start-radius: var(--radius-lg);
  }
}
.cd-head {
  display: flex; align-items: center; gap: 1rem;
  padding: 1.25rem 1.5rem 1rem; padding-top: max(1.25rem, env(safe-area-inset-top));
  border-bottom: 1px solid var(--color-line);
}
.cd-bag { position: relative; flex: none; color: var(--color-prairie); }
.cd-bag-n {
  position: absolute; top: -6px; inset-inline-end: -6px;
  min-width: 24px; height: 24px; padding: 0 6px; border-radius: 999px;
  background: var(--color-prairie-deep); color: #fff;
  font-size: 12px; font-weight: 800; line-height: 24px; text-align: center;
  font-variant-numeric: tabular-nums;
}
.cd-close {
  display: inline-flex; height: 56px; width: 56px; flex: none;
  align-items: center; justify-content: center;
  border-radius: 999px; background: var(--color-cream); color: var(--color-ink);
  transition: background-color .2s;
}
.cd-close:hover { background: var(--color-cream-2); }
.cd-body {
  flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain;
  display: flex; flex-direction: column; gap: 1.25rem;
  padding: 1rem 1.5rem 1.5rem;
}
.cd-foot {
  flex: none;
  border-top: 1px solid var(--color-line);
  background: var(--color-paper);
  padding: 1rem 1.5rem calc(1rem + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; gap: .75rem;
  box-shadow: 0 -10px 26px -20px rgba(22, 32, 26, .55);
}
.cd-icon {
  display: inline-flex; height: 48px; width: 48px; flex: none;
  align-items: center; justify-content: center;
  border-radius: 999px; color: var(--color-ink-2);
  transition: background-color .2s, color .2s;
}
.cd-icon:hover { background: var(--color-cream); color: var(--color-ink); }
.cd-line { display: flex; gap: 1.25rem; padding: 1.25rem 0; border-top: 1px solid var(--color-line); }
.cd-line:first-child { border-top: 0; padding-top: .5rem; }
.cd-thumb {
  height: 120px; width: 120px; flex: none; overflow: hidden;
  border-radius: 1rem; background: var(--color-cream);
}
@media (width < 640px) { .cd-thumb { height: 80px; width: 80px; } .cd-line { gap: .875rem; } .cd-short { display: none; } }
.cd-step .stepper { width: 100%; justify-content: space-between; background: var(--color-cream); border-color: var(--color-line-2); }
.cd-step .stepper-value { flex: 1; font-size: 15px; }
.cd-free {
  display: flex; align-items: center; gap: 1rem;
  border-radius: var(--radius-lg); background: var(--color-prairie-soft); padding: 1.125rem 1.25rem;
}
.cd-free-ico {
  display: inline-flex; height: 60px; width: 60px; flex: none; align-items: center; justify-content: center;
  border-radius: 999px; background: color-mix(in srgb, var(--color-prairie) 18%, transparent); color: var(--color-prairie-deep);
}
.cd-note {
  display: flex; align-items: center; gap: 1rem;
  border-radius: var(--radius-lg); background: var(--color-cream); padding: 1rem 1.25rem;
  font-weight: 600; color: var(--color-ink); transition: background-color .2s;
}
.cd-note:hover { background: var(--color-cream-2); }
.cd-trust { display: flex; justify-content: space-between; gap: .5rem; padding-top: .25rem; }
.cd-trust li { display: flex; align-items: center; gap: .5rem; font-size: 13px; font-weight: 600; color: var(--color-ink-2); }
.cd-trust svg { color: var(--color-prairie); flex: none; }
.cd-bar { height: 10px; border-radius: 999px; background: color-mix(in srgb, var(--color-prairie) 18%, transparent); overflow: hidden; }
.cd-bar-fill {
  height: 100%; min-width: 10px; border-radius: 999px;
  background: var(--color-prairie);
  transition: width .6s var(--ease-out-expo), background .3s ease;
}
.cd-bar-fill[data-full='true'] { background: linear-gradient(90deg, var(--color-prairie), #2f9d55); }
.cd-sug {
  display: flex; align-items: center; gap: .75rem;
  border: 1px solid var(--color-line); border-radius: var(--radius-md);
  background: var(--color-paper); padding: .5rem;
  transition: border-color .2s;
}
.cd-sug:hover { border-color: var(--color-line-2); }
.cd-sug-add {
  display: inline-flex; height: 48px; width: 48px; flex: none;
  align-items: center; justify-content: center;
  border-radius: 999px; background: var(--color-prairie-soft); color: var(--color-prairie-deep);
  transition: background-color .2s, color .2s, transform .2s;
}
.cd-sug-add:hover { background: var(--color-prairie); color: #fff; }
.cd-sug-add:active { transform: scale(.92); }
@media (prefers-reduced-motion: reduce) {
  .cd-panel { transform: none; opacity: 0; transition: opacity .2s ease; }
  .cd-root[data-open='true'] .cd-panel { opacity: 1; }
  .cd-veil, .cd-bar-fill { transition: none; }
}
`;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function CartDrawer({ lang, open, onClose }: Props) {
  const d = t(lang);
  const lines = useStore(cartLines);
  const subtotal = useStore(cartSubtotal);
  const hasEstimated = useStore(cartHasEstimated);
  const zoneId = useStore(preferredZoneId);

  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [zones, setZones] = useState<DeliveryZone[]>(seedZones);
  const [settings, setSettings] = useState<Settings>(seedSettings);
  const [undo, setUndo] = useState<CartLine | null>(null);

  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const fetched = useRef(false);

  // Entrée et sortie : le panneau reste monté le temps de glisser dehors.
  useEffect(() => {
    if (open) {
      setRender(true);
      // Le glissement a besoin que l'état fermé soit peint d'abord. L'image
      // suivante suffit, avec un filet de sécurité au cas où le navigateur ne
      // dessine pas (onglet en arrière-plan) : sans lui, le panneau resterait
      // hors de l'écran.
      const raf = requestAnimationFrame(() => setShown(true));
      const fb = setTimeout(() => setShown(true), 40);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(fb);
      };
    }
    setShown(false);
    const id = setTimeout(() => setRender(false), 320);
    return () => clearTimeout(id);
  }, [open]);

  // Défilement bloqué derrière, focus donné au panneau puis rendu au bouton.
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    document.documentElement.style.overflow = 'hidden';
    const id = setTimeout(() => closeBtn.current?.focus(), 30);
    return () => {
      clearTimeout(id);
      document.documentElement.style.overflow = '';
      opener.current?.focus();
    };
  }, [open]);

  // Échap, où que soit le curseur.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Un lien du panneau mène ailleurs : le panneau se referme avec la page.
  useEffect(() => {
    const off = () => onClose();
    document.addEventListener('astro:before-swap', off);
    return () => document.removeEventListener('astro:before-swap', off);
  }, [onClose]);

  // Le site tel que construit s'affiche tout de suite ; la base, si elle
  // répond, remplace les prix et les suggestions.
  useEffect(() => {
    if (!open || fetched.current) return;
    fetched.current = true;
    let alive = true;
    const src = data();
    Promise.all([src.listProducts(), src.listZones(), src.getSettings()])
      .then(([p, z, s]) => {
        if (!alive) return;
        if (p.length) setProducts(p);
        if (z.length) setZones(z);
        if (s) setSettings(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(id);
  }, [undo]);

  const remove = useCallback((line: CartLine) => {
    removeFromCart(line.product_id);
    setUndo(line);
  }, []);

  const onTab = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const inCart = useMemo(() => new Set(lines.map((l) => l.product_id)), [lines]);
  const picks = useMemo(() => {
    const score = (p: Product) => (p.badges.includes('best') ? 4 : 0) + (p.is_featured ? 2 : 0) + (p.badges.includes('promo') ? 1 : 0);
    return products
      .filter((p) => p.stock === 'en_stock' && !inCart.has(p.id))
      .sort((a, b) => score(b) - score(a) || a.sort - b.sort)
      .slice(0, 3);
  }, [products, inCart]);

  if (!render || typeof document === 'undefined') return null;

  const zone = zones.find((z) => z.id === zoneId) ?? [...zones].sort((a, b) => a.fee - b.fee)[0] ?? null;
  const freeFrom = zone?.free_from ?? 0;
  const freeReached = freeFrom > 0 && subtotal >= freeFrom;
  const progress = freeFrom > 0 ? Math.min(100, Math.round((subtotal / freeFrom) * 100)) : 0;
  const minOrder = settings.min_order ?? 0;
  const belowMin = minOrder > 0 && subtotal < minOrder;
  const missing = roundMillimes(minOrder - subtotal);
  const empty = lines.length === 0;

  return createPortal(
    <div className="cd-root" data-open={shown ? 'true' : 'false'} style={{ '--cd-off': lang === 'ar' ? '-100%' : '100%' } as React.CSSProperties}>
      <style>{CSS}</style>
      <div className="cd-veil" onClick={onClose} aria-hidden="true" />

      <div ref={panel} className="cd-panel" role="dialog" aria-modal="true" aria-labelledby="cd-title" onKeyDown={onTab}>
        <header className="cd-head">
          <span className="cd-bag" aria-hidden="true">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8h14l-1 12H6z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            {!empty && <span className="cd-bag-n">{lines.length}</span>}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="cd-title" className="font-display text-2xl font-extrabold leading-tight text-ink sm:text-[1.75rem]">
              {d.cart.title}
            </h2>
            <p className="mt-0.5 text-sm text-ink-2">
              {empty ? d.cart.empty : `${d.cart.items(lines.length)} • ${d.cart.drawerSub}`}
            </p>
          </div>
          <button ref={closeBtn} type="button" className="cd-close" onClick={onClose} aria-label={d.common.close}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="cd-body">
          {empty ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <span className="grid h-26 w-26 place-items-center rounded-pill bg-cream" aria-hidden="true">
                <DecoArt type="poussin" className="h-20 w-20 text-prairie/60" />
              </span>
              <p className="text-base font-bold">{d.cart.empty}</p>
              <p className="max-w-xs text-sm text-ink-3">{d.cart.emptyText}</p>
              <a href={href(lang, routes.shop)} className="btn-primary btn-lg mt-1">
                {d.cart.emptyCta}
              </a>
            </div>
          ) : null}

          {!empty && (
            <>
              <ul>
                {lines.map((l) => {
                  const price = displayPrice(l.pricing, lang);
                  const est = isEstimated(l.pricing);
                  const name = L(l.name, lang);
                  const short = products.find((p) => p.id === l.product_id)?.short;
                  return (
                    <li key={l.product_id} className="cd-line">
                      <a href={href(lang, routes.product(l.slug))} className="cd-thumb" tabIndex={-1} aria-hidden="true">
                        <ProductImage src={l.image} className="h-full w-full" />
                      </a>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-display text-lg font-extrabold leading-tight">
                              <a href={href(lang, routes.product(l.slug))} className="hover:text-prairie-deep">
                                {name}
                              </a>
                            </h3>
                            {short && <p className="cd-short mt-0.5 text-sm text-ink-3">{L(short, lang)}</p>}
                            <p className="mt-1 text-sm font-semibold text-prairie tabular">
                              {price.amount} <span className="font-medium">{price.unit}</span>
                            </p>
                          </div>
                          <p className="shrink-0 font-display text-lg font-extrabold tabular">
                            {est && <span className="me-1 text-xs font-semibold text-ink-3">≈</span>}
                            <Money value={formatPrice(lineTotal(l.pricing, l.qty), lang)} />
                          </p>
                          <button type="button" onClick={() => remove(l)} className="-me-2 -mt-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-ink-2 hover:bg-cream hover:text-ink" aria-label={`${d.cart.remove} · ${name}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </button>
                        </div>
                        <div className="cd-step mt-2">
                          <Stepper pricing={l.pricing} qty={l.qty} onChange={(q) => setQty(l.product_id, q)} lang={lang} d={d} allowBelowMin label={`${d.shop.qty} · ${name}`} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {undo && !inCart.has(undo.product_id) && (
                <p className="flex items-center justify-between gap-3 rounded-md bg-cream px-4 py-2.5 text-sm" role="status">
                  <span className="min-w-0 truncate font-semibold text-ink-2">
                    {L(undo.name, lang)} · {d.cart.removed}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-pill px-3 py-2 text-sm font-extrabold text-prairie-deep hover:bg-prairie-soft"
                    onClick={() => {
                      undoRemove();
                      setUndo(null);
                    }}
                  >
                    {d.cart.undo}
                  </button>
                </p>
              )}

              {freeFrom > 0 && (
                <div className="cd-free">
                  <span className="cd-free-ico" aria-hidden="true">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M2 6.5A1.5 1.5 0 0 1 3.5 5H14a1 1 0 0 1 1 1v9H2z" />
                      <path d="M15 9h3.2a1 1 0 0 1 .8.4l2.6 3.3a1 1 0 0 1 .2.6V15h-6.8z" />
                      <circle cx="6.5" cy="17.5" r="2.2" />
                      <circle cx="17.5" cy="17.5" r="2.2" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-extrabold leading-tight text-prairie-deep">{d.cart.freeReached}</p>
                    <p className="mt-0.5 text-sm text-ink-2" aria-live="polite">
                      {freeReached ? d.cart.freeSavedLong(formatPrice(zone?.fee ?? 0, lang)) : d.cart.freeMissingShort(formatPrice(roundMillimes(freeFrom - subtotal), lang))}
                    </p>
                    <div className="cd-bar mt-3" role="progressbar" aria-label={d.cart.progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={freeReached ? 100 : progress}>
                      <div className="cd-bar-fill" data-full={freeReached ? 'true' : 'false'} style={{ width: `${freeReached ? 100 : Math.max(4, progress)}%` }} />
                    </div>
                  </div>
                </div>
              )}

              <a href={href(lang, routes.checkout)} className="cd-note">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-prairie" aria-hidden="true">
                  <path d="M3 10h18v4H3zM5 14v7h14v-7M12 10v11M12 10c-2-4-6-5-6-2s4 2 6 2Zm0 0c2-4 6-5 6-2s-4 2-6 2Z" />
                </svg>
                <span className="min-w-0 flex-1">{d.cart.addNote}</span>
                <svg className="shrink-0 rtl:-scale-x-100" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </a>
            </>
          )}

          {picks.length > 0 && (
            <section aria-labelledby="cd-suggest" className="flex flex-col gap-2.5">
              <h3 id="cd-suggest" className="text-sm font-extrabold">
                {d.cart.suggestTitle}
              </h3>
              <ul className="flex flex-col gap-2">
                {picks.map((p) => {
                  const price = displayPrice(p.pricing, lang);
                  const name = L(p.name, lang);
                  return (
                    <li key={p.id} className="cd-sug">
                      <a href={href(lang, routes.product(p.slug))} className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-cream" tabIndex={-1} aria-hidden="true">
                        <ProductImage src={p.images[0] ?? ''} className="h-full w-full" />
                      </a>
                      <div className="min-w-0 flex-1">
                        <a href={href(lang, routes.product(p.slug))} className="line-clamp-2 text-sm font-bold leading-tight">
                          {name}
                        </a>
                        <p className="text-xs font-semibold text-ink-3 tabular">
                          {price.amount} <span className="font-medium">{price.unit}</span>
                        </p>
                      </div>
                      <button type="button" className="cd-sug-add" onClick={() => addToCart(p)} aria-label={`${d.common.add} · ${name}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                          <path d="M12 5.5v13M5.5 12h13" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {!empty && (
          <div className="cd-foot">
            {belowMin && (
              <p className="rounded-md bg-yolk-soft px-4 py-2.5 text-sm font-semibold text-yolk-deep" role="alert">
                {d.cart.minOrderMissing(formatPrice(missing, lang))}
              </p>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-lg font-semibold text-ink">{d.common.subtotal}</span>
              <span className="font-display text-[1.75rem] font-extrabold tabular">
                {hasEstimated && <span className="me-1 align-middle text-base font-semibold text-ink-3">≈</span>}
                <Money value={formatPrice(subtotal, lang)} />
              </span>
            </div>
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-prairie" aria-hidden="true">
                <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" />
                <path d="M5 19c3-4 6-7 10-9" />
              </svg>
              {d.cart.deliveryNext}
            </p>
            {belowMin ? (
              <button type="button" className="btn-primary btn-lg w-full cursor-not-allowed bg-prairie-deep opacity-50" disabled aria-disabled="true">
                {d.cart.checkout}
              </button>
            ) : (
              <a href={href(lang, routes.checkout)} className="btn-primary btn-lg min-h-16 w-full gap-3 bg-prairie-deep text-lg hover:bg-prairie">
                {d.cart.checkout}
                <svg className="rtl:-scale-x-100" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
            )}
            <a href={href(lang, routes.cart)} className="self-center rounded-pill px-3 py-1.5 text-sm font-bold text-prairie-deep underline underline-offset-4 hover:text-prairie">
              {d.cart.viewCart}
            </a>
            <ul className="cd-trust">
              <li>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19c3-4 6-7 10-9" /></svg>
                {d.cart.drawerTrust[0]}
              </li>
              <li>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.2 5 6v6.1c0 4 3 6.7 7 8.2 4-1.5 7-4.2 7-8.2V6z" /><path d="m9 12 2.1 2.1L15.2 10" /></svg>
                {d.cart.drawerTrust[1]}
              </li>
              <li>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 6.5h10.5v10H2.5z" /><path d="M13 10h3.6l3.9 3.6v2.9H13z" /><circle cx="7" cy="17.5" r="1.9" /><circle cx="17" cy="17.5" r="1.9" /></svg>
                {d.cart.drawerTrust[2]}
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
