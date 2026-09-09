import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useState } from 'react';
import type { DeliveryZone, Lang, Settings } from '@ferme/core';
import { deliveryFee, formatPrice, isEstimated, lineTotal, roundMillimes } from '@ferme/core';
import { cartHasEstimated, cartLines, cartSubtotal, removeFromCart, setQty } from '@/stores/cart';
import { data } from '@/lib/data';
import { href, routes } from '@/lib/paths';
import { t, L } from '@/i18n';
import { ErrorBox, ProductImage, Skeleton, Stepper, preferredZoneId, useMounted } from './shared';

interface Props {
  lang: Lang;
}

/** Page panier : lignes, progression vers la livraison offerte, minimum de commande. */
export default function CartPage({ lang }: Props) {
  const d = t(lang);
  const mounted = useMounted();
  const lines = useStore(cartLines);
  const subtotal = useStore(cartSubtotal);
  const hasEstimated = useStore(cartHasEstimated);
  const zoneId = useStore(preferredZoneId);

  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([data().listZones(), data().getSettings()])
      .then(([z, s]) => {
        setZones(z);
        setSettings(s);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (!mounted) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-5 px-6 py-14 text-center">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-ink-3">
          <path d="M4 7h16l-1.5 12.5a1 1 0 0 1-1 .9h-11a1 1 0 0 1-1-.9z" />
          <path d="M8 7a4 4 0 0 1 8 0" />
        </svg>
        <p className="text-lg font-bold">{d.cart.empty}</p>
        <a href={href(lang, routes.shop)} className="btn-primary btn-lg">
          {d.cart.emptyCta}
        </a>
      </div>
    );
  }

  const zone = zones ? (zones.find((z) => z.id === zoneId) ?? [...zones].sort((a, b) => a.fee - b.fee)[0] ?? null) : null;
  const fee = zone ? deliveryFee(zone, subtotal) : null;
  const total = fee != null ? roundMillimes(subtotal + fee) : subtotal;
  const minOrder = settings?.min_order ?? 0;
  const belowMin = subtotal < minOrder;
  const missing = roundMillimes(minOrder - subtotal);
  const freeFrom = zone?.free_from ?? 0;
  const progress = freeFrom > 0 ? Math.min(100, Math.round((subtotal / freeFrom) * 100)) : 0;
  const freeReached = freeFrom > 0 && subtotal >= freeFrom;

  return (
    <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-10">
      <section aria-label={d.cart.items(lines.length)} className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink-3">{d.cart.items(lines.length)}</p>
        <ul className="flex flex-col gap-3">
          {lines.map((l) => {
            const amount = lineTotal(l.pricing, l.qty);
            const est = isEstimated(l.pricing);
            return (
              <li key={l.product_id} className="card flex gap-3 p-3 sm:gap-4 sm:p-4">
                <a href={href(lang, routes.product(l.slug))} className="block h-20 w-20 shrink-0 overflow-hidden rounded-md bg-cream sm:h-24 sm:w-24" tabIndex={-1} aria-hidden="true">
                  <ProductImage src={l.image} className="h-full w-full" />
                </a>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold leading-tight">
                      <a href={href(lang, routes.product(l.slug))}>{L(l.name, lang)}</a>
                    </h3>
                    <button type="button" onClick={() => removeFromCart(l.product_id)} className="-me-1 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-ink-3 hover:bg-cream hover:text-ink" aria-label={`${d.cart.remove} · ${L(l.name, lang)}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    <Stepper pricing={l.pricing} qty={l.qty} onChange={(q) => setQty(l.product_id, q)} lang={lang} d={d} small allowBelowMin label={`${d.shop.qty} · ${L(l.name, lang)}`} />
                    <p className="font-display text-lg font-extrabold tabular">
                      {est && <span className="me-1 text-sm font-semibold text-ink-3">≈</span>}
                      {formatPrice(amount, lang)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <a href={href(lang, routes.shop)} className="btn-ghost self-start">
          {d.cart.continue}
        </a>
      </section>

      <aside className="card mt-8 flex flex-col gap-4 p-5 lg:sticky lg:mt-0" style={{ top: 'calc(var(--header-h) + 16px)' }} aria-label={d.cart.summary}>
        <h2 className="text-xl font-extrabold">{d.cart.summary}</h2>

        {failed ? (
          <ErrorBox message={d.common.error} retry={load} retryLabel={d.common.retry} />
        ) : !zone || !settings ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink-3">{d.cart.zone(L(zone.name, lang))}</p>
            {freeFrom > 0 && (
              <>
                <div className="h-2 overflow-hidden rounded-pill bg-cream-2" role="progressbar" aria-label={d.cart.progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                  <div className="h-full rounded-pill bg-prairie transition-[width] duration-500" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-sm font-semibold text-prairie-deep" aria-live="polite">
                  {freeReached ? d.cart.freeReached : d.cart.freeMissing(formatPrice(roundMillimes(freeFrom - subtotal), lang))}
                </p>
              </>
            )}
          </div>
        )}

        <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">{d.common.subtotal}</dt>
            <dd className="font-semibold tabular">{formatPrice(subtotal, lang)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">{d.common.delivery}</dt>
            <dd className="font-semibold tabular">{fee == null ? '…' : fee === 0 ? d.common.free : formatPrice(fee, lang)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
            <dt className="font-bold">{hasEstimated ? d.cart.estimatedTotal : d.common.total}</dt>
            <dd className="font-display text-xl font-extrabold tabular">{formatPrice(total, lang)}</dd>
          </div>
        </dl>
        {hasEstimated && <p className="text-xs text-ink-3">{d.cart.estimateNote}</p>}
        {settings && minOrder > 0 && <p className="text-xs text-ink-3">{d.cart.minOrder(formatPrice(minOrder, lang))}</p>}

        {settings && belowMin ? (
          <>
            <p className="rounded-md bg-yolk-soft px-4 py-3 text-sm font-semibold text-yolk-deep" role="alert">
              {d.cart.minOrderMissing(formatPrice(missing, lang))}
            </p>
            <button type="button" className="btn-primary btn-lg w-full" disabled aria-disabled="true">
              {d.cart.checkout}
            </button>
          </>
        ) : (
          <a href={href(lang, routes.checkout)} className={`btn-primary btn-lg w-full ${!settings ? 'pointer-events-none opacity-60' : ''}`} aria-disabled={!settings || undefined}>
            {d.cart.checkout}
          </a>
        )}
        <p className="text-center text-xs text-ink-3">{d.common.cod}</p>
      </aside>
    </div>
  );
}
