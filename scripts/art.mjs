/**
 * Décline les illustrations détourées (assets/art, fond transparent) et les
 * photos de ferme (assets/photos) vers apps/boutique/public.
 *
 * Chaque illustration sort en AVIF et en WebP à six largeurs, plus un PNG de
 * secours : le navigateur prend le format qu'il sait lire et la taille la
 * plus proche de l'affichage, jamais plus.
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

export const ART_WIDTHS = [320, 480, 640, 960, 1280, 1600];
const AVIF = { quality: 62, effort: 4 };
const WEBP = { quality: 82, alphaQuality: 90 };

async function variants(src, name) {
  const meta = await sharp(src).metadata();
  for (const w of ART_WIDTHS) {
    if (w > meta.width && w !== ART_WIDTHS[0]) {
      // Pas d'agrandissement : on copie la plus grande taille réelle sous ce nom.
      await sharp(src).webp(WEBP).toFile(join(outArt, `${name}-${w}.webp`));
      await sharp(src).avif(AVIF).toFile(join(outArt, `${name}-${w}.avif`));
      continue;
    }
    await sharp(src).resize({ width: w, withoutEnlargement: true }).webp(WEBP).toFile(join(outArt, `${name}-${w}.webp`));
    await sharp(src).resize({ width: w, withoutEnlargement: true }).avif(AVIF).toFile(join(outArt, `${name}-${w}.avif`));
  }
  await sharp(src).resize({ width: 1600, withoutEnlargement: true }).png({ compressionLevel: 9, palette: true, quality: 84 }).toFile(join(outArt, `${name}.png`));
}

for (const f of readdirSync(join(root, 'assets/art')).filter((f) => f.endsWith('.png'))) {
  const name = f.replace(/\.png$/, '');
  await variants(join(root, 'assets/art', f), name);
  console.log('art', name);
}

// Le paysage du pied de page en panorama : l'image d'origine encadrée de deux
// copies en miroir, pour couvrir n'importe quelle largeur d'écran sans jamais
// rogner le haut des arbres (object-fit: cover ne coupe alors que les côtés).
{
  const src = join(root, 'assets/art/footer-collines.png');
  const meta = await sharp(src).metadata();
  const flipped = await sharp(src).flop().png().toBuffer();
  const pano = sharp({ create: { width: meta.width * 3, height: meta.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([
    { input: flipped, left: 0, top: 0 },
    { input: src, left: meta.width, top: 0 },
    { input: flipped, left: meta.width * 2, top: 0 },
  ]);
  const buf = await pano.png().toBuffer();
  for (const w of [1600, 3200, 4800]) {
    await sharp(buf).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(join(outArt, `footer-collines-pano-${w}.webp`));
    await sharp(buf).resize({ width: w, withoutEnlargement: true }).avif({ quality: 55, effort: 4 }).toFile(join(outArt, `footer-collines-pano-${w}.avif`));
  }
  await sharp(buf).resize({ width: 3200, withoutEnlargement: true }).png({ compressionLevel: 9, palette: true, quality: 84 }).toFile(join(outArt, 'footer-collines-pano.png'));
  console.log('art footer-collines-pano');
}

// Photos de ferme ajoutées : mêmes déclinaisons que les autres photos du site.
for (const name of ['ferme-coucher', 'ferme-prairie', 'ferme-cour', 'poules-drole']) {
  const src = join(root, 'assets/photos', `${name}.jpg`);
  const img = sharp(src).rotate();
  await img.clone().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(join(outFarm, `${name}.jpg`));
  for (const w of [480, 768, 1080, 1600]) {
    await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 74 }).toFile(join(outFarm, `${name}-${w}.webp`));
    await img.clone().resize({ width: w, withoutEnlargement: true }).avif({ quality: 52, effort: 4 }).toFile(join(outFarm, `${name}-${w}.avif`));
  }
  console.log('photo', name);
}
