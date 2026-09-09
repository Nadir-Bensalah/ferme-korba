import { useCallback, useEffect, useState } from 'react';
import type { CustomerProfile, DeliveryZone, Lang, OrderSummaryForCustomer } from '@ferme/core';
import { emailSchema, fieldErrors, formatPrice, loginSchema, nameSchema, passwordSchema, registerSchema } from '@ferme/core';
import { auth, data } from '@/lib/data';
import { href, routes } from '@/lib/paths';
import { t, L, formatDate, formatDateTime } from '@/i18n';
import { OrderResult } from './TrackingPage';
import { ErrorBox, Notice, Skeleton, TextField, errorMessage, localPhone, useUser } from './shared';

interface Props {
  lang: Lang;
}

/** Espace client : connexion ou création de compte, puis commandes, infos, adresse, mot de passe. */
export default function Account({ lang }: Props) {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  return <div className="mx-auto flex max-w-2xl flex-col gap-6">{user ? <Space lang={lang} user={user} /> : <AuthTabs lang={lang} />}</div>;
}

/* ------------------------------------------------------------------ */
/* Connexion / création                                                */
/* ------------------------------------------------------------------ */

function AuthTabs({ lang }: { lang: Lang }) {
  const d = t(lang);
  const [tab, setTab] = useState<'login' | 'register'>('login');
  return (
    <>
      <div role="tablist" aria-label={d.account.title} className="flex gap-1 rounded-pill bg-cream p-1">
        <button role="tab" type="button" id="tab-login" aria-selected={tab === 'login'} aria-controls="panel-login" className="tab-btn" onClick={() => setTab('login')}>
          {d.account.login}
        </button>
        <button role="tab" type="button" id="tab-register" aria-selected={tab === 'register'} aria-controls="panel-register" className="tab-btn" onClick={() => setTab('register')}>
          {d.account.register}
        </button>
      </div>
      {tab === 'login' ? (
        <div role="tabpanel" id="panel-login" aria-labelledby="tab-login">
          <LoginForm lang={lang} onRegister={() => setTab('register')} />
        </div>
      ) : (
        <div role="tabpanel" id="panel-register" aria-labelledby="tab-register">
          <RegisterForm lang={lang} onLogin={() => setTab('login')} />
        </div>
      )}
    </>
  );
}

function LoginForm({ lang, onRegister }: { lang: Lang; onRegister: () => void }) {
  const d = t(lang);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [global, setGlobal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (busy) return;
    setGlobal(null);
    const parsed = loginSchema.safeParse({ phone, password });
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      document.getElementById(errs.phone ? 'login-phone' : 'login-password')?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await auth().login(parsed.data);
    } catch (err) {
      setGlobal(errorMessage(d, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="card flex flex-col gap-4 p-5 sm:p-6">
      <TextField id="login-phone" label={d.account.phone} value={phone} onChange={setPhone} error={errors.phone ? errorMessage(d, errors.phone) : undefined} type="tel" inputMode="tel" autoComplete="username" prefix="+216" dir="ltr" placeholder={d.checkout.phonePh} required />
      <TextField id="login-password" label={d.account.password} value={password} onChange={setPassword} error={errors.password ? errorMessage(d, errors.password) : undefined} type="password" autoComplete="current-password" required />
      {global && (
        <p className="rounded-md bg-paprika-soft px-4 py-3 text-sm font-semibold text-paprika" role="alert">
          {global}
        </p>
      )}
      <button type="submit" className="btn-primary btn-lg" disabled={busy} aria-busy={busy || undefined}>
        {busy ? d.common.loading : d.account.login}
      </button>
      <p className="text-sm text-ink-3">{d.account.forgot}</p>
      <p className="text-sm">
        {d.account.noAccount}{' '}
        <button type="button" onClick={onRegister} className="font-bold text-prairie underline">
          {d.account.register}
        </button>
      </p>
    </form>
  );
}

function RegisterForm({ lang, onLogin }: { lang: Lang; onLogin: () => void }) {
  const d = t(lang);
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [global, setGlobal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (busy) return;
    setGlobal(null);
    const parsed = registerSchema.safeParse(f);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      const first = ['name', 'phone', 'email', 'password'].find((k) => errs[k]);
      if (first) document.getElementById(`reg-${first}`)?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await auth().register(parsed.data);
    } catch (err) {
      setGlobal(errorMessage(d, err));
    } finally {
      setBusy(false);
    }
  };
  const err = (k: string) => (errors[k] ? errorMessage(d, errors[k]) : undefined);

  return (
    <form onSubmit={submit} noValidate className="card flex flex-col gap-4 p-5 sm:p-6">
      <p className="text-sm text-ink-2">{d.account.registerText}</p>
      <TextField id="reg-name" label={d.account.name} value={f.name} onChange={set('name')} error={err('name')} autoComplete="name" placeholder={d.checkout.namePh} required />
      <TextField id="reg-phone" label={d.account.phone} value={f.phone} onChange={set('phone')} error={err('phone')} type="tel" inputMode="tel" autoComplete="tel-national" prefix="+216" dir="ltr" placeholder={d.checkout.phonePh} required />
      <TextField id="reg-email" label={d.account.email} optionalLabel={d.common.optional} value={f.email} onChange={set('email')} error={err('email')} type="email" inputMode="email" autoComplete="email" dir="ltr" />
      <TextField id="reg-password" label={d.account.password} value={f.password} onChange={set('password')} error={err('password')} help={d.account.passwordHelp} type="password" autoComplete="new-password" required />
      {global && (
        <p className="rounded-md bg-paprika-soft px-4 py-3 text-sm font-semibold text-paprika" role="alert">
          {global}
        </p>
      )}
      <button type="submit" className="btn-primary btn-lg" disabled={busy} aria-busy={busy || undefined}>
        {busy ? d.common.loading : d.account.register}
      </button>
      <p className="text-sm">
        {d.account.hasAccount}{' '}
        <button type="button" onClick={onLogin} className="font-bold text-prairie underline">
          {d.account.login}
        </button>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Espace connecté                                                     */
/* ------------------------------------------------------------------ */

function Space({ lang, user }: { lang: Lang; user: CustomerProfile }) {
  const d = t(lang);
  const first = user.name.split(' ')[0] ?? user.name;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">{d.account.welcome(first)}</h2>
        <button type="button" onClick={() => auth().logout()} className="btn-ghost btn-sm">
          {d.account.logout}
        </button>
      </div>
      <Orders lang={lang} />
      <Profile lang={lang} user={user} />
      <Address lang={lang} user={user} />
      <Password lang={lang} />
    </>
  );
}

function Orders({ lang }: { lang: Lang }) {
  const d = t(lang);
  const [orders, setOrders] = useState<OrderSummaryForCustomer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => {
    setFailed(false);
    auth()
      .listMyOrders()
      .then((rows) => setOrders([...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))))
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const tone = (s: OrderSummaryForCustomer['status']) => (s === 'livree' ? 'bg-prairie-soft text-prairie-deep' : s === 'annulee' || s === 'refusee' ? 'bg-paprika-soft text-paprika' : 'bg-yolk-soft text-yolk-deep');

  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="orders-title">
      <h3 id="orders-title" className="text-xl font-extrabold">
        {d.account.orders}
      </h3>
      {failed ? (
        <ErrorBox message={d.common.error} retry={load} retryLabel={d.common.retry} />
      ) : !orders ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-ink-3">{d.account.noOrders}</p>
          <a href={href(lang, routes.shop)} className="btn-soft btn-sm">
            {d.cart.emptyCta}
          </a>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((o) => {
            const isOpen = open === o.number;
            return (
              <li key={o.number} className="rounded-lg border border-line">
                <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-start" aria-expanded={isOpen} aria-controls={`order-${o.number}`} onClick={() => setOpen(isOpen ? null : o.number)}>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-bold tabular" dir="ltr">
                      {o.number}
                    </span>
                    <span className="text-xs text-ink-3">
                      {formatDateTime(o.created_at, lang)} · {d.tracking.deliveryOn} {formatDate(o.delivery_date, lang, { day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`chip ${tone(o.status)}`}>{d.tracking.statuses[o.status]}</span>
                    <span className="font-display text-lg font-extrabold tabular">{formatPrice(o.final_total ?? o.total, lang)}</span>
                  </span>
                </button>
                {isOpen && (
                  <div id={`order-${o.number}`} className="border-t border-line bg-cream/60 p-3 sm:p-4">
                    <OrderResult order={o} lang={lang} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Profile({ lang, user }: { lang: Lang; user: CustomerProfile }) {
  const d = t(lang);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    const n = nameSchema.safeParse(name);
    const m = email ? emailSchema.safeParse(email) : { success: true as const, data: '' };
    const errs: Record<string, string> = {};
    if (!n.success) errs.name = fieldErrors(n.error)._ ?? 'name.short';
    if (!m.success) errs.email = fieldErrors(m.error)._ ?? 'email.invalid';
    setErrors(errs);
    if (errs.name || errs.email) {
      document.getElementById(errs.name ? 'profile-name' : 'profile-email')?.focus();
      return;
    }
    setBusy(true);
    try {
      await auth().updateProfile({ name: n.success ? n.data : name, email: m.success && m.data ? m.data : null });
      setMsg(d.common.saved);
    } catch (err) {
      setMsg(errorMessage(d, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="profile-title">
      <h3 id="profile-title" className="text-xl font-extrabold">
        {d.account.profile}
      </h3>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField id="profile-name" label={d.account.name} value={name} onChange={setName} error={errors.name ? errorMessage(d, errors.name) : undefined} autoComplete="name" required />
        <TextField id="profile-phone" label={d.account.phone} value={localPhone(user.phone)} onChange={() => {}} prefix="+216" dir="ltr" />
        <TextField id="profile-email" label={d.account.email} optionalLabel={d.common.optional} value={email} onChange={setEmail} error={errors.email ? errorMessage(d, errors.email) : undefined} type="email" inputMode="email" autoComplete="email" dir="ltr" />
        {msg && <Notice tone={msg === d.common.saved ? 'ok' : 'warn'}>{msg}</Notice>}
        <button type="submit" className="btn-primary self-start" disabled={busy} aria-busy={busy || undefined}>
          {busy ? d.common.loading : d.common.save}
        </button>
      </form>
    </section>
  );
}

function Address({ lang, user }: { lang: Lang; user: CustomerProfile }) {
  const d = t(lang);
  const a = user.default_address;
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [f, setF] = useState({ zone_id: a?.zone_id ?? '', street: a?.street ?? '', city: a?.city ?? '', landmark: a?.landmark ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    data()
      .listZones()
      .then(setZones)
      .catch(() => setZones([]));
  }, []);

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    const errs: Record<string, string> = {};
    if (!f.zone_id) errs.zone_id = 'zone.required';
    if (f.street.trim().length < 5) errs.street = 'street.short';
    if (f.city.trim().length < 2) errs.city = 'city.short';
    setErrors(errs);
    const first = ['zone_id', 'street', 'city'].find((k) => errs[k]);
    if (first) {
      document.getElementById(`addr-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await auth().updateProfile({ default_address: { zone_id: f.zone_id, street: f.street.trim(), city: f.city.trim(), landmark: f.landmark.trim() || undefined } });
      setMsg(d.common.saved);
    } catch (err) {
      setMsg(errorMessage(d, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="addr-title">
      <h3 id="addr-title" className="text-xl font-extrabold">
        {d.account.address}
      </h3>
      {!a && <p className="text-sm text-ink-3">{d.account.noAddress}</p>}
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="addr-zone_id" className="label">
            {d.checkout.zone}
          </label>
          {!zones ? (
            <Skeleton className="h-12" />
          ) : (
            <select id="addr-zone_id" className="field" value={f.zone_id} onChange={(e) => set('zone_id')(e.target.value)} aria-invalid={errors.zone_id ? true : undefined} aria-describedby={errors.zone_id ? 'addr-zone-error' : undefined}>
              <option value="">{d.checkout.zonePh}</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {L(z.name, lang)} · {formatPrice(z.fee, lang)}
                </option>
              ))}
            </select>
          )}
          {errors.zone_id && (
            <p id="addr-zone-error" className="error" role="alert">
              {errorMessage(d, errors.zone_id)}
            </p>
          )}
        </div>
        <TextField id="addr-street" label={d.checkout.street} value={f.street} onChange={set('street')} error={errors.street ? errorMessage(d, errors.street) : undefined} placeholder={d.checkout.streetPh} autoComplete="street-address" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="addr-city" label={d.checkout.city} value={f.city} onChange={set('city')} error={errors.city ? errorMessage(d, errors.city) : undefined} placeholder={d.checkout.cityPh} autoComplete="address-level2" required />
          <TextField id="addr-landmark" label={d.checkout.landmark} optionalLabel={d.common.optional} value={f.landmark} onChange={set('landmark')} placeholder={d.checkout.landmarkPh} />
        </div>
        {msg && <Notice tone={msg === d.common.saved ? 'ok' : 'warn'}>{msg}</Notice>}
        <button type="submit" className="btn-primary self-start" disabled={busy} aria-busy={busy || undefined}>
          {busy ? d.common.loading : d.common.save}
        </button>
      </form>
    </section>
  );
}

function Password({ lang }: { lang: Lang }) {
  const d = t(lang);
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    const parsed = passwordSchema.safeParse(pw);
    if (!parsed.success) {
      setError(errorMessage(d, fieldErrors(parsed.error)._));
      document.getElementById('pw-new')?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await auth().changePassword(parsed.data);
      setPw('');
      setMsg(d.account.passwordChanged);
    } catch (err) {
      setMsg(errorMessage(d, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="pw-title">
      <h3 id="pw-title" className="text-xl font-extrabold">
        {d.account.changePassword}
      </h3>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField id="pw-new" label={d.account.newPassword} value={pw} onChange={setPw} error={error ?? undefined} help={d.account.passwordHelp} type="password" autoComplete="new-password" required />
        {msg && <Notice tone={msg === d.account.passwordChanged ? 'ok' : 'warn'}>{msg}</Notice>}
        <button type="submit" className="btn-primary self-start" disabled={busy} aria-busy={busy || undefined}>
          {busy ? d.common.loading : d.common.save}
        </button>
      </form>
    </section>
  );
}
