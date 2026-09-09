/** Icônes PWA et Apple à partir du favicon SVG. Usage : node scripts/icons.mjs */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const svg = readFileSync(join(root, 'apps/boutique/public/favicon.svg'));
const out = join(root, 'apps/boutique/public/icons');
mkdirSync(out, { recursive: true });

for (const [name, size, pad] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
  ['icon-512-maskable.png', 512, 0.1],
]) {
  const inner = Math.round(size * (1 - pad * 2));
  const icon = await sharp(svg).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#1e7a3c' } })
    .composite([{ input: icon, gravity: 'centre' }])
    .png()
    .toFile(join(out, name));
  console.log(name, size);
}
