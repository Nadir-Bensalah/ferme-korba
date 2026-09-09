import { useEffect, useState, type ReactNode } from 'react';
import type { Lang, Pricing } from '@ferme/core';
import { formatDate } from '@/i18n';
import type { Dictionary } from '@/i18n/fr';
import { isoToday } from './shared';
import RollingNumber from '@/components/islands/RollingNumber';

/**
 * Petites pièces du parcours d'achat : icônes dessinées au trait, dessins de la
 * ferme pour les états vides, compte à rebours de l'heure limite, poids estimé
 * du panier, barre de livraison offerte et fichier d'agenda.
 * Tout est dessiné ici, aucune bibliothèque, aucun emoji.
 */

/* ------------------------------------------------------------------ */
/* Icônes                                                              */
/* ------------------------------------------------------------------ */

export interface IcoProps {
  className?: string;
  size?: number;
}

function S({ size = 20, className = '', width = 1.8, children }: IcoProps & { width?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const IcoClock = (p: IcoProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.2V12l3.2 1.9" />
  </S>
);

export const IcoTruck = (p: IcoProps) => (
  <S {...p}>
    <path d="M2.5 6.5h10.5v10H2.5z" />
    <path d="M13 10h3.6l3.9 3.6v2.9H13z" />
    <circle cx="7" cy="17.5" r="1.9" />
    <circle cx="17" cy="17.5" r="1.9" />
  </S>
);

export const IcoScale = (p: IcoProps) => (
  <S {...p}>
    <path d="M12 4.5v15" />
    <path d="M7 19.5h10" />
    <path d="M4 8.5h16" />
    <path d="M4 8.5 1.8 14a3 3 0 0 0 4.4 0z" />
    <path d="M20 8.5 22.2 14a3 3 0 0 1-4.4 0z" />
  </S>
);

export const IcoSpark = (p: IcoProps) => (
  <S {...p}>
    <path d="M12 3.2 13.7 9 19.5 10.7 13.7 12.4 12 18.2 10.3 12.4 4.5 10.7 10.3 9z" />
    <path d="M18.5 16.5 19.3 18.6 21.4 19.4 19.3 20.2 18.5 22.3 17.7 20.2 15.6 19.4 17.7 18.6z" />
  </S>
);

export const IcoSunrise = (p: IcoProps) => (
  <S {...p}>
    <path d="M3 19h18" />
    <path d="M7 15.5a5 5 0 0 1 10 0" />
    <path d="M12 2.5v3M5.2 6.4 7 8.2M18.8 6.4 17 8.2" />
  </S>
);

export const IcoSun = (p: IcoProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5 7.2 7.2M16.8 16.8l1.7 1.7M18.5 5.5 16.8 7.2M7.2 16.8 5.5 18.5" />
  </S>
);

export const IcoDusk = (p: IcoProps) => (
  <S {...p}>
    <path d="M3 19.5h18" />
    <path d="M17.8 9.4A6 6 0 1 1 11.4 3a4.8 4.8 0 0 0 6.4 6.4z" />
  </S>
);

export const IcoPhone = (p: IcoProps) => (
  <S {...p}>
    <path d="M8.2 3.5H5.4a2 2 0 0 0-2 2.2 16.5 16.5 0 0 0 15 15 2 2 0 0 0 2.1-2v-2.7l-3.7-1.3-1.6 1.6a13 13 0 0 1-5.6-5.6l1.6-1.6z" />
  </S>
);

export const IcoCash = (p: IcoProps) => (
  <S {...p}>
    <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 10.2v3.6M18 10.2v3.6" />
  </S>
);

export const IcoShield = (p: IcoProps) => (
  <S {...p}>
    <path d="M12 3.2 5 6v6.1c0 4 3 6.7 7 8.2 4-1.5 7-4.2 7-8.2V6z" />
    <path d="m9 12 2.1 2.1L15.2 10" />
  </S>
);

export const IcoCalendar = (p: IcoProps) => (
  <S {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </S>
);

export const IcoBookmark = (p: IcoProps) => (
  <S {...p}>
    <path d="M6.8 4h10.4v16.2L12 16.6 6.8 20.2z" />
  </S>
);

export const IcoPin = (p: IcoProps) => (
  <S {...p}>
    <path d="M12 21.2s7-6.4 7-11.2a7 7 0 1 0-14 0c0 4.8 7 11.2 7 11.2z" />
    <circle cx="12" cy="9.8" r="2.6" />
  </S>
);

export const IcoPlus = (p: IcoProps) => (
  <S {...p} width={2.2}>
    <path d="M12 5.5v13M5.5 12h13" />
  </S>
);

export const IcoCheck = (p: IcoProps) => (
  <S {...p} width={2.4}>
    <path d="m5 12.6 4.8 4.8L19 7" />
  </S>
);

export const IcoTicket = (p: IcoProps) => (
  <S {...p}>
    <path d="M3.5 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v1.6a2.4 2.4 0 0 0 0 4.8V16a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-1.6a2.4 2.4 0 0 0 0-4.8z" />
    <path d="M9.5 6.6v10.8" strokeDasharray="1.6 3" />
  </S>
);

export const IcoChevron = (p: IcoProps) => (
  <S {...p} width={2.2}>
    <path d="m9 5 7 7-7 7" />
  </S>
);

export const IcoChat = (p: IcoProps) => (
  <S {...p}>
    <path d="M4.5 4.5h15a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V16H4.5A1.5 1.5 0 0 1 3 14.5V6a1.5 1.5 0 0 1 1.5-1.5z" />
    <path d="M8 10h.01M12 10h.01M16 10h.01" strokeWidth="2.4" />
  </S>
);

/** Icône du moment de la journée, selon l'heure de début du créneau. */
export function SlotIcon({ from, className = '', size = 22 }: { from: string; className?: string; size?: number }) {
  const h = Number(from.slice(0, 2));
  if (h < 12) return <IcoSunrise className={className} size={size} />;
  if (h < 16) return <IcoSun className={className} size={size} />;
  return <IcoDusk className={className} size={size} />;
}

/* ------------------------------------------------------------------ */
/* Dessins de la ferme, pour les états vides                           */
/* ------------------------------------------------------------------ */

export type ArtType = 'oeufs' | 'poussin' | 'plume';

/**
 * Mêmes traits que Deco.astro, en version React : les îlots ne peuvent pas
 * instancier un composant Astro.
 */
export function DecoArt({ type, className = '' }: { type: ArtType; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      {type === 'oeufs' && (
        <g {...common}>
          <path d="M42 104c-11 0-19-8-19-19 0-14 8-32 19-32s19 18 19 32c0 11-8 19-19 19Z" />
          <path d="M80 106c-9 0-15-7-15-15 0-11 7-26 15-26s15 15 15 26c0 8-6 15-15 15Z" />
        </g>
      )}
      {type === 'poussin' && (
        <g {...common}>
          <path d="M42 88c0-16 9-28 22-28s22 12 22 28c0 10-9 16-22 16s-22-6-22-16Z" />
          <path d="M52 60c-2-12 4-22 14-22s16 10 14 22" />
          <circle cx="60" cy="48" r="1.6" fill="currentColor" stroke="none" />
          <path d="M70 50l7 3-7 3" />
          <path d="M54 104v6M70 104v6" />
        </g>
      )}
      {type === 'plume' && (
        <g {...common}>
          <path d="M34 104c26-6 46-22 56-46 6-16 5-30-3-42-16 6-30 18-40 34-10 16-14 34-13 54Z" />
          <path d="M34 104 78 40" />
          <path d="M44 88h16M50 76h16M56 64h15M62 52h13M68 42h10" />
        </g>
      )}
    </svg>
  );
}

/** État vide illustré : un dessin de la ferme, un titre, un texte, une action. */
export function EmptyState({ art, title, text, children, className = '' }: { art: ArtType; title: string; text?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-3 px-4 py-8 text-center ${className}`}>
      <div className="fk-empty-art">
        <DecoArt type={art} className="relative h-20 w-20 text-prairie/60" />
      </div>
      <p className="text-base font-bold">{title}</p>
      {text && <p className="max-w-xs text-sm text-ink-3">{text}</p>}
      {children}
    </div>
  );
}

/**
 * Un montant dont les chiffres roulent. Le compteur pose une colonne par
 * chiffre dans une boîte flex : en arabe, la boîte inverse l'ordre et le
 * nombre se lisait à l'envers. Le sens est donc forcé de gauche à droite,
 * comme pour tous les chiffres latins.
 */
export function Money({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span dir="ltr" className="inline-flex">
      <RollingNumber value={value} className={className} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Heure limite et jours                                               */
/* ------------------------------------------------------------------ */

/** Minutes restantes avant l'heure limite du jour, et si elle est passée. */
export function cutoffLeft(cutoff: string, now: Date = new Date()): { past: boolean; minutes: number } {
  const [h, m] = cutoff.split(':').map(Number);
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h ?? 23, m ?? 59, 0, 0);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { past: true, minutes: 0 };
  return { past: false, minutes: Math.ceil(diff / 60000) };
}

/** « 2 h 14 » ou « 14 min ». */
export function formatLeft(minutes: number, d: Dictionary): string {
  if (minutes >= 60) return d.cart.hoursLeft(Math.floor(minutes / 60), String(minutes % 60).padStart(2, '0'));
  return d.cart.minutesLeft(minutes);
}

/** « aujourd'hui », « demain », « après-demain », sinon « le jeudi 11 septembre ». */
export function dayWord(iso: string, lang: Lang, d: Dictionary): string {
  if (iso === isoToday()) return d.cart.dayToday;
  if (iso === isoToday(1)) return d.cart.dayTomorrow;
  if (iso === isoToday(2)) return d.cart.dayAfterTomorrow;
  return d.cart.dayOn(formatDate(iso, lang, { weekday: 'long', day: 'numeric', month: 'long' }));
}

/** Une horloge qui avance : renvoie l'heure courante, rafraîchie toutes les 15 s. */
export function useNow(active = true): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/* ------------------------------------------------------------------ */
/* Poids estimé du panier                                              */
/* ------------------------------------------------------------------ */

/** Poids connu d'une ligne, en kilos. 0 quand le produit se vend à la pièce. */
export function lineWeight(pricing: Pricing, qty: number): number {
  if (pricing.mode === 'per_kg') return qty;
  if (pricing.mode === 'per_kg_estimated') return pricing.est_weight_kg * qty;
  return 0;
}

export function formatKg(kg: number, lang: Lang): string {
  const nf = new Intl.NumberFormat(lang === 'ar' ? 'ar-TN' : 'fr-TN', { maximumFractionDigits: 1 });
  return lang === 'ar' ? `${nf.format(kg)} كغ` : `${nf.format(kg)} kg`;
}

/* ------------------------------------------------------------------ */
/* Barre vers la livraison offerte                                     */
/* ------------------------------------------------------------------ */

/**
 * La barre se remplit en jaune, passe au vert au seuil et lance un éclat une
 * seule fois, au moment du passage. Sans animation si l'utilisateur les réduit.
 */
export function FreeShipBar({ percent, reached, label }: { percent: number; reached: boolean; label: string }) {
  const [burst, setBurst] = useState(false);
  const [seen, setSeen] = useState(reached);
  useEffect(() => {
    if (reached && !seen) {
      setSeen(true);
      setBurst(true);
      const id = setTimeout(() => setBurst(false), 1200);
      return () => clearTimeout(id);
    }
    if (!reached && seen) setSeen(false);
  }, [reached, seen]);
  return (
    <div className="fk-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
      <div className="fk-bar-fill" data-full={reached ? 'true' : 'false'} style={{ width: `${Math.max(reached ? 100 : 4, percent)}%` }}>
        <span className="fk-bar-shine" aria-hidden="true" />
      </div>
      {burst && (
        <span className="fk-burst" aria-hidden="true">
          <IcoSpark size={22} />
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Agenda (.ics), fabriqué dans le navigateur                          */
/* ------------------------------------------------------------------ */

function icsEscape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsStamp(dateISO: string, hhmm: string): string {
  return `${dateISO.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
}

/** Un événement simple, en heure locale : le fichier reste lisible partout. */
export function buildIcs(o: { uid: string; date: string; from: string; to: string; summary: string; description: string; location: string }): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ferme Korba//Boutique//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsEscape(o.uid)}@ferme-korba`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsStamp(o.date, o.from)}`,
    `DTEND:${icsStamp(o.date, o.to)}`,
    `SUMMARY:${icsEscape(o.summary)}`,
    `DESCRIPTION:${icsEscape(o.description)}`,
    `LOCATION:${icsEscape(o.location)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(o.summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Propose le fichier au téléchargement, sans passer par le serveur. */
export function downloadIcs(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
