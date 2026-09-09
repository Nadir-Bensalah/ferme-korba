import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * L'espace de gestion est servi sous /admin/ du même site.
 * BASE_PATH vaut "/ferme-korba" sur GitHub Pages, "" sur un domaine dédié.
 */
const base = `${process.env.BASE_PATH ?? ''}/admin/`;

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  // Le tsconfig déclare @/* : Vite a besoin du même alias pour la construction.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: { port: 4322 },
});
