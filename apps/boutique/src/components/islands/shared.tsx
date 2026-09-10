import { persistentAtom } from '@nanostores/persistent';
import { useEffect, useState, type ReactNode } from 'react';
import type { Badge, CustomerProfile, Lang, Pricing } from '@ferme/core';
import { clampQty, formatQty, qtyBounds, qtyStep, roundMillimes } from '@ferme/core';
import { auth } from '@/lib/data';
import { asset } from '@/lib/paths';
import { artSources, photoSources } from '@/lib/img';
import type { Dictionary } from '@/i18n/fr';

/**
 * Petites briques communes aux îlots du commerce : préférences locales,
 * champs de formulaire accessibles, sélecteur de quantité, états de chargement.
 */

/** Zone choisie la dernière fois, pour estimer la livraison dans le panier. */
export const preferredZoneId = persistentAtom<string>('ferme-korba:zone:v1', '');

export interface Remembered {
  name: string;
  phone: string;
  email: string;
  zone_id: string;
  street: string;
  city: string;
  landmark: string;
}

const REMEMBER_KEY = 'ferme-korba:checkout:v1';

/** Coordonnées et adresse mémorisées sur l'appareil. Jamais le panier. */
export function loadRemembered(): Remembered | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Remembered>;
    return {
      name: v.name ?? '',
      phone: v.phone ?? '',
      email: v.email ?? '',
      zone_id: v.zone_id ?? '',
      street: v.street ?? '',
      city: v.city ?? '',
      landmark: v.landmark ?? '',
    };
  } catch {
    return null;
  }
}

export function saveRemembered(v: Remembered): void {
  try {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify(v));
  } catch {
    /* stockage indisponible */
  }
}

export function clearRemembered(): void {
  try {
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* rien à faire */
  }
}

/** Vrai une fois monté côté navigateur : évite d'afficher un panier vide pendant l'hydratation. */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** Client connecté, mis à jour à chaque changement de session. */
export function useUser(): { user: CustomerProfile | null; loading: boolean } {
  const [user, setUser] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    auth()
      .currentUser()
      .then((u) => {
        if (alive) setUser(u);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    const off = auth().onAuthChange((u) => alive && setUser(u));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return { user, loading };
}

/** Attend que le navigateur soit libre avant une lecture « live » non urgente. */
export function whenIdle(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 1500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = setTimeout(fn, 200);
  return () => clearTimeout(id);
}

/** Message lisible pour un code d'erreur, quel que soit l'espace où il est défini. */
export function errorMessage(d: Dictionary, code: unknown): string {
  const key = typeof code === 'string' ? code : code instanceof Error ? code.message : '';
  const acc = d.account.errors as Record<string, string>;
  const chk = d.checkout.errors as Record<string, string>;
  return acc[key] ?? chk[key] ?? d.common.error;
}

/** Libellés des badges, mêmes classes que Badges.astro (mise à jour « live » des cartes). */
export const badgeLabels: Record<Badge, { fr: string; ar: string; cls: string }> = {
  fermier: { fr: 'Fermier', ar: 'بلدي', cls: 'chip-fermier' },
  nouveau: { fr: 'Nouveau', ar: 'جديد', cls: 'chip-nouveau' },
  promo: { fr: 'Promo', ar: 'تخفيض', cls: 'chip-promo' },
  best: { fr: 'Le plus demandé', ar: 'الأكثر طلباً', cls: 'chip-best' },
};

/** Photo produit dans un îlot : WebP 480 avec repli JPEG. */
export function ProductImage({ src, alt = '', className = '', size = 480, sizes }: { src: string; alt?: string; className?: string; size?: 480 | 960; sizes?: string }) {
  const p = photoSources(src || '/images/products/poulet-entier.jpg');
  const sz = sizes ?? `${size}px`;
  return (
    <picture className={`block ${className}`}>
      {p.local && <source type="image/avif" srcSet={p.avif} sizes={sz} />}
      {p.local && <source type="image/webp" srcSet={p.webp} sizes={sz} />}
      <img src={p.fallback} alt={alt} className="h-full w-full object-cover" loading="lazy" decoding="async" width={size} height={size} sizes={sz} />
    </picture>
  );
}

/** Une illustration détourée, côté React : mêmes déclinaisons qu'Art.astro. */
export function ArtPicture({ name, alt = '', className = '', width, height, sizes }: { name: string; alt?: string; className?: string; width: number; height: number; sizes: string }) {
  const a = artSources(name);
  return (
    <picture className={`block ${className}`}>
      <source type="image/avif" srcSet={a.avif} sizes={sizes} />
      <source type="image/webp" srcSet={a.webp} sizes={sizes} />
      <img src={a.fallback} alt={alt} width={width} height={height} loading="lazy" decoding="async" className="h-full w-full object-contain" aria-hidden={alt ? undefined : 'true'} />
    </picture>
  );
}

interface StepperProps {
  pricing: Pricing;
  qty: number;
  onChange: (qty: number) => void;
  lang: Lang;
  d: Dictionary;
  small?: boolean;
  /** Au-dessous du minimum, le bouton « moins » reste actif et l'appelant retire la ligne. */
  allowBelowMin?: boolean;
  label?: string;
}

/** Sélecteur de quantité : respecte le pas et les bornes du produit. */
export function Stepper({ pricing, qty, onChange, lang, d, small = false, allowBelowMin = false, label }: StepperProps) {
  const step = qtyStep(pricing);
  const { min, max } = qtyBounds(pricing);
  const atMin = qty <= min;
  const atMax = qty >= max;
  const dec = () => {
    if (atMin) {
      if (allowBelowMin) onChange(0);
      return;
    }
    onChange(clampQty(pricing, roundMillimes(qty - step)));
  };
  const inc = () => {
    if (atMax) return;
    onChange(clampQty(pricing, roundMillimes(qty + step)));
  };
  const btn = `stepper-btn ${small ? 'is-small' : ''}`;
  return (
    <div className="stepper" role="group" aria-label={label ?? d.shop.qty}>
      <button type="button" className={btn} onClick={dec} disabled={atMin && !allowBelowMin} aria-label={d.common.decrease}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <span className="stepper-value" aria-live="polite">
        {formatQty(pricing, qty, lang)}
      </span>
      <button type="button" className={btn} onClick={inc} disabled={atMax} aria-label={d.common.increase}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  help?: string;
  type?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  optionalLabel?: string;
  prefix?: string;
  maxLength?: number;
  textarea?: boolean;
  rows?: number;
  counter?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
}

/** Champ de saisie avec label, aide, erreur et attributs ARIA reliés. */
export function TextField(p: FieldProps) {
  const helpId = p.help ? `${p.id}-help` : undefined;
  const errId = p.error ? `${p.id}-error` : undefined;
  const described = [helpId, errId].filter(Boolean).join(' ') || undefined;
  const common = {
    id: p.id,
    name: p.id,
    value: p.value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => p.onChange(e.target.value),
    onBlur: p.onBlur,
    placeholder: p.placeholder,
    'aria-invalid': p.error ? true : undefined,
    'aria-describedby': described,
    'aria-required': p.required || undefined,
    maxLength: p.maxLength,
    dir: p.dir,
  } as const;
  return (
    <div>
      <label htmlFor={p.id} className="label">
        {p.label}
        {p.optionalLabel && <span className="ms-1.5 font-normal text-ink-3">({p.optionalLabel})</span>}
      </label>
      {p.textarea ? (
        <textarea {...common} className="field min-h-28 resize-y" rows={p.rows ?? 3} />
      ) : p.prefix ? (
        <div className="flex">
          <span className="inline-flex items-center rounded-s-md border border-e-0 border-line-2 bg-cream px-3 text-sm font-semibold text-ink-2" aria-hidden="true">
            {p.prefix}
          </span>
          <input {...common} type={p.type ?? 'text'} inputMode={p.inputMode} autoComplete={p.autoComplete} className="field rounded-s-none" />
        </div>
      ) : (
        <input {...common} type={p.type ?? 'text'} inputMode={p.inputMode} autoComplete={p.autoComplete} className="field" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {p.help && !p.error && (
            <p id={helpId} className="help">
              {p.help}
            </p>
          )}
          {p.error && (
            <p id={errId} className="error" role="alert">
              {p.error}
            </p>
          )}
        </div>
        {p.counter && <span className="help shrink-0 tabular">{p.counter}</span>}
      </div>
    </div>
  );
}

export function ErrorBox({ message, retry, retryLabel }: { message: string; retry?: () => void; retryLabel?: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-paprika/30 bg-paprika-soft p-4 text-sm text-ink" role="alert">
      <p className="font-medium">{message}</p>
      {retry && retryLabel && (
        <button type="button" onClick={retry} className="btn-ghost btn-sm">
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function Notice({ children, tone = 'ok' }: { children: ReactNode; tone?: 'ok' | 'warn' }) {
  return (
    <p className={`rounded-md px-4 py-3 text-sm font-medium ${tone === 'ok' ? 'bg-prairie-soft text-prairie-deep' : 'bg-yolk-soft text-yolk-deep'}`} role="status">
      {children}
    </p>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Numéro local lisible : +21651788518 devient 51 788 518. */
export function localPhone(v: string): string {
  const local = v.replace(/^\+216/, '').replace(/^00216/, '');
  if (!/^\d{8}$/.test(local)) return v;
  return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}

/** Jour de la semaine (0 = dimanche) d'une date AAAA-MM-JJ. */
export function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getDay();
}

export function isoToday(offset = 0): string {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
