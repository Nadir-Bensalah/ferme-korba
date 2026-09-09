import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DeliveryZone, Lang, Product, Settings } from '@ferme/core';
import { allowedDeliveryDates, deliveryFee, displayPrice, formatPrice, isEstimated, lineTotal, roundMillimes } from '@ferme/core';
import { addToCart, cartHasEstimated, cartLines, cartSubtotal, removeFromCart, setQty } from '@/stores/cart';
import { data } from '@/lib/data';
import { asset, href, routes } from '@/lib/paths';
import { t, L } from '@/i18n';
import { ErrorBox, ProductImage, Skeleton, Stepper, preferredZoneId, useMounted, whenIdle } from './shared';
import { EmptyState, FreeShipBar, IcoCash, IcoCheck, IcoClock, IcoPlus, IcoScale, IcoShield, IcoTruck, Money, cutoffLeft, dayWord, formatKg, formatLeft, lineWeight, useNow } from './tunnel';
import type { Dictionary } from '@/i18n/fr';

interface Props {
  lang: Lang;
}

/**
 * La page panier, d'après la maquette : titre avec le panier vert et le
 * nombre d'articles, l'heure limite dans un encart vert pâle, les lignes en
 * cartes (photo, nom, mention, deux pastilles, compteur, prix, corbeille),
 * le poids estimé, les oublis, et à droite le récapitulatif avec la maison
 * en filigrane, la zone, la livraison offerte, les totaux, le bouton, les
 * deux réassurances, la signature manuscrite et le nid d'œufs qui déborde.
 */
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

  // Le catalogue sert aux mentions des lignes et aux suggestions : rien
  // d'urgent, on attend un temps mort.
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

  const byId = useMemo(() => new Map((catalog ?? []).map((p) => [p.id, p])), [catalog]);
  const inCart = useMemo(() => new Set(lines.map((l) => l.product_id)), [lines]);
  const picks = useMemo(() => {
    if (!catalog) return [];
    const score = (p: Product) => (p.badges.includes('best') ? 4 : 0) + (p.is_featured ? 2 : 0) + (p.badges.includes('promo') ? 1 : 0);
    return catalog
      .filter((p) => p.stock === 'en_stock' && !inCart.has(p.id))
      .sort((a, b) => score(b) - score(a) || a.sort - b.sort)
      .slice(0, 4);
  }, [catalog, inCart]);

  const weight = useMemo(() => roundMillimes(lines.reduce((s, l) => s + lineWeight(l.pricing, l.qty), 0)), [lines]);

  if (!mounted) {
    return (
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-10">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-md" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-56" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <Skeleton className="h-16 w-full rounded-lg sm:w-80" />
          </div>
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <Skeleton className="mt-10 h-[34rem] rounded-3xl lg:mt-0" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <>
        <Title d={d} count={0} />
        <div className="card mt-6 px-6 py-10">
          <EmptyState art="poussin" title={d.cart.empty}>
            <a href={href(lang, routes.shop)} className="btn-primary btn-lg mt-2">
              {d.cart.emptyCta}
            </a>
          </EmptyState>
        </div>
      </>
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
    <div className={`flex flex-col gap-6 ${ctaSeen ? '' : 'pb-20 lg:pb-0'}`}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-10">
        <section aria-label={d.cart.items(lines.length)} className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Title d={d} count={lines.length} />
            {settings && zone && <Cutoff lang={lang} d={d} settings={settings} zone={zone} />}
          </div>

          <ul className="flex flex-col gap-3">
            {lines.map((l) => {
              const amount = lineTotal(l.pricing, l.qty);
              const est = isEstimated(l.pricing);
              const p = byId.get(l.product_id);
              const chips = p ? (d.cart.chips[categorySlug(p)] ?? d.cart.chips['volailles-entieres']!) : null;
              const sub = p ? L(p.short, lang) : '';
              return (
                <li key={l.product_id} className="fk-line">
                  <a href={href(lang, routes.product(l.slug))} className="fk-line-photo" tabIndex={-1} aria-hidden="true">
                    <ProductImage src={l.image} className="h-full w-full" />
                  </a>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <h3 className="font-display text-lg font-extrabold leading-tight sm:text-xl">
                      <a href={href(lang, routes.product(l.slug))}>{L(l.name, lang)}</a>
                    </h3>
                    {sub && <p className="text-[15px] text-ink-3">{sub}</p>}
                    {chips && (
                      <ul className="flex flex-wrap gap-2">
                        <li className="fk-chip">
                          <IcoLeaf />
                          {chips[0]}
                        </li>
                        <li className="fk-chip">
                          <IcoPinSmall />
                          {chips[1]}
                        </li>
                      </ul>
                    )}
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:hidden">
                      <Stepper pricing={l.pricing} qty={l.qty} onChange={(q) => setQty(l.product_id, q)} lang={lang} d={d} small allowBelowMin label={`${d.shop.qty} · ${L(l.name, lang)}`} />
                      <p className="ms-auto font-display text-xl font-extrabold tabular">
                        {est && <span className="me-1 text-sm font-semibold text-ink-3">≈</span>}
                        <Money value={formatPrice(amount, lang)} />
                      </p>
                    </div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-5 sm:flex xl:gap-8">
                    <Stepper pricing={l.pricing} qty={l.qty} onChange={(q) => setQty(l.product_id, q)} lang={lang} d={d} allowBelowMin label={`${d.shop.qty} · ${L(l.name, lang)}`} />
                    <p className="min-w-28 text-end font-display text-2xl font-extrabold tabular">
                      {est && <span className="me-1 text-base font-semibold text-ink-3">≈</span>}
                      <Money value={formatPrice(amount, lang)} />
                    </p>
                  </div>
                  <button type="button" onClick={() => removeFromCart(l.product_id)} className="fk-trash" aria-label={`${d.cart.remove} · ${L(l.name, lang)}`}>
                    <IcoTrash />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="fk-weight">
            <p className="flex items-center gap-3">
              <IcoScale className="shrink-0 text-prairie" size={30} />
              <span>
                <span className="block font-display text-lg font-extrabold leading-tight">{weight > 0 ? d.cart.weightValue(formatKg(weight, lang)) : d.cart.weightTitle}</span>
                <span className="text-sm text-ink-3">{d.cart.weightHelp}</span>
              </span>
            </p>
            <p className="flex items-center gap-2.5 text-sm text-ink-2">
              <IcoLeaf size={22} className="shrink-0 text-prairie" />
              {d.cart.freshNote}
            </p>
          </div>

          {picks.length > 0 && <Suggestions lang={lang} d={d} picks={picks} />}
        </section>

        <aside className="fk-recap mt-10 lg:sticky lg:mt-0" style={{ top: 'calc(var(--header-h) + 16px)' }} aria-label={d.cart.summary}>
          <div className="fk-recap-card">
            <picture className="fk-recap-house" aria-hidden="true">
              <source type="image/webp" srcSet={`${asset('/images/art/recap-maison-400.webp')} 400w, ${asset('/images/art/recap-maison-800.webp')} 800w`} sizes="240px" />
              <img src={asset('/images/art/recap-maison.png')} alt="" width={240} height={73} loading="lazy" decoding="async" />
            </picture>
            <h2 className="relative flex items-center gap-3 font-display text-2xl font-extrabold">
              <IcoClipboard />
              {d.cart.summary}
            </h2>

            {failed ? (
              <ErrorBox message={d.common.error} retry={load} retryLabel={d.common.retry} />
            ) : !zone || !settings ? (
              <div className="mt-5 flex flex-col gap-2">
                <Skeleton className="h-10" />
                <Skeleton className="h-16" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                <p className="flex items-center gap-2.5 rounded-md bg-cream px-3.5 py-3 text-[15px] text-ink">
                  <IcoPinSmall size={20} className="shrink-0 text-prairie" />
                  <span className="min-w-0 flex-1 truncate">{d.cart.zone(L(zone.name, lang))}</span>
                  <a href={href(lang, routes.checkout)} className="text-sm font-bold underline underline-offset-2 hover:text-prairie-deep">
                    {d.common.edit}
                  </a>
                </p>
                {freeFrom > 0 &&
                  (freeReached ? (
                    <p className="fk-free" aria-live="polite">
                      <IcoTruck size={28} className="shrink-0 text-prairie-deep" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-lg font-extrabold leading-tight text-prairie-deep">{d.cart.freeReached}</span>
                        <span className="text-xs text-ink-2">{d.cart.freeSavedLong(formatPrice(zone.fee, lang))}</span>
                      </span>
                      <span className="fk-free-check" aria-hidden="true">
                        <IcoCheck size={16} />
                      </span>
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-md bg-yolk-soft px-3.5 py-3">
                      <FreeShipBar percent={progress} reached={false} label={d.cart.progressLabel} />
                      <p className="text-sm font-semibold text-yolk-deep" aria-live="polite">
                        {d.cart.freeMissing(formatPrice(roundMillimes(freeFrom - subtotal), lang))}
                      </p>
                    </div>
                  ))}
              </div>
            )}

            <dl className="mt-5 flex flex-col gap-2.5 text-[15px]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">{d.cart.subtotalItems(lines.length)}</dt>
                <dd className="font-bold tabular">
                  <Money value={formatPrice(subtotal, lang)} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">{d.common.delivery}</dt>
                <dd className="font-bold tabular">
                  {fee == null ? (
                    '…'
                  ) : fee === 0 && zone && zone.fee > 0 ? (
                    <>
                      <span className="me-2 font-medium text-ink-3 line-through">{formatPrice(zone.fee, lang)}</span>
                      <span className="text-prairie">{d.cart.freeLabel}</span>
                    </>
                  ) : fee === 0 ? (
                    <span className="text-prairie">{d.cart.freeLabel}</span>
                  ) : (
                    formatPrice(fee, lang)
                  )}
                </dd>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-4">
                <dt className="font-display text-lg font-extrabold">{hasEstimated ? d.cart.estimatedTotal : d.common.total}</dt>
                <dd className="font-display text-3xl font-extrabold tabular">
                  <Money value={formatPrice(total, lang)} />
                </dd>
              </div>
            </dl>
            {hasEstimated && <p className="mt-2 text-xs text-ink-3">{d.cart.estimateNote}</p>}

            <div ref={ctaRef} className="mt-5 flex flex-col gap-4">
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
                <a href={href(lang, routes.checkout)} className={`btn-primary btn-lg w-full gap-3 text-lg ${!settings ? 'pointer-events-none opacity-60' : ''}`} aria-disabled={!settings || undefined}>
                  {d.cart.checkout}
                  <svg className="rtl:-scale-x-100" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
              )}
              <ul className="grid grid-cols-2 divide-x divide-line text-start">
                <li className="flex items-center gap-2.5 pe-3">
                  <IcoCash size={30} className="shrink-0 text-prairie-deep" />
                  <span>
                    <span className="block text-sm font-bold leading-tight">{d.cart.codTitle}</span>
                    <span className="text-xs text-ink-3">{d.cart.codText}</span>
                  </span>
                </li>
                <li className="flex items-center gap-2.5 ps-4">
                  <IcoShield size={30} className="shrink-0 text-prairie-deep" />
                  <span>
                    <span className="block text-sm font-bold leading-tight">{d.cart.secureTitle}</span>
                    <span className="text-xs text-ink-3">{d.cart.secureText}</span>
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pe-24 sm:pe-32">
              {lang === 'fr' ? (
                <picture className="block w-44 -rotate-3 sm:w-52">
                  <source type="image/webp" srcSet={`${asset('/images/art/footer-oeufs-heureux-400.webp')} 400w, ${asset('/images/art/footer-oeufs-heureux-800.webp')} 800w`} sizes="208px" />
                  <img src={asset('/images/art/footer-oeufs-heureux.png')} alt={d.cart.happyAlt} width={208} height={78} loading="lazy" decoding="async" />
                </picture>
              ) : (
                <p className="font-display text-lg font-bold">{d.cart.happyAlt}</p>
              )}
            </div>
          </div>
          <picture className="fk-recap-eggs" aria-hidden="true">
            <source type="image/webp" srcSet={`${asset('/images/art/panier-oeufs-olives-400.webp')} 400w, ${asset('/images/art/panier-oeufs-olives-800.webp')} 800w`} sizes="260px" />
            <img src={asset('/images/art/panier-oeufs-olives.png')} alt="" width={260} height={214} loading="lazy" decoding="async" />
          </picture>
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

/** Le slug de la catégorie d'un produit, pour choisir ses deux pastilles. */
function categorySlug(p: Product): string {
  return CATEGORY_SLUGS[p.category_id] ?? p.category_id;
}
const CATEGORY_SLUGS: Record<string, string> = {
  'cat-volailles': 'volailles-entieres',
  'cat-decoupes': 'decoupes',
  'cat-dinde': 'dinde',
  'cat-oeufs': 'oeufs',
  'cat-charcuterie': 'charcuterie',
  'cat-marines': 'marines',
};

/* ------------------------------------------------------------------ */
/* Titre : le panier vert, « Votre panier », le nombre d'articles       */
/* ------------------------------------------------------------------ */

function Title({ d, count }: { d: Dictionary; count: number }) {
  return (
    <div className="flex items-center gap-4">
      <svg className="h-14 w-14 shrink-0 text-prairie sm:h-16 sm:w-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10h18l-1.6 9.2a1.5 1.5 0 0 1-1.5 1.3H6.1a1.5 1.5 0 0 1-1.5-1.3z" />
        <path d="M8 10 11 4M16 10l-3-6M9 14v3M12 14v3M15 14v3" />
      </svg>
      <div>
        <h1 className="font-display text-4xl font-extrabold leading-none sm:text-5xl">{d.cart.title}</h1>
        <p className="mt-2 text-[15px] text-ink-3">{d.cart.countIn(count)}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Heure limite : « Heure limite aujourd'hui : 18 h »                  */
/* ------------------------------------------------------------------ */

function Cutoff({ lang, d, settings, zone }: { lang: Lang; d: Dictionary; settings: Settings; zone: DeliveryZone }) {
  const now = useNow();
  const { past, minutes } = cutoffLeft(settings.cutoff_time, now);
  const dates = allowedDeliveryDates({ now, maxDaysAhead: settings.max_days_ahead, cutoffTime: settings.cutoff_time, closedDays: settings.closed_days, leadDays: zone.lead_days });
  const first = dates[0];
  if (!first) return null;
  const urgent = !past && minutes <= 120;
  const [h, m] = settings.cutoff_time.split(':');
  const hour = lang === 'fr' ? `${Number(h)} h${m && m !== '00' ? ` ${m}` : ''}` : `${Number(h)}:${m ?? '00'}`;
  return (
    <p className={`fk-cutoff ${urgent ? 'is-urgent' : ''} ${past ? 'is-past' : ''}`}>
      <IcoClock className="fk-cutoff-ico" size={26} />
      <span>
        <span className="block text-[15px] font-extrabold leading-tight text-ink">{past ? d.cart.cutoffPastTitle : d.cart.cutoffTitle(hour)}</span>
        <span className="text-xs text-ink-2">{past ? d.cart.cutoffPast(dayWord(first, lang, d)) : urgent ? d.cart.cutoffBefore(formatLeft(minutes, d), dayWord(first, lang, d)) : d.cart.cutoffText(dayWord(first, lang, d))}</span>
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* « Vous oubliez quelque chose ? »                                    */
/* ------------------------------------------------------------------ */

function Suggestions({ lang, d, picks }: { lang: Lang; d: Dictionary; picks: Product[] }) {
  return (
    <section className="fk-forgot" aria-labelledby="suggest-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="suggest-title" className="font-display text-xl font-extrabold sm:text-2xl">
            {d.cart.suggestTitle}
          </h2>
          <p className="text-sm text-ink-3">{d.cart.suggestText}</p>
        </div>
        <a href={href(lang, routes.shop)} className="inline-flex items-center gap-1.5 text-[15px] font-bold text-prairie-deep hover:text-prairie">
          {d.cart.seeShop}
          <svg className="rtl:-scale-x-100" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </div>
      <ul className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-2 xl:grid-cols-4">
        {picks.map((p) => {
          const price = displayPrice(p.pricing, lang);
          return (
            <li key={p.id} className="fk-suggest fk-pop w-60 sm:w-auto">
              <a href={href(lang, routes.product(p.slug))} className="block h-14 w-14 shrink-0 overflow-hidden rounded-md bg-cream" tabIndex={-1} aria-hidden="true">
                <ProductImage src={p.images[0] ?? ''} className="h-full w-full" />
              </a>
              <div className="min-w-0 flex-1">
                <a href={href(lang, routes.product(p.slug))} className="line-clamp-2 text-[13px] font-bold leading-tight">
                  {L(p.name, lang)}
                </a>
                <p className="mt-1 whitespace-nowrap font-display text-sm font-extrabold tabular">
                  {price.amount} <span className="text-xs font-semibold text-ink-3">{price.unit}</span>
                </p>
              </div>
              <button type="button" className="fk-suggest-add is-solid is-compact" onClick={() => addToCart(p)} aria-label={`${d.common.add} · ${L(p.name, lang)}`}>
                <IcoPlus size={20} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pictos propres à la page                                            */
/* ------------------------------------------------------------------ */

function IcoLeaf({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" />
      <path d="M5 19c3-4 6-7 10-9" />
    </svg>
  );
}
function IcoPinSmall({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 22s7-7.1 7-12a7 7 0 0 0-14 0c0 4.9 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
function IcoTrash() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  );
}
function IcoClipboard() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-prairie" aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" />
    </svg>
  );
}
