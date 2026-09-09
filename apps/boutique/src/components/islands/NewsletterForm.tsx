import { useState } from 'react';
import type { Lang } from '@ferme/core';
import { emailSchema } from '@ferme/core';
import { t } from '@/i18n';
import { data } from '@/lib/data';

interface Props {
  lang: Lang;
}

/**
 * Le champ d'inscription du pied de page : une adresse, un bouton flèche,
 * et trois états (envoi, noté, erreur). L'adresse est vérifiée ici avec la
 * même règle que le serveur, qui la revérifie de toute façon.
 */
export default function NewsletterForm({ lang }: Props) {
  const d = t(lang);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'invalid' | 'fail'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setState('invalid');
      return;
    }
    setState('sending');
    try {
      await data().subscribeNewsletter(parsed.data, lang);
      setState('done');
      setEmail('');
    } catch {
      setState('fail');
    }
  };

  if (state === 'done') {
    return (
      <p className="flex items-center gap-2 rounded-md bg-prairie-soft px-3 py-3 text-sm font-semibold text-prairie-deep" role="status">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5 10 17.5 19 7" />
        </svg>
        {d.footer.subscribed}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1.5">
      <div className="flex overflow-hidden rounded-md border border-line-2 bg-paper shadow-card focus-within:border-prairie focus-within:ring-4 focus-within:ring-prairie/15">
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state !== 'idle') setState('idle');
          }}
          placeholder={d.footer.emailPlaceholder}
          aria-label={d.footer.emailPlaceholder}
          aria-invalid={state === 'invalid' ? 'true' : undefined}
          aria-describedby="newsletter-msg"
          autoComplete="email"
          inputMode="email"
          className="min-h-12 min-w-0 flex-1 bg-transparent px-4 text-base text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <button type="submit" disabled={state === 'sending'} className="flex w-12 shrink-0 items-center justify-center bg-prairie-deep text-paper transition-colors hover:bg-prairie disabled:opacity-60" aria-label={d.footer.subscribe}>
          {state === 'sending' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className="animate-spin">
              <path d="M12 3a9 9 0 1 0 9 9" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rtl:-scale-x-100">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>
      <p id="newsletter-msg" className={`min-h-5 text-xs ${state === 'invalid' || state === 'fail' ? 'text-paprika' : 'text-ink-3'}`} role="alert">
        {state === 'invalid' ? d.footer.subscribeError : state === 'fail' ? d.footer.subscribeFail : ''}
      </p>
    </form>
  );
}
