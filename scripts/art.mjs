/**
 * Décline les illustrations détourées (assets/art, fond transparent) et les
 * photos de ferme (assets/photos) vers apps/boutique/public.
 * Usage : node scripts/art.mjs
 */
import sharp from 'sharp';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const outArt = join(root, 'apps/boutique/public/images/art');
const outFarm = join(root, 'apps/boutique/public/images/farm');
mkdirSync(outArt, { recursive: true });
mkdirSync(outFarm, { recursive: true });

// Illustrations : PNG et WebP, deux tailles, transparence conservée.
for (const f of readdirSync(join(root, 'assets/art')).filter((f) => f.endsWith('.png'))) {
  const name = f.replace(/\.png$/, '');
  const src = join(root, 'assets/art', f);
  for (const w of [400, 800, 1600]) {
    await sharp(src).resize({ width: w, withoutEnlargement: true }).webp({ quality: 88 }).toFile(join(outArt, `${name}-${w}.webp`));
  }
  await sharp(src).resize({ width: 1600, withoutEnlargement: true }).png({ compressionLevel: 9, palette: true, quality: 84 }).toFile(join(outArt, `${name}.png`));
  console.log('art', name);
}

// Photos de ferme ajoutées : mêmes déclinaisons que les autres photos du site.
for (const name of ['ferme-coucher', 'ferme-prairie', 'ferme-cour', 'poules-drole']) {
  const src = join(root, 'assets/photos', `${name}.jpg`);
  const img = sharp(src).rotate();
  await img.clone().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(join(outFarm, `${name}.jpg`));
  for (const w of [480, 960, 1600]) {
    await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 74 }).toFile(join(outFarm, `${name}-${w}.webp`));
  }
  console.log('photo', name);
}
