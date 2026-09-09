import type { AdminAuth, AdminDataSource, CustomerAuth, DataEnv, PublicDataSource } from './source';
import { hasSupabase } from './source';
import { createLocalAdminAuth, createLocalAdminSource, createLocalCustomerAuth, createLocalPublicSource } from './local';
import {
  createSupabaseAdminAuth,
  createSupabaseAdminSource,
  createSupabaseCustomerAuth,
  createSupabasePublicSource,
} from './supabase';

/**
 * Point d'entrée unique : avec les clés Supabase on parle à la base, sans
 * elles on tourne en démo. Les écrans n'ont jamais à savoir lequel.
 */
export function createPublicSource(env: DataEnv): PublicDataSource {
  return hasSupabase(env) ? createSupabasePublicSource(env) : createLocalPublicSource();
}

export function createCustomerAuth(env: DataEnv): CustomerAuth {
  return hasSupabase(env) ? createSupabaseCustomerAuth(env) : createLocalCustomerAuth();
}

export function createAdminSource(env: DataEnv): AdminDataSource {
  return hasSupabase(env) ? createSupabaseAdminSource(env) : createLocalAdminSource();
}

export function createAdminAuth(env: DataEnv): AdminAuth {
  return hasSupabase(env) ? createSupabaseAdminAuth(env) : createLocalAdminAuth();
}
