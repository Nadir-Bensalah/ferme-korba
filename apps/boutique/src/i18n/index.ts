import type { Lang, Localized } from '@ferme/core';
import { fr, type Dictionary } from './fr';
import { ar } from './ar';

export const LANGS: Lang[] = ['fr', 'ar'];
export const DEFAULT_LANG: Lang = 'fr';

export function t(lang: Lang): Dictionary {
  return lang === 'ar' ? ar : fr;
}

export function dir(lang: Lang): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export function locale(lang: Lang): string {
  return lang === 'ar' ? 'ar-TN' : 'fr-TN';
}

/** Texte localisé d'un objet { fr, ar }, avec repli sur le français. */
export function L(v: Localized | undefined, lang: Lang): string {
  if (!v) return '';
  return v[lang] || v.fr || '';
}

/** Détecte la langue depuis une URL Astro ( /ar/... ) */
export function langFromUrl(url: URL, base = ''): Lang {
  const path = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
  return path === '/ar' || path.startsWith('/ar/') ? 'ar' : 'fr';
}

export function otherLang(lang: Lang): Lang {
  return lang === 'ar' ? 'fr' : 'ar';
}

/** Date lisible : « jeudi 10 septembre » */
export function formatDate(iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(locale(lang), opts).format(date);
}

export function formatDateTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** « 09:00 » → « 9 h » en français, « 09:00 » en arabe. */
export function formatHour(hhmm: string, lang: Lang): string {
  const [h, m] = hhmm.split(':') as [string, string];
  if (lang === 'ar') return `${h}:${m}`;
  return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}
