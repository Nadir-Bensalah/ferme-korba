import type { AdminAuth, AdminDataSource, CustomerAuth, DataEnv, PublicDataSource } from './source';

/**
 * Implémentation Supabase. Le contrat est dans ./source.ts, le schéma dans
 * /supabase/migrations. Cette version est un point de départ : elle sera
 * remplie par le chantier « base de données ». En attendant, elle refuse
 * poliment pour qu'aucun écran ne croie parler à une vraie base.
 */

function notReady(): never {
  throw new Error('supabase_not_configured');
}

export function createSupabasePublicSource(_env: Required<DataEnv>): PublicDataSource {
  return {
    kind: 'supabase',
    listCategories: notReady,
    listProducts: notReady,
    getProduct: notReady,
    listRecipes: notReady,
    getRecipe: notReady,
    listZones: notReady,
    listSlots: notReady,
    getSettings: notReady,
    createOrder: notReady,
    getOrderByToken: notReady,
    sendContact: notReady,
  };
}

export function createSupabaseCustomerAuth(_env: Required<DataEnv>): CustomerAuth {
  return {
    register: notReady,
    login: notReady,
    logout: notReady,
    currentUser: notReady,
    onAuthChange: () => () => {},
    updateProfile: notReady,
    changePassword: notReady,
    listMyOrders: notReady,
  };
}

export function createSupabaseAdminSource(_env: Required<DataEnv>): AdminDataSource {
  return new Proxy({ kind: 'supabase' } as AdminDataSource, {
    get(target, prop) {
      if (prop === 'kind') return target.kind;
      if (prop === 'onNewOrder') return () => () => {};
      return notReady;
    },
  });
}

export function createSupabaseAdminAuth(_env: Required<DataEnv>): AdminAuth {
  return {
    login: notReady,
    logout: notReady,
    currentAdmin: notReady,
    onAuthChange: () => () => {},
  };
}
