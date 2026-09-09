import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Lang, OrderSummaryForCustomer } from '@ferme/core';
import { brand, fieldErrors, formatPrice, formatQty, isEstimated, registerSchema } from '@ferme/core';
import { auth, data } from '@/lib/data';
import { href, routes, whatsappLink } from '@/lib/paths';
import { t, L, formatDate, formatHour } from '@/i18n';
import { ErrorBox, Notice, ProductImage, Skeleton, TextField, errorMessage, isoToday, localPhone, reducedMotion, useUser } from './shared';
import { DecoArt, IcoBookmark, IcoCalendar, IcoChat, IcoPhone, IcoTruck, buildIcs, downloadIcs } from './tunnel';
import type { Dictionary } from '@/i18n/fr';

interface Props {
  lang: Lang;
}

const COLORS = ['#f2a900', '#1e7a3c', '#c8442b', '#e6f1fb', '#fff1cc'];

/** Page de confirmation : succès animé, récapitulatif, lien de suivi, création de compte. */
export default function ConfirmationPage({ lang }: Props) {
  const d = t(lang);
  const [params, setParams] = useState<{ n: string; t: string } | null>(null);
  const [order, setOrder] = useState<OrderSummaryForCustomer | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user } = useUser();

  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    setParams({ n: (u.get('n') ?? '').trim(), t: (u.get('t') ?? '').trim() });
  }, []);

  const load = useCallback(() => {
    if (!params) return;
    if (!params.n || !params.t) {
      setOrder(null);
      return;
    }
    setFailed(false);
    setOrder(undefined);
    data()
      .getOrderByToken(params.n, params.t)
      .then(setOrder)
      .catch(() => setFailed(true));
  }, [params]);
  useEffect(load, [load]);

  const trackingUrl = useMemo(() => {
    if (!params || typeof window === 'undefined') return '';
    return `${window.location.origin}${href(lang, routes.tracking)}?n=${encodeURIComponent(params.n)}&t=${encodeURIComponent(params.t)}`;
  }, [params, lang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
    } catch {
      const el = document.createElement('textarea');
      el.value = trackingUrl;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
      } catch {
        /* rien */
      }
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const share = () => {
    navigator.share({ title: `${d.meta.siteName} · ${params?.n ?? ''}`, url: trackingUrl }).catch(() => {});
  };

  if (!params || (order === undefined && !failed)) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
        <Skeleton className="h-24 w-24 rounded-pill" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBox message={d.common.error} retry={load} retryLabel={d.common.retry} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="card mx-auto flex max-w-2xl flex-col items-start gap-4 p-6" role="status">
        <p className="font-bold">{d.confirmation.notFound}</p>
        <a href={href(lang, routes.tracking)} className="btn-ghost">
          {d.confirmation.track}
        </a>
      </div>
    );
  }

  const firstName = order.customer.name.split(' ')[0] ?? order.customer.name;
  const wa = whatsappLink(brand.whatsapp, d.confirmation.whatsappText(order.number));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <SuccessHeader title={d.confirmation.title} text={d.confirmation.text(firstName)} />

      <section className="card flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="num-title">
        <p id="num-title" className="eyebrow">
          {d.confirmation.number}
        </p>
        <p className="font-display text-3xl font-extrabold tracking-tight tabular" dir="ltr">
          {order.number}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">
            <span className="font-semibold">{d.tracking.deliveryOn} :</span> {formatDate(order.delivery_date, lang)}, {L(order.slot.label, lang).toLowerCase()} ({formatHour(order.slot.from, lang)} · {formatHour(order.slot.to, lang)})
          </p>
          <CalendarButton order={order} lang={lang} url={trackingUrl} />
        </div>
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="text-sm font-semibold">{d.confirmation.linkLabel}</p>
          <a href={trackingUrl} className="break-all text-sm text-prairie underline" dir="ltr">
            {trackingUrl}
          </a>
          <p className="flex items-start gap-2.5 rounded-md bg-yolk-soft px-3 py-2.5 text-xs font-semibold text-yolk-deep">
            <IcoBookmark size={16} className="mt-px shrink-0" />
            {d.confirmation.trackHelp}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="btn-ghost btn-sm" aria-live="polite">
              {copied ? d.confirmation.copied : d.confirmation.copy}
            </button>
            {canShare && (
              <button type="button" onClick={share} className="btn-ghost btn-sm">
                {d.confirmation.share}
              </button>
            )}
            <a href={`${href(lang, routes.tracking)}?n=${encodeURIComponent(order.number)}&t=${encodeURIComponent(params.t)}`} className="btn-soft btn-sm">
              {d.confirmation.track}
            </a>
          </div>
        </div>
      </section>

      <NextSteps order={order} lang={lang} d={d} />

      <section className="card flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="recap-title">
        <h2 id="recap-title" className="text-xl font-extrabold">
          {d.confirmation.yourOrder}
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
        <Totals order={order} lang={lang} />
        <p className="rounded-md bg-prairie-soft px-4 py-3 text-sm font-semibold text-prairie-deep">{d.common.cod}</p>
      </section>

      {!user && <RegisterBlock lang={lang} order={order} />}

      <div className="flex flex-col gap-3 sm:flex-row">
        <a href={wa} className="btn-primary btn-lg flex-1" target="_blank" rel="noopener">
          <IcoChat size={20} /> {d.confirmation.whatsappUs}
        </a>
        <a href={href(lang)} className="btn-ghost btn-lg flex-1">
          {d.confirmation.backHome}
        </a>
      </div>
    </div>
  );
}

/** Ce qui se passe ensuite, en trois temps, avec une heure indicative. */
function NextSteps({ order, lang, d }: { order: OrderSummaryForCustomer; lang: Lang; d: Dictionary }) {
  const late = new Date().getHours() >= 18;
  const steps = [
    { ico: <IcoPhone size={20} />, title: d.confirmation.next1, text: d.confirmation.next1Text, when: late ? d.confirmation.next1WhenLate : d.confirmation.next1When },
    { ico: <DecoArt type="plume" className="h-6 w-6" />, title: d.confirmation.next2, text: d.confirmation.next2Text, when: d.confirmation.next2When },
    { ico: <IcoTruck size={20} />, title: d.confirmation.next3, text: d.confirmation.next3Text, when: d.tracking.between(formatHour(order.slot.from, lang), formatHour(order.slot.to, lang)) },
  ];
  return (
    <section className="card flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="next-title">
      <h2 id="next-title" className="text-xl font-extrabold">
        {d.confirmation.nextTitle}
      </h2>
      <ol className="flex flex-col gap-5">
        {steps.map((s, i) => (
          <li key={i} className="fk-next">
            <span className="fk-next-ico" aria-hidden="true">
              {s.ico}
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-bold">{s.title}</p>
              <p className="text-xs font-semibold text-prairie-deep">{s.when}</p>
            </div>
            <p className="mt-0.5 text-sm text-ink-2">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Fichier .ics fabriqué dans le navigateur : rien ne part au serveur. */
function CalendarButton({ order, lang, url }: { order: OrderSummaryForCustomer; lang: Lang; url: string }) {
  const d = t(lang);
  const add = () => {
    const ics = buildIcs({
      uid: order.number,
      date: order.delivery_date,
      from: order.slot.from,
      to: order.slot.to,
      summary: d.confirmation.calendarSummary(order.number),
      description: d.confirmation.calendarDesc(url),
      location: `${order.address.street}, ${order.address.city}`,
    });
    downloadIcs(ics, `${order.number}.ics`);
  };
  if (order.delivery_date < isoToday()) return null;
  return (
    <span className="flex flex-col items-start gap-1">
      <button type="button" onClick={add} className="btn-ghost btn-sm">
        <IcoCalendar size={18} />
        {d.confirmation.addToCalendar}
      </button>
      <span className="text-[11px] text-ink-3">{d.confirmation.calendarHelp}</span>
    </span>
  );
}

function Totals({ order, lang }: { order: OrderSummaryForCustomer; lang: Lang }) {
  const d = t(lang);
  const est = order.items.some((i) => isEstimated(i.pricing));
  return (
    <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-ink-2">{d.common.subtotal}</dt>
        <dd className="font-semibold tabular">{formatPrice(order.subtotal, lang)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-ink-2">
          {d.common.delivery} · {L(order.address.zone_name, lang)}
        </dt>
        <dd className="font-semibold tabular">{order.delivery_fee === 0 ? d.common.free : formatPrice(order.delivery_fee, lang)}</dd>
      </div>
      <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
        <dt className="font-bold">{est ? d.tracking.estimatedTotal : d.common.total}</dt>
        <dd className="font-display text-xl font-extrabold tabular">{formatPrice(order.total, lang)}</dd>
      </div>
      {est && <p className="text-xs text-ink-3">{d.common.weightNote}</p>}
    </dl>
  );
}

function SuccessHeader({ title, text }: { title: string; text: string }) {
  const pieces = useMemo(() => {
    if (reducedMotion()) return [];
    return Array.from({ length: 22 }, (_, i) => ({
      left: `${(i * 37) % 100}%`,
      color: COLORS[i % COLORS.length]!,
      delay: `${(i * 53) % 400}ms`,
      x: `${((i * 29) % 80) - 40}px`,
      y: `${180 + ((i * 17) % 120)}px`,
      r: `${360 + ((i * 97) % 540)}deg`,
    }));
  }, []);
  return (
    <div className="relative flex flex-col items-center gap-3 overflow-hidden pt-4 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72" aria-hidden="true">
        {pieces.map((p, i) => (
          <span key={i} className="confetti" style={{ left: p.left, background: p.color, '--confetti-delay': p.delay, '--confetti-x': p.x, '--confetti-y': p.y, '--confetti-r': p.r } as React.CSSProperties} />
        ))}
      </div>
      <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true" className="animate-pop">
        <circle cx="48" cy="48" r="40" stroke="var(--color-prairie)" strokeWidth="5" className="check-ring" strokeLinecap="round" />
        <path d="M30 49 43 62 67 36" stroke="var(--color-prairie)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="check-mark" />
      </svg>
      <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
      <p className="text-lg text-ink-2">{text}</p>
    </div>
  );
}

function RegisterBlock({ lang, order }: { lang: Lang; order: OrderSummaryForCustomer }) {
  const d = t(lang);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const parsed = registerSchema.safeParse({ name: order.customer.name, phone: order.customer.phone, email: '', password });
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setError(errorMessage(d, errs.password ?? errs.phone ?? errs.name));
      return;
    }
    setBusy(true);
    try {
      await auth().register(parsed.data);
      const { zone_id, street, city, landmark } = order.address;
      await auth()
        .updateProfile({ default_address: { zone_id, street, city, landmark } })
        .catch(() => {});
      setDone(true);
    } catch (err) {
      setError(errorMessage(d, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card flex flex-col gap-4 bg-cream p-5 sm:p-6" aria-labelledby="reg-title">
      <h2 id="reg-title" className="text-xl font-extrabold">
        {d.confirmation.createAccount}
      </h2>
      <p className="text-sm text-ink-2">{d.confirmation.createAccountText}</p>
      {done ? (
        <div className="flex flex-col items-start gap-3">
          <Notice>{d.confirmation.accountCreated}</Notice>
          <a href={href(lang, routes.account)} className="btn-primary">
            {d.confirmation.goToAccount}
          </a>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="reg-name" label={d.account.name} value={order.customer.name} onChange={() => {}} autoComplete="name" />
            <TextField id="reg-phone" label={d.account.phone} value={localPhone(order.customer.phone)} onChange={() => {}} prefix="+216" dir="ltr" autoComplete="tel-national" />
          </div>
          <TextField id="reg-password" label={d.account.password} value={password} onChange={setPassword} type="password" autoComplete="new-password" help={d.account.passwordHelp} error={error ?? undefined} required />
          <button type="submit" className="btn-yolk self-start" disabled={busy} aria-busy={busy || undefined}>
            {busy ? d.common.loading : d.common.save}
          </button>
          {error === d.account.errors.phone_taken && (
            <a href={href(lang, routes.account)} className="text-sm font-bold text-prairie underline">
              {d.account.login}
            </a>
          )}
        </form>
      )}
    </section>
  );
}
