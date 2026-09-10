import { useEffect, useState } from 'react';
import type { Lang } from '@ferme/core';
import { seedSettings } from '@ferme/core';
import { t, formatDate, formatHour } from '@/i18n';

/**
 * Le temps qu'il reste avant l'heure limite de commande. Rien n'est inventé :
 * tout sort de `settings` (heure limite, jours de fermeture). Quand l'heure
 * est passée ou que la ferme est fermée, on annonce la vraie prochaine
 * livraison plutôt qu'un « demain » faux.
 *
 * Avant l'hydratation, et sans JavaScript, c'est le texte de repli qui reste
 * affiché : la promesse générale est vraie, la précision arrive après.
 */
interface Props {
  lang: Lang;
  /** Texte affiché tant que l'heure du visiteur n'est pas connue. */
  fallback: string;
  variant?: 'banner' | 'inline';
}

/** Prochaine date de livraison possible, en sautant les jours de fermeture. */
function nextDelivery(from: Date, closed: number[]): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 14; i += 1) {
    d.setDate(d.getDate() + 1);
    if (!closed.includes(d.getDay())) return d;
  }
  return d;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Cutoff({ lang, fallback, variant = 'banner' }: Props) {
  const d = t(lang);
  const c = d.home.cutoff;
  const [text, setText] = useState<string | null>(null);
  const [part, setPart] = useState<string>('');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const [hh, mm] = seedSettings.cutoff_time.split(':').map(Number) as [number, number];
    const closed = seedSettings.closed_days;

    const tick = () => {
      const now = new Date();
      const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
      const left = limit.getTime() - now.getTime();
      const openToday = !closed.includes(now.getDay());

      setPart('');
      if (!openToday) {
        setUrgent(false);
        setText(c.closed(formatDate(iso(nextDelivery(now, closed)), lang)));
        return;
      }
      if (left <= 0) {
        // L'heure limite est passée : la prochaine préparation part le jour
        // ouvré suivant, donc la livraison est le jour d'après celui-là.
        const prepared = nextDelivery(now, closed);
        setUrgent(false);
        setText(c.passed(formatDate(iso(nextDelivery(prepared, closed)), lang), formatHour(seedSettings.cutoff_time, lang)));
        return;
      }
      const target = nextDelivery(now, closed);
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const dayLabel = iso(target) === iso(tomorrow) ? c.tomorrow : formatDate(iso(target), lang);
      const totalMin = Math.floor(left / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      setUrgent(totalMin <= 60);
      setPart(c.dur(h, m));
      setText(c.remaining(c.dur(h, m), dayLabel));
    };

    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [lang]);

  const label = text ?? fallback;

  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-2" aria-live="polite">
        <ClockIcon className={`h-5 w-5 shrink-0 ${urgent ? 'text-paprika' : 'text-prairie'}`} />
        <span className={urgent ? 'font-semibold text-paprika' : ''}>{label}</span>
      </span>
    );
  }

  const at = part ? label.indexOf(part) : -1;
  return (
    <p className={`mx-auto inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-pill px-5 py-2 text-base font-semibold ${urgent ? 'bg-yolk text-ink' : 'bg-paper/12 text-paper'}`} aria-live="polite">
      <ClockIcon className={`h-5 w-5 shrink-0 ${urgent ? 'text-ink' : 'text-yolk'} ${urgent ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
      {at >= 0 ? (
        <span className="tabular">
          {label.slice(0, at).trim()}
          <span className="mx-2 inline-block rounded-md bg-yolk px-3 py-1 font-extrabold text-ink">{part}</span>
          {label.slice(at + part.length).trim()}
        </span>
      ) : (
        <span className="tabular">{label}</span>
      )}
    </p>
  );
}

function ClockIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12.6" r="8.4" />
      <path d="M12 7.6v5l3.2 2.1" />
      <path d="M9.4 2.4h5.2" />
    </svg>
  );
}
