const LIGATURES: Record<string, string> = { œ: 'oe', æ: 'ae', ß: 'ss', ø: 'o', đ: 'd', ł: 'l' };

/** « Poulet fermier entier » devient « poulet-fermier-entier ». */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[œæßøđł]/g, (c) => LIGATURES[c] ?? c)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
