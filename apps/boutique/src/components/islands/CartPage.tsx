import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DeliveryZone, Lang, Product, Settings } from '@ferme/core';
import { allowedDeliveryDates, deliveryFee, displayPrice, formatPrice, isEstimated, lineTotal, roundMillimes } from '@ferme/core';
import { addToCart, cartHasEstimated, cartLines, cartSubtotal, removeFromCart, setQty } from '@/stores/cart';
import { data } from '@/lib/data';
import { href, routes } from '@/lib/paths';
import { t, L } from '@/i18n';
import { ErrorBox, ProductImage, Skeleton, Stepper, preferredZoneId, useMounted, whenIdle } from './shared';
import { EmptyState, FreeShipBar, IcoClock, IcoPlus, IcoScale, IcoTruck, Money, cutoffLeft, dayWord, formatKg, formatLeft, lineWeight, useNow } from './tunnel';
import type { Dictionary } from '@/i18n/fr';

interface Props {
  lang: Lang;
}

/** Page panier : lignes, heure limite, progression vers la livraison offerte, oublis, minimum de commande. */
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
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  const [ctaSeen, setCtaSeen] = useState(true);
  const ctaRef = useRef<HTMLDivElement>(null);

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

  // Le catalogue sert aux suggestions : rien d'urgent, on attend un temps mort.
  useEffect(
    () =>
      whenIdle(() => {
        data()
          .listProducts()
          .then(setCatalog)
          .catch(() => setCatalog([]));
      }),
    [],
  );

  // Le résumé du bas ne se montre que si le vrai bouton est hors de l'écran.
  // Mesure directe plutôt qu'un observateur : la position se relit à chaque
  // défilement, sans dépendre d'une notification qui peut ne jamais venir.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const check = () => {
      const r = el.getBoundingClientRect();
      setCtaSeen(r.top < window.innerHeight - 72 && r.bottom > 0);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [mounted, lines.length, settings]);

  const inCart = useMemo(() => new Set(lines.map((l) => l.product_id)), [lines]);
  const picks = useMemo(() => {
    if (!catalog) return [];
    const score = (p: Product) => (p.badges.includes('best') ? 4 : 0) + (p.is_featured ? 2 : 0) + (p.badges.includes('promo') ? 1 : 0);
    return catalog
      .filter((p) => p.stock === 'en_stock' && !inCart.has(p.id))
      .sort((a, b) => score(b) - score(a) || a.sort - b.sort)
      .slice(0, 3);
  }, [catalog, inCart]);

  const weight = useMemo(() => roundMillimes(lines.reduce((s, l) => s + lineWeight(l.pricing, l.qty), 0)), [lines]);

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
      <div className="card px-6 py-10">
        <EmptyState art="poussin" title={d.cart.empty}>
          <a href={href(lang, routes.shop)} className="btn-primary btn-lg mt-2">
            {d.cart.emptyCta}
          </a>
        </EmptyState>
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
    <div className={`flex flex-col gap-5 ${ctaSeen ? '' : 'pb-20 lg:pb-0'}`}>
      {settings && zone && <Cutoff lang={lang} d={d} settings={settings} zone={zone} />}

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
                        <Money value={formatPrice(amount, lang)} />
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {weight > 0 && (
            <p className="flex items-center gap-2.5 rounded-md bg-cream px-4 py-3 text-sm text-ink-2">
              <IcoScale className="shrink-0 text-prairie" size={20} />
              <span>
                <span className="font-semibold">{d.cart.weightValue(formatKg(weight, lang))}</span>
                <span className="ms-1.5 text-ink-3">{d.cart.weightHelp}</span>
              </span>
            </p>
          )}

          {picks.length > 0 && <Suggestions lang={lang} d={d} picks={picks} />}

          <a href={href(lang, routes.shop)} className="btn-ghost self-start">
            {d.cart.continue}
          </a>
        </section>

        <aside className="card mt-8 flex flex-col gap-4 p-5 lg:sticky lg:mt-0" style={{ top: 'calc(var(--stick-top) + 16px)' }} aria-label={d.cart.summary}>
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
            <div className="flex flex-col gap-2.5">
              <p className="flex items-center gap-2 text-sm text-ink-3">
                <IcoTruck size={18} className="text-ink-3" />
                {d.cart.zone(L(zone.name, lang))}
              </p>
              {freeFrom > 0 && (
                <>
                  <FreeShipBar percent={progress} reached={freeReached} label={d.cart.progressLabel} />
                  <p className={`text-sm font-semibold ${freeReached ? 'text-prairie-deep' : 'text-yolk-deep'}`} aria-live="polite">
                    {freeReached ? `${d.cart.freeReached} ${d.cart.freeSaved(formatPrice(zone.fee, lang))}` : d.cart.freeMissing(formatPrice(roundMillimes(freeFrom - subtotal), lang))}
                  </p>
                </>
              )}
            </div>
          )}

          <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">{d.common.subtotal}</dt>
              <dd className="font-semibold tabular">
                <Money value={formatPrice(subtotal, lang)} />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">{d.common.delivery}</dt>
              <dd className={`font-semibold tabular ${fee === 0 ? 'text-prairie-deep' : ''}`}>{fee == null ? '…' : fee === 0 ? d.common.free : formatPrice(fee, lang)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
              <dt className="font-bold">{hasEstimated ? d.cart.estimatedTotal : d.common.total}</dt>
              <dd className="font-display text-xl font-extrabold tabular">
                <Money value={formatPrice(total, lang)} />
              </dd>
            </div>
          </dl>
          {hasEstimated && <p className="text-xs text-ink-3">{d.cart.estimateNote}</p>}
          {settings && minOrder > 0 && <p className="text-xs text-ink-3">{d.cart.minOrder(formatPrice(minOrder, lang))}</p>}

          <div ref={ctaRef} className="flex flex-col gap-4">
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
          </div>
        </aside>
      </div>

      {/* Résumé qui reste en bas d'écran sur téléphone. */}
      <div className="fk-sticky" data-off={ctaSeen ? 'true' : 'false'} aria-hidden={ctaSeen} role="region" aria-label={d.cart.stickyLabel}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-ink-3">{hasEstimated ? d.cart.estimatedTotal : d.common.total}</p>
            <p className="font-display text-lg font-extrabold tabular leading-tight">
              <Money value={formatPrice(total, lang)} />
            </p>
          </div>
          {settings && belowMin ? (
            <span className="max-w-[55%] text-end text-xs font-semibold text-yolk-deep">{d.cart.minOrderMissing(formatPrice(missing, lang))}</span>
          ) : (
            <a href={href(lang, routes.checkout)} className="btn-primary" tabIndex={ctaSeen ? -1 : undefined}>
              {d.cart.checkout}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Heure limite : « Commandez dans 2 h 14 pour être livré demain »     */
/* ------------------------------------------------------------------ */

function Cutoff({ lang, d, settings, zone }: { lang: Lang; d: Dictionary; settings: Settings; zone: DeliveryZone }) {
  const now = useNow();
  const { past, minutes } = cutoffLeft(settings.cutoff_time, now);
  const dates = allowedDeliveryDates({ now, maxDaysAhead: settings.max_days_ahead, cutoffTime: settings.cutoff_time, closedDays: settings.closed_days, leadDays: zone.lead_days });
  const first = dates[0];
  if (!first) return null;
  const urgent = !past && minutes <= 120;
  const left = formatLeft(minutes, d);
  return (
    <p className={`fk-cutoff ${urgent ? 'is-urgent' : ''} ${past ? 'is-past' : ''}`}>
      <IcoClock className="fk-cutoff-ico" size={22} />
      <span className="text-sm text-ink-2">{past ? d.cart.cutoffPast(dayWord(first, lang, d)) : <Highlight text={d.cart.cutoffBefore(left, dayWord(first, lang, d))} part={left} />}</span>
    </p>
  );
}

/** Met en gras une portion de phrase, sans découper la traduction. */
function Highlight({ text, part }: { text: string; part: string }) {
  const at = text.indexOf(part);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="fk-strong text-ink">{part}</span>
      {text.slice(at + part.length)}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* « Vous oubliez quelque chose ? »                                    */
/* ------------------------------------------------------------------ */

function Suggestions({ lang, d, picks }: { lang: Lang; d: Dictionary; picks: Product[] }) {
  return (
    <section className="mt-2 flex flex-col gap-3" aria-labelledby="suggest-title">
      <div>
        <h2 id="suggest-title" className="text-base font-extrabold">
          {d.cart.suggestTitle}
        </h2>
        <p className="text-sm text-ink-3">{d.cart.suggestText}</p>
      </div>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
        {picks.map((p) => {
          const price = displayPrice(p.pricing, lang);
          return (
            <li key={p.id} className="fk-suggest fk-pop">
              <a href={href(lang, routes.product(p.slug))} className="block h-14 w-14 shrink-0 overflow-hidden rounded-md bg-cream" tabIndex={-1} aria-hidden="true">
                <ProductImage src={p.images[0] ?? ''} className="h-full w-full" />
              </a>
              <div className="min-w-0 flex-1">
                <a href={href(lang, routes.product(p.slug))} className="line-clamp-2 text-sm font-bold leading-tight">
                  {L(p.name, lang)}
                </a>
                <p className="text-xs font-semibold text-ink-3 tabular">
                  {price.amount} <span className="font-medium">{price.unit}</span>
                </p>
              </div>
              <button type="button" className="fk-suggest-add" onClick={() => addToCart(p)} aria-label={`${d.common.add} · ${L(p.name, lang)}`}>
                <IcoPlus size={20} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
