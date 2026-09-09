import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { OrderFilters } from '@ferme/core';
import { source } from './data';

/** Clés stables : une liste par ressource, un détail par identifiant. */
export const qk = {
  stats: ['stats'] as const,
  orders: (f: OrderFilters = {}) => ['orders', f] as const,
  order: (id: string) => ['order', id] as const,
  products: ['products'] as const,
  categories: ['categories'] as const,
  recipes: ['recipes'] as const,
  zones: ['zones'] as const,
  slots: ['slots'] as const,
  settings: ['settings'] as const,
  customers: (q: string) => ['customers', q] as const,
  messages: ['messages'] as const,
};

export const useStats = () => useQuery({ queryKey: qk.stats, queryFn: () => source.stats() });
export const useOrders = (f: OrderFilters, enabled = true) =>
  useQuery({ queryKey: qk.orders(f), queryFn: () => source.listOrders(f), enabled, placeholderData: (prev) => prev });
export const useOrder = (id: string) => useQuery({ queryKey: qk.order(id), queryFn: () => source.getOrder(id), enabled: Boolean(id) });
export const useProducts = () => useQuery({ queryKey: qk.products, queryFn: () => source.listProducts() });
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: () => source.listCategories() });
export const useRecipes = () => useQuery({ queryKey: qk.recipes, queryFn: () => source.listRecipes() });
export const useZones = () => useQuery({ queryKey: qk.zones, queryFn: () => source.listZones() });
export const useSlots = () => useQuery({ queryKey: qk.slots, queryFn: () => source.listSlots() });
export const useSettings = () => useQuery({ queryKey: qk.settings, queryFn: () => source.getSettings() });
export const useCustomers = (q: string) => useQuery({ queryKey: qk.customers(q), queryFn: () => source.listCustomers(q || undefined) });
export const useMessages = () => useQuery({ queryKey: qk.messages, queryFn: () => source.listContactMessages() });

/** Compteur des commandes à confirmer, pour la pastille de navigation. */
export const useNewOrdersCount = () =>
  useQuery({
    queryKey: qk.orders({ status: 'nouvelle', page: 1, page_size: 1 }),
    queryFn: () => source.listOrders({ status: 'nouvelle', page: 1, page_size: 1 }),
    select: (r) => r.total,
    refetchInterval: 60_000,
  });

/** Tout ce qui dépend des commandes bouge ensemble. */
export function invalidateOrders(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['orders'] });
  void qc.invalidateQueries({ queryKey: ['order'] });
  void qc.invalidateQueries({ queryKey: qk.stats });
  void qc.invalidateQueries({ queryKey: ['customers'] });
}
