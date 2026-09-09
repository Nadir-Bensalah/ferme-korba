/** Décline le logo (assets/logo.png, fond transparent) en tailles utiles. */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'assets/logo.png');
const pub = join(root, 'apps/boutique/public');
const adm = join(root, 'apps/admin/public');
mkdirSync(join(pub, 'icons'), { recursive: true });
mkdirSync(adm, { recursive: true });
const trimmed = sharp(src).trim();
const buf = await trimmed.png().toBuffer();
for (const [w, name] of [[96, 'logo-96.png'], [192, 'logo-192.png'], [512, 'logo-512.png']]) {
  await sharp(buf).resize(w, w, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(join(pub, name));
  await sharp(buf).resize(w, w, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 }).toFile(join(pub, name.replace('.png', '.webp')));
}
await sharp(buf).resize(64, 64).png().toFile(join(pub, 'favicon.png'));
await sharp(buf).resize(96, 96).png().toFile(join(adm, 'logo-96.png'));
await sharp(buf).resize(64, 64).png().toFile(join(adm, 'favicon.png'));
// Icônes PWA : fond crème plein, logo un peu en retrait, et une version « maskable » avec plus de marge.
for (const [name, size, pad] of [['icon-192.png', 192, 0.08], ['icon-512.png', 512, 0.08], ['apple-touch-icon.png', 180, 0.1], ['icon-512-maskable.png', 512, 0.18]]) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(buf).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#fbf7ee' } }).composite([{ input: logo, gravity: 'centre' }]).png().toFile(join(pub, 'icons', name));
}
console.log('logo décliné');
