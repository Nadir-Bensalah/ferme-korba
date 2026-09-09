#!/usr/bin/env node
/**
 * Génère supabase/seed.sql depuis packages/core/src/seed.ts.
 *
 *   node scripts/seed-sql.mjs
 *
 * Le seed TypeScript est la seule source de vérité : ce script le lit (avec tsx
 * s'il est installé, sinon avec le support TypeScript natif de Node 22+) et écrit
 * des `insert … on conflict do update`, rejouables sans risque.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const seedTs = resolve(root, 'packages/core/src/seed.ts');
const out = resolve(root, 'supabase/seed.sql');

async function loadSeed() {
  // 1. tsx, si le projet ou la machine l'a.
  try {
    const { register } = await import('tsx/esm/api');
    const unregister = register();
    try {
      return (await import(pathToFileURL(seedTs).href)).seed;
    } finally {
      unregister();
    }
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
  }
  // 2. Node 22+ : import direct si le support TypeScript est actif, sinon on se relance avec le drapeau.
  try {
    return (await import(pathToFileURL(seedTs).href)).seed;
  } catch (err) {
    if (err?.code !== 'ERR_UNKNOWN_FILE_EXTENSION' || process.env.SEED_SQL_RELAUNCHED) throw err;
  }
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url)], {
    stdio: 'inherit',
    env: { ...process.env, SEED_SQL_RELAUNCHED: '1' },
  });
  process.exit(r.status ?? 1);
}

/** Chaîne SQL : apostrophes doublées, jamais d'échappement C. */
const str = (v) => `'${String(v).replace(/'/g, "''")}'`;
const json = (v) => `${str(JSON.stringify(v))}::jsonb`;
const num = (v) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`nombre attendu, reçu ${JSON.stringify(v)}`);
  return String(v);
};
const bool = (v) => (v ? 'true' : 'false');
const textArray = (arr) => (arr.length ? `array[${arr.map(str).join(', ')}]::text[]` : `'{}'::text[]`);
const intArray = (arr) => (arr.length ? `array[${arr.map(num).join(', ')}]::integer[]` : `'{}'::integer[]`);
const nullable = (v, f) => (v === undefined || v === null ? 'null' : f(v));

/** insert … on conflict (id) do update set … pour une ligne { colonne: expressionSQL }. */
function upsert(table, row, conflict = 'id') {
  const cols = Object.keys(row);
  const sets = cols.filter((c) => c !== conflict).map((c) => `${c} = excluded.${c}`);
  return `insert into public.${table} (${cols.join(', ')})\nvalues (${cols.map((c) => row[c]).join(', ')})\non conflict (${conflict}) do update set ${sets.join(', ')};`;
}

function render(seed) {
  const lines = [
    '-- Jeu de données de départ, GÉNÉRÉ par scripts/seed-sql.mjs depuis packages/core/src/seed.ts.',
    '-- Ne pas modifier à la main : relancer `node scripts/seed-sql.mjs`.',
    '-- Rejouable : chaque ligne est insérée ou mise à jour (on conflict do update).',
    '',
    'begin;',
    '',
    '-- Catégories',
  ];
  for (const c of seed.categories) {
    lines.push(
      upsert('categories', {
        id: str(c.id),
        slug: str(c.slug),
        name: json(c.name),
        description: json(c.description),
        image: str(c.image),
        sort: num(c.sort),
      }),
    );
  }
  lines.push('', '-- Produits');
  for (const p of seed.products) {
    lines.push(
      upsert('products', {
        id: str(p.id),
        slug: str(p.slug),
        category_id: str(p.category_id),
        name: json(p.name),
        short: json(p.short),
        description: json(p.description),
        images: textArray(p.images),
        pricing: json(p.pricing),
        compare_at: nullable(p.compare_at, num),
        badges: textArray(p.badges),
        stock: str(p.stock),
        is_featured: bool(p.is_featured),
        sort: num(p.sort),
        tips: nullable(p.tips, json),
      }),
    );
  }
  lines.push('', '-- Recettes');
  for (const r of seed.recipes) {
    lines.push(
      upsert('recipes', {
        id: str(r.id),
        slug: str(r.slug),
        title: json(r.title),
        intro: json(r.intro),
        image: str(r.image),
        duration_min: num(r.duration_min),
        servings: num(r.servings),
        difficulty: num(r.difficulty),
        ingredients: json(r.ingredients),
        steps: json(r.steps),
        product_slugs: textArray(r.product_slugs),
      }),
    );
  }
  lines.push('', '-- Zones de livraison');
  for (const z of seed.zones) {
    lines.push(
      upsert('delivery_zones', {
        id: str(z.id),
        name: json(z.name),
        areas: json(z.areas),
        fee: num(z.fee),
        free_from: num(z.free_from),
        lead_days: num(z.lead_days),
        active: bool(z.active),
        sort: num(z.sort),
      }),
    );
  }
  lines.push('', '-- Créneaux de livraison');
  for (const s of seed.slots) {
    lines.push(
      upsert('delivery_slots', {
        id: str(s.id),
        label: json(s.label),
        slot_from: str(s.from),
        slot_to: str(s.to),
        days: intArray(s.days),
        active: bool(s.active),
        sort: num(s.sort),
      }),
    );
  }
  lines.push('', '-- Offres');
  for (const o of seed.offers) {
    lines.push(
      upsert('offers', {
        id: str(o.id),
        kind: str(o.kind),
        eyebrow: json(o.eyebrow),
        title: json(o.title),
        subtitle: json(o.subtitle),
        badge: json(o.badge),
        price: nullable(o.price, num),
        compare_at: nullable(o.compare_at, num),
        image: str(o.image),
        cta: json(o.cta),
        link: str(o.link),
        ends_at: nullable(o.ends_at, (v) => `${str(v)}::timestamptz`),
        product_slugs: textArray(o.product_slugs),
        active: bool(o.active),
        sort: num(o.sort),
      }),
    );
  }
  const st = seed.settings;
  lines.push(
    '',
    '-- Réglages (une seule ligne, id = 1)',
    upsert('settings', {
      id: '1',
      shop_open: bool(st.shop_open),
      announcement: json(st.announcement),
      min_order: num(st.min_order),
      max_days_ahead: num(st.max_days_ahead),
      cutoff_time: str(st.cutoff_time),
      closed_days: intArray(st.closed_days),
    }),
    '',
    'commit;',
    '',
  );
  return lines.join('\n');
}

const seed = await loadSeed();
const sql = render(seed);
writeFileSync(out, sql, 'utf8');
console.log(
  `supabase/seed.sql écrit : ${seed.categories.length} catégories, ${seed.products.length} produits, ` +
    `${seed.recipes.length} recettes, ${seed.offers.length} offres, ${seed.zones.length} zones, ${seed.slots.length} créneaux.`,
);
