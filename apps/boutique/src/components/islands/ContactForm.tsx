import { useState } from 'react';
import type { Lang } from '@ferme/core';
import { contactSchema, fieldErrors } from '@ferme/core';
import { data, isDemo } from '@/lib/data';
import { t } from '@/i18n';

interface Props {
  lang: Lang;
}

type Status = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Formulaire de contact : nom, téléphone, message, et un champ piège invisible.
 * Validé avec le même schéma que le serveur, envoyé par la source de données.
 */
export default function ContactForm({ lang }: Props) {
  const d = t(lang);
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState({ name: '', phone: '', message: '', website: '' });

  const label = (code: string | undefined) => {
    if (!code) return undefined;
    const contact = d.contact.errors as Record<string, string>;
    const checkout = d.checkout.errors as Record<string, string>;
    return contact[code] ?? checkout[code] ?? d.common.error;
  };

  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: '' }));
  };

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setStatus('sending');
    try {
      const { name, phone, message } = parsed.data;
      await data().sendContact({ name, phone, message });
      setStatus('sent');
      setValues({ name: '', phone: '', message: '', website: '' });
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="rounded-lg bg-prairie-soft p-6 text-prairie-deep" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-prairie text-white animate-pop" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5 10 17.5 19 7" />
            </svg>
          </span>
          <p className="text-lg font-bold">{d.contact.sent}</p>
        </div>
        <p className="mt-3">{d.contact.sentText}</p>
        <button type="button" className="btn-soft mt-5 bg-paper" onClick={() => setStatus('idle')}>
          {d.contact.again}
        </button>
      </div>
    );
  }

  const bot = errors.website ? label(errors.website) : undefined;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {isDemo ? <p className="rounded-md bg-yolk-soft px-4 py-2.5 text-sm font-semibold text-yolk-deep">{d.common.demo}</p> : null}
      <div>
        <label htmlFor="c-name" className="label">
          {d.contact.name}
        </label>
        <input id="c-name" name="name" type="text" autoComplete="name" className="field" placeholder={d.contact.namePh} value={values.name} onChange={set('name')} aria-invalid={errors.name ? 'true' : undefined} aria-describedby={errors.name ? 'c-name-err' : undefined} required />
        {errors.name ? (
          <p id="c-name-err" className="error">
            {label(errors.name)}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="c-phone" className="label">
          {d.contact.phone}
        </label>
        <input id="c-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" className="field text-start" placeholder={d.contact.phonePh} value={values.phone} onChange={set('phone')} aria-invalid={errors.phone ? 'true' : undefined} aria-describedby={errors.phone ? 'c-phone-err' : 'c-phone-help'} required />
        {errors.phone ? (
          <p id="c-phone-err" className="error">
            {label(errors.phone)}
          </p>
        ) : (
          <p id="c-phone-help" className="help">
            {d.contact.phoneHelp}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="c-message" className="label">
          {d.contact.message}
        </label>
        <textarea id="c-message" name="message" rows={5} className="field resize-y" placeholder={d.contact.messagePh} value={values.message} onChange={set('message')} aria-invalid={errors.message ? 'true' : undefined} aria-describedby={errors.message ? 'c-message-err' : undefined} required />
        {errors.message ? (
          <p id="c-message-err" className="error">
            {label(errors.message)}
          </p>
        ) : null}
      </div>
      {/* Champ piège : un humain ne le voit pas, un robot le remplit. */}
      <div className="absolute -start-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
      </div>
      {status === 'error' || bot ? (
        <p className="rounded-md bg-paprika-soft px-4 py-3 text-sm font-semibold text-paprika" role="alert">
          {bot ?? d.common.error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary btn-lg" disabled={status === 'sending'}>
        {status === 'sending' ? d.contact.sending : d.contact.send}
      </button>
    </form>
  );
}
