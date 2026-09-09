import { createAdminAuth, createAdminSource, type AdminAuth, type AdminDataSource, type DataEnv } from '@ferme/core';

/**
 * Une seule instance de la source de données et de l'authentification.
 * Avec les clés Supabase on parle à la base, sans elles c'est la démo.
 */
const env: DataEnv = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

export const source: AdminDataSource = createAdminSource(env);
export const auth: AdminAuth = createAdminAuth(env);
export const isDemo = source.kind === 'local';

export const DEMO_CREDENTIALS = { email: 'demo@ferme-korba.tn', password: 'demo1234' } as const;

export const APP_TITLE = 'Gestion · Ferme Korba';
