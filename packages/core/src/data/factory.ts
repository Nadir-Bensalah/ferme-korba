import type { AdminAuth, AdminDataSource, CustomerAuth, DataEnv, PublicDataSource } from './source';
import { hasSupabase } from './source';
import { createLocalAdminAuth, createLocalAdminSource, createLocalCustomerAuth, createLocalPublicSource } from './local';
import { createSupabaseAdminAuth, createSupabaseAdminSource } from './supabase';

/**
 * Point d'entrée unique : avec les clés Supabase on parle à la base, sans
 * elles on tourne en démo. Les écrans n'ont jamais à savoir lequel.
 *
 * Côté boutique, le client Supabase (lourd) n'est chargé qu'au premier appel,
 * et seulement si les clés existent : les pages sans base n'en paient rien.
 */
type Loader<T> = () => Promise<T>;

/** Un objet dont chaque méthode attend le vrai module avant de s'exécuter. */
function lazy<T extends object>(load: Loader<T>): T {
  let pending: Promise<T> | null = null;
  const get = () => (pending ??= load());
  return new Proxy({} as T, {
    get(_, key) {
      if (key === 'onAuthChange') {
        return (cb: (u: unknown) => void) => {
          let off: (() => void) | null = null;
          let gone = false;
          get().then((s) => {
            if (gone) return;
            off = (s as unknown as { onAuthChange: (cb: (u: unknown) => void) => () => void }).onAuthChange(cb);
          });
          return () => {
            gone = true;
            off?.();
          };
        };
      }
      return (...args: unknown[]) => get().then((s) => (s as unknown as Record<PropertyKey, (...a: unknown[]) => unknown>)[key]!(...args));
    },
  });
}

export function createPublicSource(env: DataEnv): PublicDataSource {
  return hasSupabase(env) ? lazy(() => import('./supabase').then((m) => m.createSupabasePublicSource(env))) : createLocalPublicSource();
}

export function createCustomerAuth(env: DataEnv): CustomerAuth {
  return hasSupabase(env) ? lazy(() => import('./supabase').then((m) => m.createSupabaseCustomerAuth(env))) : createLocalCustomerAuth();
}

export function createAdminSource(env: DataEnv): AdminDataSource {
  return hasSupabase(env) ? createSupabaseAdminSource(env) : createLocalAdminSource();
}

export function createAdminAuth(env: DataEnv): AdminAuth {
  return hasSupabase(env) ? createSupabaseAdminAuth(env) : createLocalAdminAuth();
}
