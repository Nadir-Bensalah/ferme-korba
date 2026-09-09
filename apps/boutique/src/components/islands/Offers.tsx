import { useEffect, useRef, useState } from 'react';
import type { Lang, Offer, Product } from '@ferme/core';
import { formatPrice, seedProducts } from '@ferme/core';
import { data } from '@/lib/data';
import { addToCart } from '@/stores/cart';
import { t, L } from '@/i18n';
import { asset, href } from '@/lib/paths';
import type { Dictionary } from '@/i18n/fr';
import { reducedMotion, whenIdle } from './shared';

interface Props {
  lang: Lang;
  /** Offres actives du jeu de données, dans l'ordre : c'est ce que le HTML construit affiche. */
  offers: Offer[];
  /** Heure limite de commande (« 18:00 ») du jeu de données, corrigée à l'exécution. */
  cutoff: string;
}

/**
 * Bande des offres : construite à la génération avec le jeu de données, puis
 * relue à l'exécution (offres et heure limite). Trois cartes : offre du jour
 * avec compte à rebours, pack combiné, spécial saison. Sur téléphone, la bande
 * défile à l'horizontale avec accroche ; à partir de 768 px, c'est une grille.
 */
export default function Offers({ lang, offers: initial, cutoff: initialCutoff }: Props) {
  const d = t(lang);
  const [offers, setOffers] = useState<Offer[]>(initial);
  const [cutoff, setCutoff] = useState(initialCutoff);
  const [active, setActive] = useState(0);
  const track = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let alive = true;
    const cancel = whenIdle(() => {
      data()
        .listOffers()
        .then((rows) => {
          if (alive) setOffers(rows.filter((o) => o.active).sort((a, b) => a.sort - b.sort));
        })
        .catch(() => {
          /* la version construite reste affichée */
        });
      data()
        .getSettings()
        .then((s) => {
          if (alive && /^\d{1,2}:\d{2}$/.test(s.cutoff_time)) setCutoff(s.cutoff_time);
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
      cancel();
    };
  }, []);

  // Plus aucune offre après relecture : on efface aussi le titre posé par OffersStrip.astro.
  useEffect(() => {
    const wrap = track.current?.closest<HTMLElement>('[data-offers-strip]') ?? document.querySelector<HTMLElement>('[data-offers-strip]');
    if (wrap) wrap.hidden = offers.length === 0;
  }, [offers.length]);

  // Points sous la bande : la carte la plus proche du bord de départ.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const rtl = getComputedStyle(el).direction === 'rtl';
        let best = 0;
        let dist = Infinity;
        Array.from(el.children).forEach((c, i) => {
          const b = c.getBoundingClientRect();
          const dd = Math.abs(rtl ? r.right - b.right : b.left - r.left);
          if (dd < dist) {
            dist = dd;
            best = i;
          }
        });
        setActive(best);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [offers.length]);

  if (!offers.length) return null;

  return (
    <div>
      <ul
        ref={track}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-ps-4 px-4 pb-2 scrollbar-none sm:-mx-6 sm:scroll-ps-6 sm:px-6 md:mx-0 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3"
        aria-label={d.offers.list}
      >
        {offers.map((o, i) => (
          <li key={o.id} className="flex w-[86%] shrink-0 snap-start md:w-auto md:shrink" aria-label={d.offers.slide(i + 1, offers.length)}>
            <OfferCard offer={o} lang={lang} d={d} cutoff={cutoff} eager={i === 0} />
          </li>
        ))}
      </ul>
      {offers.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5 md:hidden" aria-hidden="true">
          {offers.map((o, i) => (
            <span key={o.id} className={`h-1.5 rounded-pill transition-[width,background-color] duration-300 ${i === active ? 'w-5 bg-prairie' : 'w-1.5 bg-ink/20'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

const TONES = {
  deal: { bg: 'bg-linear-to-br from-moss to-paper', eyebrow: 'text-prairie', badge: 'bg-prairie-soft text-prairie-deep' },
  combo: { bg: 'bg-linear-to-br from-cream-2 to-paper', eyebrow: 'text-yolk-deep', badge: 'bg-yolk-soft text-yolk-deep' },
  season: { bg: 'bg-linear-to-br from-cream-2 to-paper', eyebrow: 'text-prairie', badge: 'bg-prairie-soft text-prairie-deep' },
} as const;

function OfferCard({ offer: o, lang, d, cutoff, eager }: { offer: Offer; lang: Lang; d: Dictionary; cutoff: string; eager: boolean }) {
  const tone = TONES[o.kind] ?? TONES.season;
  const url = href(lang, o.link || '/produits');
  const badge = L(o.badge, lang);
  const price = typeof o.price === 'number' ? o.price : null;
  const compare = typeof o.compare_at === 'number' && price !== null && o.compare_at > price ? o.compare_at : null;
  return (
    <article className={`relative isolate flex min-h-60 w-full overflow-hidden rounded-xl shadow-card ${tone.bg}`}>
      <a href={url} className="absolute inset-0 z-[1] rounded-xl" tabIndex={-1} aria-hidden="true" />
      <div className="flex w-[62%] flex-col items-start gap-2 p-5 sm:w-[60%] sm:p-6">
        <p className={`text-[11px] font-extrabold uppercase tracking-wide ${tone.eyebrow}`}>{L(o.eyebrow, lang)}</p>
        {o.kind === 'deal' && <Countdown endsAt={o.ends_at ?? null} cutoff={cutoff} d={d} />}
        <h3 className="font-display text-xl font-extrabold leading-[1.1] text-ink sm:text-2xl">
          <a href={url} className="rounded-sm">
            {L(o.title, lang)}
          </a>
        </h3>
        <p className="text-sm leading-snug text-ink-3">{L(o.subtitle, lang)}</p>
        {badge && <span className={`chip ${tone.badge}`}>{badge}</span>}
        {price !== null && (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-2xl font-extrabold text-ink tabular sm:text-[1.75rem]">{formatPrice(price, lang)}</span>
            {compare !== null && <s className="text-sm font-semibold text-ink-3 tabular">{formatPrice(compare, lang)}</s>}
          </p>
        )}
        <div className="relative z-[2] mt-auto pt-3">
          <Cta offer={o} lang={lang} d={d} url={url} />
        </div>
      </div>
      <div className="pointer-events-none absolute top-1/2 end-0 z-0 w-[50%] -translate-y-1/2 ltr:translate-x-[18%] rtl:-translate-x-[18%]" aria-hidden="true">
        <OfferPicture src={o.image} eager={eager} className="aspect-square w-full rounded-pill object-cover shadow-float" />
      </div>
    </article>
  );
}

/** Photo responsive, même découpage que Picture.astro (WebP 480/960/1600, repli JPEG). */
function OfferPicture({ src, className, eager }: { src: string; className: string; eager: boolean }) {
  const fallback = src || '/images/products/poulet-entier.jpg';
  const local = fallback.startsWith('/images/');
  const stem = fallback.replace(/\.(jpe?g|png|webp)$/i, '');
  const sizes = '(min-width: 1024px) 220px, (min-width: 768px) 28vw, 45vw';
  return (
    <picture className="block">
      {local && <source type="image/webp" srcSet={[480, 960, 1600].map((w) => `${asset(`${stem}-${w}.webp`)} ${w}w`).join(', ')} sizes={sizes} />}
      <img
        src={local ? asset(fallback) : fallback}
        alt=""
        className={className}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        width={800}
        height={800}
        sizes={sizes}
      />
    </picture>
  );
}

type Snapshot = Pick<Product, 'id' | 'slug' | 'name' | 'images' | 'pricing' | 'stock'>;

/** Les produits d'un pack : la base d'abord, le jeu de données en repli. */
async function resolveProducts(slugs: string[]): Promise<Snapshot[]> {
  const rows = await Promise.all(slugs.map((slug) => data().getProduct(slug).catch(() => null)));
  return rows
    .map((p, i) => p ?? seedProducts.find((s) => s.slug === slugs[i]) ?? null)
    .filter((p): p is Product => p !== null);
}

function Cta({ offer: o, lang, d, url }: { offer: Offer; lang: Lang; d: Dictionary; url: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'added'>('idle');
  const pack = o.product_slugs.length > 0;

  useEffect(() => {
    if (state !== 'added') return;
    const id = setTimeout(() => setState('idle'), 1000);
    return () => clearTimeout(id);
  }, [state]);

  const arrow = (
    <svg className="rtl:rotate-180" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );

  if (!pack) {
    return (
      <a href={url} className="btn bg-prairie-deep text-white shadow-card hover:bg-prairie">
        {L(o.cta, lang)}
        {arrow}
      </a>
    );
  }

  const onClick = async () => {
    if (state !== 'idle') return;
    setState('busy');
    try {
      const products = await resolveProducts(o.product_slugs);
      products.forEach((p) => addToCart(p));
      setState(products.length ? 'added' : 'idle');
    } catch {
      setState('idle');
    }
  };

  return (
    <button type="button" onClick={onClick} aria-busy={state === 'busy' || undefined} className={`btn ${state === 'added' ? 'bg-prairie text-white' : 'btn-yolk'}`}>
      {state === 'added' ? (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-pop">
            <path d="M5 12.5 10 17.5 19 7" />
          </svg>
          {d.common.added}
        </>
      ) : (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {L(o.cta, lang)}
        </>
      )}
    </button>
  );
}

/** Instant visé : la fin de l'offre, sinon l'heure limite du jour, sinon celle de demain. */
function targetTime(endsAt: string | null, cutoff: string): number {
  if (endsAt) {
    const ts = Date.parse(endsAt);
    if (Number.isFinite(ts)) return ts;
  }
  const [h, m] = cutoff.split(':').map(Number) as [number, number];
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t.getTime();
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Compte à rebours en quatre cases. Les millisecondes défilent (30 images par
 * seconde), c'est voulu. Arrêté quand l'onglet est caché ; une fois par
 * seconde et sans millisecondes si l'utilisateur réduit les animations.
 */
function Countdown({ endsAt, cutoff, d }: { endsAt: string | null; cutoff: string; d: Dictionary }) {
  const refs = { h: useRef<HTMLSpanElement>(null), m: useRef<HTMLSpanElement>(null), s: useRef<HTMLSpanElement>(null), ms: useRef<HTMLSpanElement>(null) };
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const quiet = reducedMotion();
    setReduced(quiet);
    let target = targetTime(endsAt, cutoff);
    let raf = 0;
    let timer = 0;
    let last = 0;
    const paint = () => {
      let rem = target - Date.now();
      if (rem <= 0) {
        if (!endsAt) target = targetTime(null, cutoff);
        rem = Math.max(0, target - Date.now());
      }
      const h = Math.floor(rem / 3_600_000);
      const m = Math.floor((rem % 3_600_000) / 60_000);
      const s = Math.floor((rem % 60_000) / 1000);
      const ms = Math.floor((rem % 1000) / 10);
      if (refs.h.current) refs.h.current.textContent = pad(h);
      if (refs.m.current) refs.m.current.textContent = pad(m);
      if (refs.s.current) refs.s.current.textContent = pad(s);
      if (refs.ms.current) refs.ms.current.textContent = pad(ms);
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / 30) return;
      last = now;
      paint();
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
    const start = () => {
      stop();
      paint();
      if (quiet) timer = window.setInterval(paint, 1000);
      else raf = requestAnimationFrame(loop);
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, cutoff]);

  const cells: { key: 'h' | 'm' | 's' | 'ms'; label: string }[] = [
    { key: 'h', label: d.offers.hours },
    { key: 'm', label: d.offers.minutes },
    { key: 's', label: d.offers.seconds },
    { key: 'ms', label: d.offers.ms },
  ];

  return (
    <div className="flex gap-1.5" role="timer" aria-live="off" aria-label={d.offers.endsIn}>
      {cells.map((c) => (
        <span key={c.key} className={`flex min-w-10 flex-col items-center rounded-md bg-prairie-soft/80 px-1.5 py-1 leading-none ${c.key === 'ms' && reduced ? 'hidden' : ''}`}>
          <span ref={refs[c.key]} className="font-display text-base font-extrabold text-prairie-deep tabular" dir="ltr">
            --
          </span>
          <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-prairie-deep/70">{c.label}</span>
        </span>
      ))}
    </div>
  );
}
