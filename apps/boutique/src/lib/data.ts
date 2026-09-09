import { createCustomerAuth, createPublicSource, type CustomerAuth, type PublicDataSource } from '@ferme/core';

/**
 * Source de données côté navigateur. Avec les clés PUBLIC_SUPABASE_*, on parle
 * à la base ; sans, on tourne en démo dans le navigateur.
 */
const env = {
  supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined,
};

let publicSource: PublicDataSource | null = null;
let customerAuth: CustomerAuth | null = null;

export function data(): PublicDataSource {
  if (!publicSource) publicSource = createPublicSource(env);
  return publicSource;
}

export function auth(): CustomerAuth {
  if (!customerAuth) customerAuth = createCustomerAuth(env);
  return customerAuth;
}

export const isDemo = !env.supabaseUrl || !env.supabaseAnonKey;
