/**
 * Types partagés entre la boutique, l'espace de gestion et la base.
 * Tout ce qui est visible par le client existe en français et en arabe.
 */

export type Lang = 'fr' | 'ar';

export type Localized = { fr: string; ar: string };

export type StockStatus = 'en_stock' | 'bientot' | 'rupture';

export type CategorySlug =
  | 'volailles-entieres'
  | 'decoupes'
  | 'dinde'
  | 'oeufs'
  | 'charcuterie'
  | 'marines';

export interface Category {
  id: string;
  slug: CategorySlug | string;
  name: Localized;
  description: Localized;
  image: string;
  sort: number;
}

/**
 * Trois façons de vendre :
 * - per_piece : prix fixe à la pièce (une boîte d'œufs, un paquet de jambon).
 * - per_kg_estimated : le client choisit un nombre de pièces, chaque pièce a un
 *   poids estimé, le prix final est ajusté à la pesée (un poulet entier).
 * - per_kg : le client choisit un poids, par pas (500 g d'escalopes).
 */
export type Pricing =
  | { mode: 'per_piece'; price: number; min_qty?: number; max_qty?: number }
  | {
      mode: 'per_kg_estimated';
      price_per_kg: number;
      est_weight_kg: number;
      min_weight_kg?: number;
      max_weight_kg?: number;
      min_qty?: number;
      max_qty?: number;
    }
  | { mode: 'per_kg'; price_per_kg: number; step_kg: number; min_kg: number; max_kg?: number };

export type Badge = 'fermier' | 'nouveau' | 'promo' | 'best';

export interface Product {
  id: string;
  slug: string;
  category_id: string;
  name: Localized;
  short: Localized;
  description: Localized;
  images: string[];
  pricing: Pricing;
  /** Prix barré, uniquement pour afficher une promo. Même unité que le prix. */
  compare_at?: number;
  badges: Badge[];
  stock: StockStatus;
  is_featured: boolean;
  sort: number;
  /** Conservation, origine, conseils : texte libre court. */
  tips?: Localized;
  updated_at?: string;
}

export interface Recipe {
  id: string;
  slug: string;
  title: Localized;
  intro: Localized;
  image: string;
  duration_min: number;
  servings: number;
  difficulty: 1 | 2 | 3;
  ingredients: { fr: string[]; ar: string[] };
  steps: { fr: string[]; ar: string[] };
  /** Produits de la boutique utilisés, pour le bouton « Ajouter les ingrédients ». */
  product_slugs: string[];
}

export interface DeliveryZone {
  id: string;
  name: Localized;
  /** Villes ou quartiers couverts, pour aider le client à se situer. */
  areas: Localized;
  fee: number;
  /** Livraison offerte à partir de ce montant de produits. 0 = jamais. */
  free_from: number;
  /** Délai indicatif en jours : 0 = le jour même, 1 = le lendemain. */
  lead_days: number;
  active: boolean;
  sort: number;
}

export interface DeliverySlot {
  id: string;
  label: Localized;
  from: string; // "09:00"
  to: string; // "12:00"
  /** 0 = dimanche … 6 = samedi, jours où le créneau existe. */
  days: number[];
  active: boolean;
  sort: number;
}

export interface Settings {
  shop_open: boolean;
  /** Message affiché en bandeau quand il n'est pas vide. */
  announcement: Localized;
  min_order: number;
  /** Nombre de jours à l'avance qu'on peut choisir pour la livraison. */
  max_days_ahead: number;
  /** Heure limite pour être livré le lendemain (ex. "18:00"). */
  cutoff_time: string;
  /** Jours fermés : 0 = dimanche … 6 = samedi. */
  closed_days: number[];
  updated_at?: string;
}

export type OrderStatus =
  | 'nouvelle'
  | 'confirmee'
  | 'en_preparation'
  | 'en_livraison'
  | 'livree'
  | 'annulee'
  | 'refusee';

export const ORDER_STATUSES: OrderStatus[] = [
  'nouvelle',
  'confirmee',
  'en_preparation',
  'en_livraison',
  'livree',
  'annulee',
  'refusee',
];

export interface OrderItemInput {
  product_id: string;
  /** Pièces ou kilos selon le mode de vente du produit. */
  qty: number;
}

export interface OrderItem extends OrderItemInput {
  id: string;
  /** Instantané du produit au moment de la commande. */
  name: Localized;
  slug: string;
  image: string;
  pricing: Pricing;
  /** Montant estimé de la ligne au moment de la commande. */
  line_total: number;
  /** Poids réel saisi à la pesée par l'espace de gestion, si le produit se vend au kilo. */
  weighed_kg?: number | null;
  /** Montant final après pesée, sinon égal à line_total. */
  final_total?: number | null;
}

export interface CustomerInput {
  name: string;
  phone: string; // normalisé en +216XXXXXXXX
  email?: string;
}

export interface AddressInput {
  zone_id: string;
  street: string;
  city: string;
  landmark?: string;
}

export interface OrderInput {
  lang: Lang;
  customer: CustomerInput;
  address: AddressInput;
  delivery_date: string; // AAAA-MM-JJ
  slot_id: string;
  items: OrderItemInput[];
  notes?: string;
  /** Identifiant du compte client si connecté. */
  customer_user_id?: string | null;
  /** Champ piège anti-robot : doit rester vide. */
  website?: string;
}

export interface StatusEvent {
  status: OrderStatus;
  at: string;
  note?: string;
  by?: string;
}

export interface Order {
  id: string;
  /** Numéro lisible : FK-2026-00042 */
  number: string;
  status: OrderStatus;
  lang: Lang;
  customer: CustomerInput;
  address: AddressInput & { zone_name: Localized };
  delivery_date: string;
  slot: { id: string; label: Localized; from: string; to: string };
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  /** Total final après pesée, renseigné à la livraison. */
  final_total?: number | null;
  payment: 'cod';
  notes?: string;
  /** Jeton secret pour suivre la commande sans compte. */
  tracking_token: string;
  history: StatusEvent[];
  customer_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderSummaryForCustomer {
  number: string;
  status: OrderStatus;
  delivery_date: string;
  slot: Order['slot'];
  items: Pick<OrderItem, 'name' | 'qty' | 'pricing' | 'line_total' | 'image' | 'slug'>[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  final_total?: number | null;
  history: StatusEvent[];
  created_at: string;
  address: Order['address'];
  customer: Pick<CustomerInput, 'name' | 'phone'>;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  default_address?: AddressInput | null;
  created_at: string;
}

export interface DashboardStats {
  today_orders: number;
  today_revenue: number;
  pending: number;
  week_orders: number;
  week_revenue: number;
  month_revenue: number;
  low_stock: number;
  top_products: { product_id: string; name: Localized; qty: number }[];
  /** 14 derniers jours, pour la petite courbe. */
  daily: { date: string; orders: number; revenue: number }[];
}
