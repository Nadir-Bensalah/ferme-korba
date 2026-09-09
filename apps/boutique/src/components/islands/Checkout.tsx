import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DeliverySlot, DeliveryZone, Lang, OrderInput, Settings } from '@ferme/core';
import { OrderError, allowedDeliveryDates, deliveryFee, fieldErrors, formatPrice, isEstimated, lineTotal, orderInputSchema, roundMillimes } from '@ferme/core';
import { cartHasEstimated, cartLines, cartSubtotal, clearCart } from '@/stores/cart';
import { data } from '@/lib/data';
import { href, routes } from '@/lib/paths';
import { t, L, formatDate, formatHour } from '@/i18n';
import { ErrorBox, ProductImage, Skeleton, TextField, clearRemembered, isoToday, loadRemembered, localPhone, preferredZoneId, saveRemembered, useMounted, useUser, weekday } from './shared';

interface Props {
  lang: Lang;
}

type FieldKey = 'name' | 'phone' | 'email' | 'zone_id' | 'street' | 'city' | 'landmark' | 'delivery_date' | 'slot_id' | 'notes';

const FIELD_ORDER: FieldKey[] = ['name', 'phone', 'email', 'zone_id', 'street', 'city', 'landmark', 'delivery_date', 'slot_id', 'notes'];

/** Chemin zod de chaque champ du formulaire. */
const PATH: Record<FieldKey, string> = {
  name: 'customer.name',
  phone: 'customer.phone',
  email: 'customer.email',
  zone_id: 'address.zone_id',
  street: 'address.street',
  city: 'address.city',
  landmark: 'address.landmark',
  delivery_date: 'delivery_date',
  slot_id: 'slot_id',
  notes: 'notes',
};

interface Form {
  name: string;
  phone: string;
  email: string;
  zone_id: string;
  street: string;
  city: string;
  landmark: string;
  delivery_date: string;
  slot_id: string;
  notes: string;
  website: string;
  remember: boolean;
}

const NOTES_MAX = 300;

/**
 * Tunnel de commande sur une seule page : Vous, Livraison, Récapitulatif.
 * Les zones, créneaux et réglages sont lus à l'exécution. Le formulaire garde
 * ses valeurs si l'envoi échoue.
 */
export default function Checkout({ lang }: Props) {
  const d = t(lang);
  const mounted = useMounted();
  const lines = useStore(cartLines);
  const subtotal = useStore(cartSubtotal);
  const hasEstimated = useStore(cartHasEstimated);
  const { user } = useUser();

  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [slots, setSlots] = useState<DeliverySlot[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [failed, setFailed] = useState(false);

  const [form, setForm] = useState<Form>({
    name: '',
    phone: '',
    email: '',
    zone_id: '',
    street: '',
    city: '',
    landmark: '',
    delivery_date: '',
    slot_id: '',
    notes: '',
    website: '',
    remember: false,
  });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const done = useRef(false);
  const prefilledUser = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([data().listZones(), data().listSlots(), data().getSettings()])
      .then(([z, s, st]) => {
        setZones(z);
        setSlots(s);
        setSettings(st);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  // Coordonnées mémorisées sur l'appareil.
  useEffect(() => {
    const r = loadRemembered();
    if (!r) return;
    setForm((f) => ({ ...f, ...r, phone: localPhone(r.phone), remember: true }));
  }, []);

  // Client connecté : on préremplit une fois.
  useEffect(() => {
    if (!user || prefilledUser.current) return;
    prefilledUser.current = true;
    const a = user.default_address;
    setForm((f) => ({
      ...f,
      name: user.name || f.name,
      phone: localPhone(user.phone) || f.phone,
      email: user.email ?? f.email,
      zone_id: a?.zone_id || f.zone_id,
      street: a?.street || f.street,
      city: a?.city || f.city,
      landmark: a?.landmark ?? f.landmark,
    }));
  }, [user]);

  // Zone mémorisée depuis le panier.
  useEffect(() => {
    if (!zones) return;
    setForm((f) => {
      if (f.zone_id && zones.some((z) => z.id === f.zone_id)) return f;
      const pref = preferredZoneId.get();
      return zones.some((z) => z.id === pref) ? { ...f, zone_id: pref } : f;
    });
  }, [zones]);

  // Panier vide : retour au panier (sauf juste après une commande réussie).
  useEffect(() => {
    if (!mounted || done.current || lines.length > 0) return;
    const id = setTimeout(() => window.location.replace(href(lang, routes.cart)), 1500);
    return () => clearTimeout(id);
  }, [mounted, lines.length, lang]);

  // Étape courante dans l'ancre de progression.
  useEffect(() => {
    if (!mounted || !('IntersectionObserver' in window)) return;
    const sections = ['vous', 'livraison', 'recap'].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setStep(sections.indexOf(hit.target as HTMLElement));
      },
      { rootMargin: '-40% 0px -50% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [mounted, zones]);

  const zone = zones?.find((z) => z.id === form.zone_id) ?? null;

  const dates = useMemo(() => {
    if (!settings || !zone) return [];
    return allowedDeliveryDates({ maxDaysAhead: settings.max_days_ahead, cutoffTime: settings.cutoff_time, closedDays: settings.closed_days, leadDays: zone.lead_days });
  }, [settings, zone]);

  // La date suit la zone ; le créneau suit la date.
  useEffect(() => {
    setForm((f) => (dates.includes(f.delivery_date) ? f : { ...f, delivery_date: dates[0] ?? '' }));
  }, [dates]);

  const daySlots = useMemo(() => {
    if (!slots || !form.delivery_date) return [];
    const day = weekday(form.delivery_date);
    return slots.filter((s) => s.days.includes(day));
  }, [slots, form.delivery_date]);

  useEffect(() => {
    setForm((f) => (daySlots.some((s) => s.id === f.slot_id) ? f : { ...f, slot_id: daySlots.length === 1 ? daySlots[0]!.id : '' }));
  }, [daySlots]);

  const set = (k: keyof Form) => (v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (typeof v === 'string' && errors[k as FieldKey]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const buildInput = (f: Form): OrderInput => ({
    lang,
    customer: { name: f.name, phone: f.phone, email: f.email },
    address: { zone_id: f.zone_id, street: f.street, city: f.city, landmark: f.landmark },
    delivery_date: f.delivery_date,
    slot_id: f.slot_id,
    items: cartLines.get().map((l) => ({ product_id: l.product_id, qty: l.qty })),
    notes: f.notes,
    customer_user_id: user?.id ?? null,
    website: f.website,
  });

  const msg = (code: string | undefined) => (code ? ((d.checkout.errors as Record<string, string>)[code] ?? d.checkout.errors.generic) : undefined);

  const validateField = (k: FieldKey) => {
    const r = orderInputSchema.safeParse(buildInput(form));
    const errs = r.success ? {} : fieldErrors(r.error);
    setErrors((e) => ({ ...e, [k]: msg(errs[PATH[k]]) }));
  };

  const applyIssues = (errs: Record<string, string>) => {
    const next: Partial<Record<FieldKey, string>> = {};
    for (const k of FIELD_ORDER) next[k] = msg(errs[PATH[k]]);
    setErrors(next);
    const first = FIELD_ORDER.find((k) => next[k]);
    if (first) {
      const el = formRef.current?.querySelector<HTMLElement>(`#${first}, [data-field="${first}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    }
    return Boolean(first);
  };

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (submitting || !settings?.shop_open) return;
    setGlobalError(null);
    const parsed = orderInputSchema.safeParse(buildInput(form));
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      if (errs.website) setGlobalError(d.checkout.errors.bot);
      else if (errs.items) setGlobalError(d.checkout.errors['items.empty']);
      applyIssues(errs);
      if (!errs.website && !errs.items) setGlobalError(d.checkout.errors.invalid);
      return;
    }
    setSubmitting(true);
    try {
      const res = await data().createOrder(parsed.data);
      done.current = true;
      if (form.remember) {
        saveRemembered({ name: form.name, phone: parsed.data.customer.phone, email: form.email, zone_id: form.zone_id, street: form.street, city: form.city, landmark: form.landmark });
      } else clearRemembered();
      preferredZoneId.set(form.zone_id);
      clearCart();
      const url = `${href(lang, routes.confirmation)}?n=${encodeURIComponent(res.number)}&t=${encodeURIComponent(res.tracking_token)}`;
      window.location.assign(url);
    } catch (err) {
      const code = err instanceof OrderError ? err.code : typeof (err as { code?: unknown })?.code === 'string' ? ((err as { code: string }).code as string) : '';
      if (code === 'invalid' && Array.isArray((err as OrderError).details)) {
        const issues = (err as OrderError).details as { path: (string | number)[]; message: string }[];
        const errs: Record<string, string> = {};
        for (const i of issues) {
          const key = i.path.join('.');
          if (!errs[key]) errs[key] = i.message;
        }
        applyIssues(errs);
        setGlobalError(d.checkout.errors.invalid);
      } else {
        setGlobalError(msg(code) ?? d.checkout.errors.generic);
        if (code === 'zone_unknown' || code === 'slot_unknown' || code === 'slot_day' || code === 'date_not_allowed') load();
      }
      setSubmitting(false);
      document.getElementById('checkout-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (!mounted) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="card flex flex-col items-start gap-4 p-6" role="status">
        <p className="font-bold">{d.checkout.emptyCart}</p>
        <a href={href(lang, routes.cart)} className="btn-primary">
          {d.checkout.backToCart}
        </a>
      </div>
    );
  }

  const closed = settings ? !settings.shop_open : false;
  const fee = zone ? deliveryFee(zone, subtotal) : null;
  const total = fee != null ? roundMillimes(subtotal + fee) : subtotal;
  const today = isoToday();
  const tomorrow = isoToday(1);
  const leadLabel = (z: DeliveryZone) => (z.lead_days <= 0 ? d.checkout.leadSame : z.lead_days === 1 ? d.checkout.leadNext : d.checkout.leadDays(z.lead_days));
  const steps = d.checkout.steps;

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="lg:grid lg:grid-cols-[1fr_400px] lg:items-start lg:gap-10">
      <div className="flex flex-col gap-8">
        {/* Ancre de progression */}
        <nav className="sticky z-30 -mx-4 flex gap-1 overflow-x-auto bg-paper/92 px-4 py-2 backdrop-blur-md scrollbar-none sm:mx-0 sm:px-0" style={{ top: 'var(--header-h)' }} aria-label={d.checkout.progress}>
          {(['vous', 'livraison', 'recap'] as const).map((id, i) => (
            <a key={id} href={`#${id}`} className="step-link" aria-current={step === i ? 'step' : undefined}>
              <span className="step-num" aria-hidden="true">
                {i + 1}
              </span>
              {steps[i]}
            </a>
          ))}
        </nav>

        {closed && (
          <div className="rounded-lg bg-yolk-soft p-4 text-sm font-semibold text-yolk-deep" role="alert">
            {d.checkout.closed}
          </div>
        )}

        {/* 1. Vous */}
        <section id="vous" className="card flex scroll-mt-32 flex-col gap-5 p-5 sm:p-6" aria-labelledby="vous-title">
          <h2 id="vous-title" className="text-2xl font-extrabold">
            <span className="me-2 text-prairie">1.</span>
            {d.checkout.you}
          </h2>
          {user && <p className="text-sm text-ink-3">{d.checkout.loggedAs(user.name)}</p>}
          <TextField id="name" label={d.checkout.name} value={form.name} onChange={set('name')} onBlur={() => validateField('name')} error={errors.name} placeholder={d.checkout.namePh} autoComplete="name" required />
          <TextField id="phone" label={d.checkout.phone} value={form.phone} onChange={set('phone')} onBlur={() => validateField('phone')} error={errors.phone} help={d.checkout.phoneHelp} placeholder={d.checkout.phonePh} type="tel" inputMode="tel" autoComplete="tel-national" prefix="+216" dir="ltr" required />
          <TextField id="email" label={d.checkout.email} optionalLabel={d.common.optional} value={form.email} onChange={set('email')} onBlur={() => validateField('email')} error={errors.email} help={d.checkout.emailHelp} type="email" inputMode="email" autoComplete="email" dir="ltr" />
          {/* Champ piège : invisible pour un humain. */}
          <div className="absolute -start-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website')(e.target.value)} />
          </div>
        </section>

        {/* 2. Livraison */}
        <section id="livraison" className="card flex scroll-mt-32 flex-col gap-6 p-5 sm:p-6" aria-labelledby="livraison-title">
          <h2 id="livraison-title" className="text-2xl font-extrabold">
            <span className="me-2 text-prairie">2.</span>
            {d.checkout.address}
          </h2>

          {failed ? (
            <ErrorBox message={d.common.error} retry={load} retryLabel={d.common.retry} />
          ) : !zones || !slots || !settings ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            <>
              <fieldset data-field="zone_id" tabIndex={-1} aria-describedby={errors.zone_id ? 'zone_id-error' : 'zone_id-help'} aria-invalid={errors.zone_id ? true : undefined} className="rounded-md outline-none">
                <legend className="label">{d.checkout.zone}</legend>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={d.checkout.zone}>
                  {zones.map((z) => {
                    const on = form.zone_id === z.id;
                    return (
                      <button
                        key={z.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className="choice"
                        onClick={() => {
                          set('zone_id')(z.id);
                          preferredZoneId.set(z.id);
                        }}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-bold">{L(z.name, lang)}</span>
                          <span className="font-display text-base font-extrabold tabular">{formatPrice(z.fee, lang)}</span>
                        </span>
                        <span className="text-xs text-ink-3">{L(z.areas, lang)}</span>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-prairie-deep">
                          {z.free_from > 0 && <span>{d.checkout.freeFrom(formatPrice(z.free_from, lang))}</span>}
                          <span>{leadLabel(z)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errors.zone_id ? (
                  <p id="zone_id-error" className="error" role="alert">
                    {errors.zone_id}
                  </p>
                ) : (
                  <p id="zone_id-help" className="help">
                    {d.checkout.zoneHelp}
                  </p>
                )}
              </fieldset>

              <TextField id="street" label={d.checkout.street} value={form.street} onChange={set('street')} onBlur={() => validateField('street')} error={errors.street} placeholder={d.checkout.streetPh} autoComplete="street-address" required />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField id="city" label={d.checkout.city} value={form.city} onChange={set('city')} onBlur={() => validateField('city')} error={errors.city} placeholder={d.checkout.cityPh} autoComplete="address-level2" required />
                <TextField id="landmark" label={d.checkout.landmark} optionalLabel={d.common.optional} value={form.landmark} onChange={set('landmark')} onBlur={() => validateField('landmark')} error={errors.landmark} placeholder={d.checkout.landmarkPh} />
              </div>

              <h3 className="text-lg font-extrabold">{d.checkout.when}</h3>
              <fieldset data-field="delivery_date" tabIndex={-1} className="rounded-md outline-none" aria-invalid={errors.delivery_date ? true : undefined} aria-describedby={errors.delivery_date ? 'delivery_date-error' : undefined}>
                <legend className="label">{d.checkout.date}</legend>
                {!zone ? (
                  <p className="help">{d.checkout.chooseZoneFirst}</p>
                ) : dates.length === 0 ? (
                  <p className="help">{d.checkout.noDates}</p>
                ) : (
                  <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup" aria-label={d.checkout.date}>
                    {dates.map((iso) => {
                      const on = form.delivery_date === iso;
                      const main = iso === today ? d.checkout.today : iso === tomorrow ? d.checkout.tomorrow : formatDate(iso, lang, { weekday: 'long' });
                      const sub = formatDate(iso, lang, { day: 'numeric', month: 'short' });
                      return (
                        <button key={iso} type="button" role="radio" aria-checked={on} className="choice-pill flex-col !items-start gap-0 py-2 leading-tight" onClick={() => set('delivery_date')(iso)}>
                          <span className="capitalize">{main}</span>
                          <span className="text-[11px] font-semibold text-ink-3">{sub}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.delivery_date && (
                  <p id="delivery_date-error" className="error" role="alert">
                    {errors.delivery_date}
                  </p>
                )}
              </fieldset>

              <fieldset data-field="slot_id" tabIndex={-1} className="rounded-md outline-none" aria-invalid={errors.slot_id ? true : undefined} aria-describedby={errors.slot_id ? 'slot_id-error' : undefined}>
                <legend className="label">{d.checkout.slot}</legend>
                {!form.delivery_date ? null : daySlots.length === 0 ? (
                  <p className="help">{d.checkout.noSlots}</p>
                ) : (
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={d.checkout.slot}>
                    {daySlots.map((s) => {
                      const on = form.slot_id === s.id;
                      return (
                        <button key={s.id} type="button" role="radio" aria-checked={on} className="choice-pill flex-col !items-start gap-0 py-2 leading-tight" onClick={() => set('slot_id')(s.id)}>
                          <span>{L(s.label, lang)}</span>
                          <span className="text-[11px] font-semibold text-ink-3">{d.checkout.between(formatHour(s.from, lang), formatHour(s.to, lang))}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.slot_id && (
                  <p id="slot_id-error" className="error" role="alert">
                    {errors.slot_id}
                  </p>
                )}
              </fieldset>

              <TextField id="notes" label={d.checkout.notes} optionalLabel={d.common.optional} value={form.notes} onChange={(v) => set('notes')(v.slice(0, NOTES_MAX))} onBlur={() => validateField('notes')} error={errors.notes} placeholder={d.checkout.notesPh} textarea maxLength={NOTES_MAX} counter={d.checkout.charsLeft(form.notes.length, NOTES_MAX)} />

              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                <input type="checkbox" checked={form.remember} onChange={(e) => set('remember')(e.target.checked)} className="h-5 w-5 accent-prairie" />
                {d.checkout.saveInfo}
              </label>
            </>
          )}
        </section>
      </div>

      {/* 3. Récapitulatif */}
      <aside id="recap" className="card mt-8 flex scroll-mt-32 flex-col gap-4 p-5 sm:p-6 lg:sticky lg:mt-0" style={{ top: 'calc(var(--header-h) + 16px)' }} aria-labelledby="recap-title">
        <h2 id="recap-title" className="text-2xl font-extrabold">
          <span className="me-2 text-prairie">3.</span>
          {d.checkout.summary}
        </h2>
        <ul className="flex flex-col gap-3">
          {lines.map((l) => (
            <li key={l.product_id} className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-cream">
                <ProductImage src={l.image} className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{L(l.name, lang)}</p>
                <p className="text-xs text-ink-3">{formatQtyShort(l.pricing.mode, l.qty, lang)}</p>
              </div>
              <p className="text-sm font-semibold tabular">
                {isEstimated(l.pricing) && <span className="me-1 text-ink-3">≈</span>}
                {formatPrice(lineTotal(l.pricing, l.qty), lang)}
              </p>
            </li>
          ))}
        </ul>
        <a href={href(lang, routes.cart)} className="text-sm font-bold text-prairie hover:text-prairie-deep">
          {d.checkout.editCart}
        </a>
        <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">{d.common.subtotal}</dt>
            <dd className="font-semibold tabular">{formatPrice(subtotal, lang)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">
              {d.common.delivery}
              {zone && <span className="ms-1 text-ink-3">· {L(zone.name, lang)}</span>}
            </dt>
            <dd className="font-semibold tabular">{fee == null ? '…' : fee === 0 ? d.common.free : formatPrice(fee, lang)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
            <dt className="font-bold">{hasEstimated ? d.cart.estimatedTotal : d.common.total}</dt>
            <dd className="font-display text-xl font-extrabold tabular" aria-live="polite">
              {formatPrice(total, lang)}
            </dd>
          </div>
        </dl>
        {hasEstimated && <p className="text-xs text-ink-3">{d.cart.estimateNote}</p>}
        <div className="rounded-md bg-prairie-soft p-4 text-sm text-prairie-deep">
          <p className="font-bold">{d.checkout.payment}</p>
          <p className="mt-1">{d.checkout.paymentText}</p>
        </div>
        {globalError && (
          <div id="checkout-error" className="rounded-md bg-paprika-soft px-4 py-3 text-sm font-semibold text-paprika" role="alert">
            {globalError}
          </div>
        )}
        <button type="submit" className="btn-primary btn-lg w-full" disabled={submitting || closed || failed || !settings} aria-busy={submitting || undefined}>
          {submitting ? d.checkout.submitting : d.checkout.submit}
        </button>
        <p className="text-center text-xs text-ink-3">
          {d.checkout.legal}{' '}
          <a href={href(lang, routes.terms)} className="underline" target="_blank" rel="noopener">
            {d.footer.terms}
          </a>
        </p>
      </aside>
    </form>
  );
}

function formatQtyShort(mode: 'per_piece' | 'per_kg' | 'per_kg_estimated', qty: number, lang: Lang): string {
  const nf = new Intl.NumberFormat(lang === 'ar' ? 'ar-TN' : 'fr-TN', { maximumFractionDigits: 2 });
  if (mode === 'per_kg') return lang === 'ar' ? `${nf.format(qty)} كغ` : `${nf.format(qty)} kg`;
  return `× ${nf.format(qty)}`;
}
