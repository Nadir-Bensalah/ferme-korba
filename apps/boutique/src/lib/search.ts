import type { Lang, Localized, Product, Recipe, Category } from '@ferme/core';

/**
 * Recherche locale : produits, recettes et pages, en français et en arabe.
 * Pas de serveur : tout est dans le navigateur, sur le jeu de données du site.
 */

export type Hit =
  | { kind: 'product'; score: number; product: Product; category?: Category }
  | { kind: 'recipe'; score: number; recipe: Recipe }
  | { kind: 'page'; score: number; page: PageEntry };

export interface PageEntry {
  id: string;
  path: string;
  label: Localized;
  keywords: Localized;
}

/**
 * Ramène un texte à une forme comparable : minuscules, sans accents,
 * arabe sans voyelles courtes, alifs et ta marbouta unifiés.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/œ/g, 'oe')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(q: string): string[] {
  return normalize(q)
    .split(' ')
    .filter((t) => t.length >= 2 || /\p{Script=Arabic}/u.test(t));
}

/** Note d'un champ : le début du nom vaut plus qu'un mot perdu dans la description. */
function scoreField(hay: string, toks: string[], weight: number): number {
  let s = 0;
  for (const t of toks) {
    const i = hay.indexOf(t);
    if (i < 0) return -1;
    s += weight * (i === 0 ? 3 : hay[i - 1] === ' ' ? 2 : 1);
  }
  return s;
}

function best(fields: [string, number][], toks: string[]): number {
  let total = -1;
  for (const [hay, w] of fields) {
    const s = scoreField(hay, toks, w);
    if (s > total) total = s;
  }
  return total;
}

export function search(
  q: string,
  data: { products: Product[]; categories: Category[]; recipes: Recipe[]; pages: PageEntry[] },
  lang: Lang,
  limit = 8,
): { products: Hit[]; recipes: Hit[]; pages: Hit[] } {
  const toks = tokens(q);
  if (!toks.length) return { products: [], recipes: [], pages: [] };
  const other: Lang = lang === 'ar' ? 'fr' : 'ar';
  const cat = new Map(data.categories.map((c) => [c.id, c]));

  const products: Hit[] = [];
  for (const p of data.products) {
    const c = cat.get(p.category_id);
    const s = best(
      [
        [normalize(p.name[lang]), 10],
        [normalize(p.name[other]), 6],
        [normalize(p.short[lang]), 4],
        [normalize(c?.name[lang] ?? ''), 4],
        [normalize(p.description[lang]), 2],
        [normalize(p.slug.replace(/-/g, ' ')), 5],
      ],
      toks,
    );
    if (s >= 0) products.push({ kind: 'product', score: s + (p.is_featured ? 1 : 0) - (p.stock === 'rupture' ? 3 : 0), product: p, category: c });
  }

  const recipes: Hit[] = [];
  for (const r of data.recipes) {
    const s = best(
      [
        [normalize(r.title[lang]), 10],
        [normalize(r.title[other]), 6],
        [normalize(r.intro[lang]), 3],
        [normalize(r.ingredients[lang].join(' ')), 3],
      ],
      toks,
    );
    if (s >= 0) recipes.push({ kind: 'recipe', score: s, recipe: r });
  }

  const pages: Hit[] = [];
  for (const pg of data.pages) {
    const s = best(
      [
        [normalize(pg.label[lang]), 8],
        [normalize(pg.keywords[lang]), 4],
        [normalize(pg.label[other]), 4],
      ],
      toks,
    );
    if (s >= 0) pages.push({ kind: 'page', score: s, page: pg });
  }

  const desc = (a: Hit, b: Hit) => b.score - a.score;
  return {
    products: products.sort(desc).slice(0, limit),
    recipes: recipes.sort(desc).slice(0, 4),
    pages: pages.sort(desc).slice(0, 4),
  };
}
