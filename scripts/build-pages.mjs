/**
 * Assemble le site public et l'espace de gestion dans un seul dossier `dist/`
 * pour GitHub Pages : la boutique à la racine, l'admin sous /admin/.
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd, env: process.env });

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

run('npm run build', join(root, 'apps/boutique'));
run('npm run build', join(root, 'apps/admin'));

cpSync(join(root, 'apps/boutique/dist'), dist, { recursive: true });
cpSync(join(root, 'apps/admin/dist'), join(dist, 'admin'), { recursive: true });

// GitHub Pages sert 404.html pour toute adresse inconnue. La boutique fournit la sienne.
if (!existsSync(join(dist, '404.html'))) {
  writeFileSync(join(dist, '404.html'), '<!doctype html><meta charset="utf-8"><title>Page introuvable</title><p>Page introuvable.</p>');
}
// Pas de traitement Jekyll : les dossiers commençant par _ doivent passer.
writeFileSync(join(dist, '.nojekyll'), '');
console.log('dist/ prêt : boutique à la racine, gestion sous /admin/.');
