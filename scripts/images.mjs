/**
 * Prépare les photos pour le site : JPEG 1600 + WebP 480/960/1600, dans
 * apps/boutique/public/images/{products,recipes,farm}. Source : assets/photos.
 * Usage : node scripts/images.mjs
 */
import sharp from 'sharp';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'assets/photos');
const out = join(root, 'apps/boutique/public/images');

const map = {
  products: ['poulet-entier', 'cuisses-poulet', 'escalope-poulet', 'ailes-poulet', 'pilons-poulet', 'dinde-escalope', 'oeufs', 'merguez', 'saucisses-volaille', 'charcuterie-volaille', 'brochettes', 'poules-plein-air'],
  recipes: ['recette-poulet-roti', 'recette-tajine', 'recette-brochettes', 'recette-omelette'],
  farm: ['hero-ferme', 'fermier', 'poules-plein-air'],
};

const widths = [480, 960, 1600];
for (const [folder, names] of Object.entries(map)) {
  mkdirSync(join(out, folder), { recursive: true });
  for (const name of names) {
    const file = join(src, `${name}.jpg`);
    if (!existsSync(file)) {
      console.warn('manquant :', file);
      continue;
    }
    const img = sharp(file).rotate();
    await img.clone().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(join(out, folder, `${name}.jpg`));
    for (const w of widths) {
      await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 74 }).toFile(join(out, folder, `${name}-${w}.webp`));
    }
    // Vignette floue de 24 px pour l'affichage progressif.
    const tiny = await img.clone().resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
    console.log(folder, name, 'ok', `lqip ${tiny.length} o`);
  }
}
// Image de partage par défaut : le troupeau, recadrée en 1200x630.
mkdirSync(out, { recursive: true });
await sharp(join(src, 'hero-ferme.jpg')).resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 80 }).toFile(join(out, 'og-default.jpg'));
console.log('og-default.jpg ok');
