import { useCallback, useEffect, useState } from 'react';
import type { Lang, OrderStatus, OrderSummaryForCustomer } from '@ferme/core';
import { formatPrice, formatQty, isEstimated } from '@ferme/core';
import { data } from '@/lib/data';
import { href, routes } from '@/lib/paths';
import { replaceCart } from '@/stores/cart';
import { t, L, formatDate, formatDateTime, formatHour } from '@/i18n';
import { ErrorBox, Notice, ProductImage, Skeleton, TextField, isoToday } from './shared';
import { IcoTruck, Money } from './tunnel';

interface Props {
  lang: Lang;
}

const MAIN: OrderStatus[] = ['nouvelle', 'confirmee', 'en_preparation', 'en_livraison', 'livree'];

/** Suivi sans compte : numéro + code, frise des statuts, « Commander à nouveau ». */
export default function TrackingPage({ lang }: Props) {
  const d = t(lang);
  const [number, setNumber] = useState('');
  const [token, setToken] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'error'>('idle');
  const [order, setOrder] = useState<OrderSummaryForCustomer | null>(null);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    const n = (u.get('n') ?? '').trim();
    const tk = (u.get('t') ?? '').trim();
    if (n) setNumber(n);
    if (tk) setToken(tk);
    if (n && tk) setAuto(true);
  }, []);

  const search = useCallback(
    (n: string, tk: string) => {
      if (!n.trim() || !tk.trim()) return;
      setState('loading');
      data()
        .getOrderByToken(n.trim(), tk.trim())
        .then((o) => {
          setOrder(o);
          setState(o ? 'found' : 'notfound');
        })
        .catch(() => setState('error'));
    },
    [],
  );

  useEffect(() => {
    if (auto) {
      setAuto(false);
      search(number, token);
    }
  }, [auto, number, token, search]);

  const submit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    search(number, token);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <form onSubmit={submit} noValidate className="card flex flex-col gap-4 p-5 sm:p-6">
        <TextField id="track-number" label={d.tracking.number} value={number} onChange={setNumber} placeholder={d.tracking.numberPh} autoComplete="off" dir="ltr" required />
        <TextField id="track-token" label={d.tracking.token} value={token} onChange={setToken} help={d.tracking.tokenHelp} autoComplete="off" dir="ltr" required />
        <button type="submit" className="btn-primary btn-lg" disabled={state === 'loading' || !number.trim() || !token.trim()} aria-busy={state === 'loading' || undefined}>
          {state === 'loading' ? d.tracking.searching : d.tracking.find}
        </button>
      </form>

      {state === 'loading' && (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-64" />
        </div>
      )}
      {state === 'notfound' && (
        <p className="rounded-md bg-yolk-soft px-4 py-3 text-sm font-semibold text-yolk-deep" role="alert">
          {d.tracking.notFound}
        </p>
      )}
      {state === 'error' && <ErrorBox message={d.common.error} retry={() => search(number, token)} retryLabel={d.common.retry} />}
      {state === 'found' && order && <OrderResult order={order} lang={lang} />}
    </div>
  );
}

export function OrderResult({ order, lang }: { order: OrderSummaryForCustomer; lang: Lang }) {
  const d = t(lang);
  const [reordered, setReordered] = useState(false);
  const [busy, setBusy] = useState(false);
  const est = order.items.some((i) => isEstimated(i.pricing));
  const terminalOff = order.status === 'annulee' || order.status === 'refusee';
  const idx = MAIN.indexOf(order.status);
  const reached = new Set(order.history.map((h) => h.status));
  const at = (s: OrderStatus) => [...order.history].reverse().find((h) => h.status === s)?.at;

  const steps: { status: OrderStatus; state: 'done' | 'current' | 'todo' | 'off' }[] = MAIN.map((s, i) => {
    if (terminalOff) return { status: s, state: reached.has(s) ? 'done' : 'todo' };
    return { status: s, state: i < idx ? 'done' : i === idx ? 'current' : 'todo' };
  });
  const visible = terminalOff ? [...steps.filter((s) => s.state === 'done'), { status: order.status, state: 'off' as const }] : steps;
  const dayChip = order.delivery_date === isoToday() ? d.tracking.today : order.delivery_date === isoToday(1) ? d.tracking.tomorrow : null;

  const reorder = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const products = await Promise.all(order.items.map((it) => data().getProduct(it.slug)));
      const lines = order.items
        .map((it, i) => ({ it, p: products[i] }))
        .filter((x) => x.p && x.p.stock !== 'rupture')
        .map(({ it, p }) => ({ product_id: p!.id, slug: p!.slug, name: p!.name, image: p!.images[0] ?? '', pricing: p!.pricing, qty: it.qty }));
      replaceCart(lines);
      setReordered(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="status-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="status-title" className="text-xl font-extrabold">
            {d.tracking.status}
          </h2>
          <p className="text-sm text-ink-3" dir="ltr">
            {order.number}
          </p>
        </div>
        <p className="text-sm text-ink-3">{d.tracking.orderedOn(formatDateTime(order.created_at, lang))}</p>
        {!terminalOff && idx >= 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold text-prairie-deep">{d.tracking.stepOf(idx + 1, MAIN.length)}</p>
            <div className="fk-steps-track" role="progressbar" aria-valuemin={1} aria-valuemax={MAIN.length} aria-valuenow={idx + 1}>
              <span style={{ width: `${((idx + 1) / MAIN.length) * 100}%` }} />
            </div>
          </div>
        )}
        <ol className="timeline fk-timeline flex flex-col gap-5">
          {visible.map((s) => {
            const when = at(s.status);
            const current = s.state === 'current' || s.state === 'off';
            return (
              <li key={s.status} className="relative">
                <span className={`timeline-dot ${s.state === 'done' ? 'is-done' : s.state === 'current' ? 'is-current fk-breath' : s.state === 'off' ? 'is-off' : ''}`} aria-hidden="true">
                  {s.state === 'done' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full p-1">
                      <path d="M5 12.5 10 17.5 19 7" />
                    </svg>
                  )}
                </span>
                <p className={`font-bold ${s.state === 'todo' ? 'text-ink-3' : ''}`} aria-current={current ? 'step' : undefined}>
                  {d.tracking.statuses[s.status]}
                  {current && <span className="sr-only"> ({d.tracking.current})</span>}
                </p>
                {current && <p className="text-sm text-ink-2">{d.tracking.statusHelp[s.status]}</p>}
                {when && <p className="text-xs text-ink-3">{formatDateTime(when, lang)}</p>}
              </li>
            );
          })}
        </ol>
        <div className="flex items-start gap-3 rounded-md bg-cream p-4 text-sm">
          <IcoTruck size={22} className="mt-0.5 shrink-0 text-prairie" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{d.tracking.etaTitle}</span>
              {dayChip && <span className="chip chip-best">{dayChip}</span>}
            </p>
            <p className="first-letter:uppercase">
              {formatDate(order.delivery_date, lang)}, {L(order.slot.label, lang)}
            </p>
            <p className="font-semibold text-prairie-deep">{d.tracking.eta(d.tracking.between(formatHour(order.slot.from, lang), formatHour(order.slot.to, lang)))}</p>
            <p className="mt-1 text-ink-2">
              {order.address.street}, {order.address.city} · {L(order.address.zone_name, lang)}
            </p>
          </div>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="items-title">
        <h2 id="items-title" className="text-xl font-extrabold">
          {d.tracking.items}
        </h2>
        <ul className="flex flex-col gap-3">
          {order.items.map((it, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-cream">
                <ProductImage src={it.image} className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{L(it.name, lang)}</p>
                <p className="text-xs text-ink-3">{formatQty(it.pricing, it.qty, lang)}</p>
              </div>
              <p className="text-sm font-semibold tabular">
                {isEstimated(it.pricing) && <span className="me-1 text-ink-3">≈</span>}
                {formatPrice(it.line_total, lang)}
              </p>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">{d.common.subtotal}</dt>
            <dd className="font-semibold tabular">{formatPrice(order.subtotal, lang)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">{d.common.delivery}</dt>
            <dd className="font-semibold tabular">{order.delivery_fee === 0 ? d.common.free : formatPrice(order.delivery_fee, lang)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
            <dt className="font-bold">{est ? d.tracking.estimatedTotal : d.common.total}</dt>
            <dd className="font-display text-xl font-extrabold tabular">
              <Money value={formatPrice(order.total, lang)} />
            </dd>
          </div>
          {order.final_total != null && (
            <div className="fk-pop flex flex-wrap items-baseline justify-between gap-x-3 rounded-md bg-prairie-soft px-3 py-2 text-base text-prairie-deep">
              <dt className="font-bold">{d.tracking.finalTotal}</dt>
              <dd className="font-display text-xl font-extrabold tabular">
                <Money value={formatPrice(order.final_total, lang)} />
              </dd>
              <dd className="w-full text-xs font-medium opacity-80">{d.tracking.finalNote}</dd>
            </div>
          )}
        </dl>
        {reordered ? (
          <div className="flex flex-col items-start gap-3">
            <Notice>{d.account.reordered}</Notice>
            <a href={href(lang, routes.cart)} className="btn-primary">
              {d.shop.goToCart}
            </a>
          </div>
        ) : (
          <button type="button" onClick={reorder} className="btn-yolk btn-lg" disabled={busy} aria-busy={busy || undefined}>
            {busy ? d.common.loading : d.tracking.reorder}
          </button>
        )}
      </section>
    </div>
  );
}
