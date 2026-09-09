import type {
  AddressInput,
  Category,
  CustomerProfile,
  DashboardStats,
  DeliverySlot,
  DeliveryZone,
  Offer,
  Order,
  OrderInput,
  OrderStatus,
  OrderSummaryForCustomer,
  Product,
  Recipe,
  Settings,
} from '../types';

/**
 * Contrat unique entre les écrans et les données.
 * Deux implémentations : `local` (jeu de démo dans le navigateur) et
 * `supabase` (la vraie base). Les écrans ne savent pas laquelle tourne.
 */

export interface PublicDataSource {
  readonly kind: 'local' | 'supabase';
  listCategories(): Promise<Category[]>;
  listProducts(opts?: { category?: string; featured?: boolean }): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | null>;
  listRecipes(): Promise<Recipe[]>;
  getRecipe(slug: string): Promise<Recipe | null>;
  listZones(): Promise<DeliveryZone[]>;
  listSlots(): Promise<DeliverySlot[]>;
  getSettings(): Promise<Settings>;
  /** Offres actives, dans l'ordre d'affichage. */
  listOffers(): Promise<Offer[]>;
  /** Crée une commande. Le serveur recalcule tout, le client n'envoie que des quantités. */
  createOrder(input: OrderInput): Promise<{ number: string; tracking_token: string }>;
  /** Suivi sans compte : numéro + jeton secret. */
  getOrderByToken(number: string, token: string): Promise<OrderSummaryForCustomer | null>;
  /** Message du formulaire de contact. */
  sendContact(input: { name: string; phone: string; message: string }): Promise<void>;
  /** Inscription à la lettre d'information. Doublon = succès silencieux. */
  subscribeNewsletter(email: string, lang: 'fr' | 'ar'): Promise<void>;
}

export interface CustomerAuth {
  register(input: { name: string; phone: string; email?: string; password: string }): Promise<CustomerProfile>;
  login(input: { phone: string; password: string }): Promise<CustomerProfile>;
  logout(): Promise<void>;
  currentUser(): Promise<CustomerProfile | null>;
  onAuthChange(cb: (user: CustomerProfile | null) => void): () => void;
  updateProfile(patch: { name?: string; email?: string | null; default_address?: AddressInput | null }): Promise<CustomerProfile>;
  changePassword(newPassword: string): Promise<void>;
  /** Commandes du client connecté. */
  listMyOrders(): Promise<OrderSummaryForCustomer[]>;
}

export interface AdminAuth {
  login(input: { email: string; password: string }): Promise<{ id: string; email: string; name: string }>;
  logout(): Promise<void>;
  currentAdmin(): Promise<{ id: string; email: string; name: string } | null>;
  onAuthChange(cb: (admin: { id: string; email: string; name: string } | null) => void): () => void;
}

export interface OrderFilters {
  status?: OrderStatus | 'actives';
  date_from?: string;
  date_to?: string;
  delivery_date?: string;
  zone_id?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export interface AdminDataSource {
  readonly kind: 'local' | 'supabase';
  stats(): Promise<DashboardStats>;
  listOrders(filters?: OrderFilters): Promise<{ rows: Order[]; total: number }>;
  getOrder(id: string): Promise<Order | null>;
  setOrderStatus(id: string, status: OrderStatus, note?: string): Promise<Order>;
  /** Saisie de la pesée réelle, ligne par ligne, puis recalcul du total final. */
  setWeighed(id: string, lines: { item_id: string; weighed_kg: number | null }[]): Promise<Order>;
  updateOrderNotes(id: string, notes: string): Promise<Order>;
  /** Abonnement aux nouvelles commandes (temps réel). Retourne la fonction de désabonnement. */
  onNewOrder(cb: (order: Order) => void): () => void;

  listProducts(): Promise<Product[]>;
  upsertProduct(p: Product): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  setStock(id: string, stock: Product['stock']): Promise<void>;
  uploadImage(file: File, path: string): Promise<string>;

  listCategories(): Promise<Category[]>;
  upsertCategory(c: Category): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  listRecipes(): Promise<Recipe[]>;
  upsertRecipe(r: Recipe): Promise<Recipe>;
  deleteRecipe(id: string): Promise<void>;

  listOffers(): Promise<Offer[]>;
  upsertOffer(o: Offer): Promise<Offer>;
  deleteOffer(id: string): Promise<void>;

  listZones(): Promise<DeliveryZone[]>;
  upsertZone(z: DeliveryZone): Promise<DeliveryZone>;
  deleteZone(id: string): Promise<void>;
  listSlots(): Promise<DeliverySlot[]>;
  upsertSlot(s: DeliverySlot): Promise<DeliverySlot>;
  deleteSlot(id: string): Promise<void>;

  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<Settings>;

  listCustomers(q?: string): Promise<(CustomerProfile & { orders_count: number; total_spent: number })[]>;
  listContactMessages(): Promise<{ id: string; name: string; phone: string; message: string; created_at: string; read: boolean }[]>;
  markContactRead(id: string): Promise<void>;
}

export interface DataEnv {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export function hasSupabase(env: DataEnv): env is Required<DataEnv> {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
