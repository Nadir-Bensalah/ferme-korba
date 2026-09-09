import { useEffect, useState } from 'react';
import type { Lang } from '@ferme/core';
import { seedSettings } from '@ferme/core';
import { t, locale, formatHour } from '@/i18n';

interface Props {
  lang: Lang;
  /** Les horaires écrits dans `brand.hours` : c'est ce qu'on affiche sans JavaScript. */
  hours: string;
  /** En haut de page, on ne garde que la pastille, sans la semaine. */
  compact?: boolean;
}

/** Les heures de `brand.hours`, en chiffres, pour pouvoir compter. */
const OPEN = '08:00';
const CLOSE = '19:00';
/** Jours fermés : la donnée vit dans les réglages de la boutique. */
const CLOSED: number[] = [...seedSettings.closed_days];
/** Sous ce nombre de minutes, on annonce la fermeture au lieu de l'heure. */
const SOON = 90;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** L'heure de la ferme, pas celle du visiteur : Korba est en Afrique/Tunis. */
function farmNow(): { day: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Tunis', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = days.indexOf(get('weekday'));
    const hour = Number(get('hour')) % 24;
    const minute = Number(get('minute'));
    if (day < 0 || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return { day, minutes: hour * 60 + minute };
  } catch {
    return null;
  }
}

/** Nom du jour, dans la langue de la page : « lundi », « الاثنين ». */
function dayName(offset: number, lang: Lang): string {
  const date = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'long', timeZone: 'Africa/Tunis' }).format(date);
}

/**
 * L'état des horaires, en direct : ouvert et jusqu'à quand, ou fermé et
 * quand ça rouvre. Sans JavaScript, la phrase des horaires reste affichée.
 */
export default function OpenStatus({ lang, hours, compact = false }: Props) {
  const d = t(lang);
  const [now, setNow] = useState<{ day: number; minutes: number } | null>(null);

  useEffect(() => {
    const tick = () => setNow(farmNow());
    tick();
    const id = window.setInterval(tick, 60000);
    return () => window.clearInterval(id);
  }, []);

  const open = toMinutes(OPEN);
  const close = toMinutes(CLOSE);
  const isOpenDay = (day: number) => !CLOSED.includes(day);

  let state: 'open' | 'closed' | 'unknown' = 'unknown';
  let text = hours;

  if (now) {
    const openToday = isOpenDay(now.day);
    if (openToday && now.minutes >= open && now.minutes < close) {
      state = 'open';
      const left = close - now.minutes;
      text = left <= SOON ? d.contact.statusClosingIn(left) : d.contact.statusUntil(formatHour(CLOSE, lang));
    } else {
      state = 'closed';
      if (openToday && now.minutes < open) {
        text = d.contact.statusOpensToday(formatHour(OPEN, lang));
      } else {
        let offset = 1;
        while (offset < 8 && !isOpenDay((now.day + offset) % 7)) offset++;
        text = offset === 1 ? d.contact.statusOpensTomorrow(formatHour(OPEN, lang)) : d.contact.statusOpensDay(dayName(offset, lang), formatHour(OPEN, lang));
      }
    }
  }

  /* La semaine, du lundi au dimanche. Le jour en cours est mis en avant. */
  const week = [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const offset = now ? (day - now.day + 7) % 7 : -1;
    return {
      day,
      label: now ? dayName(offset, lang) : '',
      isOpen: isOpenDay(day),
      today: now?.day === day,
    };
  });

  return (
    <div>
      <p className={`status status-${state} inline-flex items-center gap-2 rounded-pill px-3.5 py-2 text-sm font-bold`} aria-live="polite">
        <span className="status-dot" aria-hidden="true" />
        {text}
      </p>

      {now && !compact ? (
        <>
          <ul className="mt-4 flex flex-col divide-y divide-line-2/50 text-sm">
            {week.map((w) => (
              <li key={w.day} className={`flex min-h-9 items-center justify-between gap-3 py-1.5 ${w.today ? 'font-extrabold text-ink' : 'text-ink-2'}`}>
                <span className="capitalize">
                  {w.label}
                  {w.today ? <span className="ms-2 rounded-pill bg-yolk-soft px-2 py-0.5 text-[0.68rem] font-bold text-yolk-deep">{d.contact.hoursToday}</span> : null}
                </span>
                <span className="tabular" dir="ltr">
                  {w.isOpen ? `${formatHour(OPEN, lang)} - ${formatHour(CLOSE, lang)}` : <span dir="auto">{d.contact.hoursClosed}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">{d.contact.statusNote}</p>
        </>
      ) : null}
    </div>
  );
}
