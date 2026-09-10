import { asset } from '@/lib/paths';

/**
 * Les déclinaisons d'images du site, au même endroit pour Astro et React.
 * Illustrations (fond transparent) : AVIF et WebP à six largeurs, PNG de
 * secours. Photos : AVIF et WebP à quatre largeurs, JPEG de secours.
 * Les fichiers viennent de scripts/art.mjs et scripts/images.mjs.
 */
export const ART_WIDTHS = [320, 480, 640, 960, 1280, 1600] as const;
export const PHOTO_WIDTHS = [480, 768, 1080, 1600] as const;

const set = (stem: string, widths: readonly number[], ext: string) => widths.map((w) => `${asset(`${stem}-${w}.${ext}`)} ${w}w`).join(', ');

export function artSources(name: string) {
  const stem = `/images/art/${name}`;
  return { avif: set(stem, ART_WIDTHS, 'avif'), webp: set(stem, ART_WIDTHS, 'webp'), fallback: asset(`${stem}.png`) };
}

/** `src` est le chemin public de la photo, avec son extension d'origine. */
export function photoSources(src: string) {
  const local = src.startsWith('/images/');
  if (!local) return { avif: '', webp: '', fallback: src, local };
  const stem = src.replace(/\.(jpe?g|png|webp)$/i, '');
  return { avif: set(stem, PHOTO_WIDTHS, 'avif'), webp: set(stem, PHOTO_WIDTHS, 'webp'), fallback: asset(src), local };
}
