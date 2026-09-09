import type { Lang } from '@ferme/core';

/**
 * Toutes les adresses passent par ici : le site vit sous /ferme-korba sur
 * GitHub Pages et à la racine sur un domaine dédié. BASE_URL règle ça.
 */
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

export function base(): string {
  return BASE;
}

/** href('fr', '/produits') → '/ferme-korba/produits/' ; href('ar', '/') → '/ferme-korba/ar/' */
export function href(lang: Lang, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const prefixed = lang === 'ar' ? `/ar${clean === '/' ? '' : clean}` : clean;
  const withSlash = prefixed.endsWith('/') ? prefixed : `${prefixed}/`;
  return `${BASE}${withSlash === '/' && BASE ? '/' : withSlash}`;
}

/** Fichier statique : asset('/images/x.jpg') */
export function asset(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${clean}`;
}

/** Même page dans l'autre langue. */
export function switchLangPath(currentPath: string, to: Lang): string {
  let path = currentPath.startsWith(BASE) ? currentPath.slice(BASE.length) : currentPath;
  if (path === '' ) path = '/';
  if (path === '/ar' || path.startsWith('/ar/')) path = path.slice(3) || '/';
  return href(to, path);
}

export const routes = {
  home: '/',
  shop: '/produits',
  category: (slug: string) => `/produits/categorie/${slug}`,
  product: (slug: string) => `/produits/${slug}`,
  farm: '/la-ferme',
  quality: '/qualite',
  recipes: '/recettes',
  recipe: (slug: string) => `/recettes/${slug}`,
  contact: '/contact',
  cart: '/panier',
  checkout: '/commande',
  confirmation: '/confirmation',
  tracking: '/suivi',
  account: '/compte',
  legal: '/mentions-legales',
  terms: '/conditions-de-vente',
  privacy: '/confidentialite',
} as const;

/** Lien WhatsApp avec message pré-rempli. */
export function whatsappLink(phoneE164: string, text?: string): string {
  const n = phoneE164.replace(/[^\d]/g, '');
  return text ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : `https://wa.me/${n}`;
}

export function telLink(phoneE164: string): string {
  return `tel:${phoneE164}`;
}
