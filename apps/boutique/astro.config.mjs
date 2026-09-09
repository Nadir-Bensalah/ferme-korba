// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/**
 * BASE_PATH : "/ferme-korba" sur GitHub Pages, "" sur un domaine dédié.
 * SITE_URL : origine publique, sert au sitemap, aux liens canoniques et au partage.
 */
const base = process.env.BASE_PATH ?? '';
const site = process.env.SITE_URL ?? 'https://nadir-bensalah.github.io';

export default defineConfig({
  site,
  base: base || undefined,
  trailingSlash: 'ignore',
  output: 'static',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'ar'],
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
  },
  integrations: [react(), sitemap({ i18n: { defaultLocale: 'fr', locales: { fr: 'fr-TN', ar: 'ar-TN' } } })],
  vite: {
    plugins: [tailwindcss()],
    build: { cssMinify: 'lightningcss' },
  },
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  compressHTML: true,
});
