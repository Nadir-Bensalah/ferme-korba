import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AddressInput,
  Category,
  CustomerProfile,
  DashboardStats,
  DeliverySlot,
  DeliveryZone,
  Localized,
  Order,
  OrderInput,
  OrderItem,
  OrderStatus,
  OrderSummaryForCustomer,
  Pricing,
  Product,
  Recipe,
  Settings,
  StatusEvent,
} from '../types';
import type { AdminAuth, AdminDataSource, CustomerAuth, DataEnv, OrderFilters, PublicDataSource } from './source';
import { ACTIVE_STATUSES, OrderError } from '../orders';

/**
 * Implémentation Supabase du contrat ./source.ts.
 * Le schéma est dans /supabase/migrations : les colonnes sont mappées ici vers
 * les types de ../types.ts, et rien d'autre ne connaît la forme des tables.
 *
 * Règles :
 *   - un seul client par URL, partagé entre les quatre fabriques ;
 *   - aucune écriture directe côté boutique : commandes et messages passent par
 *     les fonctions SQL (create_order, send_contact) ;
 *   - les erreurs des fonctions remontent avec un code court dans message,
 *     transformé ici en OrderError ou en Error lisible.
 */

// ---------------------------------------------------------------------------
// Client partagé
// ---------------------------------------------------------------------------

const clients = new Map<string, SupabaseClient>();

export function getSupabaseClient(env: Required<DataEnv>): SupabaseClient {
  const key = `${env.supabaseUrl} ${env.supabaseAnonKey}`;
  let c = clients.get(key);
  if (!c) {
    c = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    clients.set(key, c);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Formes des lignes en base (colonnes) et mappage vers les types du contrat
// ---------------------------------------------------------------------------

export interface CategoryRow {
  id: string;
  slug: string;
  name: Localized;
  description: Localized;
  image: string;
  sort: number;
}

export interface ProductRow {
  id: string;
  slug: string;
  category_id: string;
  name: Localized;
  short: Localized;
  description: Localized;
  images: string[] | null;
  pricing: Pricing;
  compare_at: number | string | null;
  badges: string[] | null;
  stock: string;
  is_featured: boolean;
  sort: number;
  tips: Localized | null;
  updated_at?: string | null;
}

export interface RecipeRow {
  id: string;
  slug: string;
  title: Localized;
  intro: Localized;
  image: string;
  duration_min: number;
  servings: number;
  difficulty: number;
  ingredients: { fr: string[]; ar: string[] };
  steps: { fr: string[]; ar: string[] };
  product_slugs: string[] | null;
}

export interface ZoneRow {
  id: string;
  name: Localized;
  areas: Localized;
  fee: number | string;
  free_from: number | string;
  lead_days: number;
  active: boolean;
  sort: number;
}

export interface SlotRow {
  id: string;
  label: Localized;
  slot_from: string;
  slot_to: string;
  days: number[] | null;
  active: boolean;
  sort: number;
}

export interface SettingsRow {
  shop_open: boolean;
  announcement: Localized;
  min_order: number | string;
  max_days_ahead: number;
  cutoff_time: string;
  closed_days: number[] | null;
  updated_at?: string | null;
}

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  default_address: AddressInput | null;
  created_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id?: string;
  sort?: number;
  product_id: string;
  name: Localized;
  slug: string;
  image: string;
  pricing: Pricing;
  qty: number | string;
  line_total: number | string;
  weighed_kg: number | string | null;
  final_total: number | string | null;
}

export interface OrderEventRow {
  id?: number;
  status: OrderStatus;
  at: string;
  note: string | null;
  by: string | null;
}

export interface OrderRow {
  id: string;
  number: string;
  status: OrderStatus;
  lang: 'fr' | 'ar';
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_user_id: string | null;
  zone_id: string;
  zone_name: Localized;
  street: string;
  city: string;
  landmark: string | null;
  delivery_date: string;
  slot_id: string;
  slot_label: Localized;
  slot_from: string;
  slot_to: string;
  subtotal: number | string;
  delivery_fee: number | string;
  total: number | string;
  final_total: number | string | null;
  payment: string;
  notes: string | null;
  tracking_token: string;
  created_at: string;
  updated_at: string;
  order_items?: OrderItemRow[] | null;
  order_events?: OrderEventRow[] | null;
}

export interface ContactRow {
  id: string;
  name: string;
  phone: string;
  message: string;
  created_at: string;
  read: boolean;
}

/** Postgres peut renvoyer un numeric en chaîne : on ramène toujours à un nombre. */
export function num(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Horodatage normalisé en ISO UTC (« Z »), comme en mode démo. */
export function iso(v: string | null | undefined): string {
  if (!v) return new Date(0).toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}

const STOCKS: Product['stock'][] = ['en_stock', 'bientot', 'rupture'];
const BADGES: Product['badges'] = ['fermier', 'nouveau', 'promo', 'best'];

export function rowToCategory(r: CategoryRow): Category {
  return { id: r.id, slug: r.slug, name: r.name, description: r.description, image: r.image ?? '', sort: r.sort ?? 0 };
}

export function rowToProduct(r: ProductRow): Product {
  const stock = STOCKS.find((s) => s === r.stock) ?? 'en_stock';
  const badges = (r.badges ?? []).filter((b): b is Product['badges'][number] => (BADGES as string[]).includes(b));
  const p: Product = {
    id: r.id,
    slug: r.slug,
    category_id: r.category_id,
    name: r.name,
    short: r.short,
    description: r.description,
    images: r.images ?? [],
    pricing: r.pricing,
    badges,
    stock,
    is_featured: Boolean(r.is_featured),
    sort: r.sort ?? 0,
  };
  const compare = numOrNull(r.compare_at);
  if (compare !== null) p.compare_at = compare;
  if (r.tips) p.tips = r.tips;
  if (r.updated_at) p.updated_at = iso(r.updated_at);
  return p;
}

export function productToRow(p: Product): ProductRow {
  return {
    id: p.id,
    slug: p.slug,
    category_id: p.category_id,
    name: p.name,
    short: p.short,
    description: p.description,
    images: p.images,
    pricing: p.pricing,
    compare_at: p.compare_at ?? null,
    badges: p.badges,
    stock: p.stock,
    is_featured: p.is_featured,
    sort: p.sort,
    tips: p.tips ?? null,
  };
}

export function rowToRecipe(r: RecipeRow): Recipe {
  const difficulty = r.difficulty === 2 ? 2 : r.difficulty === 3 ? 3 : 1;
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    intro: r.intro,
    image: r.image ?? '',
    duration_min: r.duration_min ?? 0,
    servings: r.servings ?? 4,
    difficulty,
    ingredients: r.ingredients ?? { fr: [], ar: [] },
    steps: r.steps ?? { fr: [], ar: [] },
    product_slugs: r.product_slugs ?? [],
  };
}

export function recipeToRow(r: Recipe): RecipeRow {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    intro: r.intro,
    image: r.image,
    duration_min: r.duration_min,
    servings: r.servings,
    difficulty: r.difficulty,
    ingredients: r.ingredients,
    steps: r.steps,
    product_slugs: r.product_slugs,
  };
}

export function rowToZone(r: ZoneRow): DeliveryZone {
  return {
    id: r.id,
    name: r.name,
    areas: r.areas,
    fee: num(r.fee),
    free_from: num(r.free_from),
    lead_days: r.lead_days ?? 0,
    active: Boolean(r.active),
    sort: r.sort ?? 0,
  };
}

export function rowToSlot(r: SlotRow): DeliverySlot {
  return {
    id: r.id,
    label: r.label,
    from: r.slot_from,
    to: r.slot_to,
    days: r.days ?? [],
    active: Boolean(r.active),
    sort: r.sort ?? 0,
  };
}

export function slotToRow(s: DeliverySlot): SlotRow {
  return { id: s.id, label: s.label, slot_from: s.from, slot_to: s.to, days: s.days, active: s.active, sort: s.sort };
}

export function rowToSettings(r: SettingsRow): Settings {
  const s: Settings = {
    shop_open: Boolean(r.shop_open),
    announcement: r.announcement ?? { fr: '', ar: '' },
    min_order: num(r.min_order),
    max_days_ahead: r.max_days_ahead ?? 6,
    cutoff_time: r.cutoff_time ?? '18:00',
    closed_days: r.closed_days ?? [],
  };
  if (r.updated_at) s.updated_at = iso(r.updated_at);
  return s;
}

export function rowToCustomer(r: CustomerRow): CustomerProfile {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email ?? null,
    default_address: r.default_address ?? null,
    created_at: iso(r.created_at),
  };
}

export function rowToOrderItem(r: OrderItemRow): OrderItem {
  return {
    id: r.id,
    product_id: r.product_id,
    qty: num(r.qty),
    name: r.name,
    slug: r.slug,
    image: r.image ?? '',
    pricing: r.pricing,
    line_total: num(r.line_total),
    weighed_kg: numOrNull(r.weighed_kg),
    final_total: numOrNull(r.final_total),
  };
}

export function rowToEvent(r: OrderEventRow): StatusEvent {
  const e: StatusEvent = { status: r.status, at: iso(r.at) };
  if (r.note) e.note = r.note;
  if (r.by) e.by = r.by;
  return e;
}

/** Une commande complète, depuis `select('*, order_items(*), order_events(*)')` ou depuis les fonctions SQL. */
export function rowToOrder(r: OrderRow): Order {
  const items = [...(r.order_items ?? [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).map(rowToOrderItem);
  const history = [...(r.order_events ?? [])]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime() || (a.id ?? 0) - (b.id ?? 0))
    .map(rowToEvent);
  const customer: Order['customer'] = { name: r.customer_name, phone: r.customer_phone };
  if (r.customer_email) customer.email = r.customer_email;
  const address: Order['address'] = {
    zone_id: r.zone_id,
    zone_name: r.zone_name,
    street: r.street,
    city: r.city,
  };
  if (r.landmark) address.landmark = r.landmark;
  const o: Order = {
    id: r.id,
    number: r.number,
    status: r.status,
    lang: r.lang === 'ar' ? 'ar' : 'fr',
    customer,
    address,
    delivery_date: r.delivery_date,
    slot: { id: r.slot_id, label: r.slot_label, from: r.slot_from, to: r.slot_to },
    items,
    subtotal: num(r.subtotal),
    delivery_fee: num(r.delivery_fee),
    total: num(r.total),
    final_total: numOrNull(r.final_total),
    payment: 'cod',
    tracking_token: r.tracking_token,
    history,
    customer_user_id: r.customer_user_id ?? null,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  };
  if (r.notes) o.notes = r.notes;
  return o;
}

/** Résumé renvoyé par get_order_by_token() et list_my_orders() : montants et dates normalisés. */
export function jsonToSummary(j: OrderSummaryForCustomer): OrderSummaryForCustomer {
  return {
    number: j.number,
    status: j.status,
    delivery_date: j.delivery_date,
    slot: j.slot,
    items: (j.items ?? []).map((it) => ({
      name: it.name,
      qty: num(it.qty),
      pricing: it.pricing,
      line_total: num(it.line_total),
      image: it.image ?? '',
      slug: it.slug,
    })),
    subtotal: num(j.subtotal),
    delivery_fee: num(j.delivery_fee),
    total: num(j.total),
    final_total: numOrNull(j.final_total),
    history: (j.history ?? []).map((h) => {
      const e: StatusEvent = { status: h.status, at: iso(h.at) };
      if (h.note) e.note = h.note;
      return e;
    }),
    created_at: iso(j.created_at),
    address: j.address,
    customer: j.customer,
  };
}

// ---------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------

const ORDER_CODES: OrderError['code'][] = [
  'invalid',
  'shop_closed',
  'bot',
  'zone_unknown',
  'slot_unknown',
  'slot_day',
  'date_not_allowed',
  'product_unknown',
  'product_unavailable',
  'min_order',
];

interface ErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const e = err as ErrorLike;
    if (typeof e.message === 'string') return e.message;
  }
  return String(err);
}

const NETWORK_RE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|ECONNREFUSED|ENOTFOUND/i;

/** Erreurs réseau et Postgres ramenées à un message court et stable. */
export function toReadableError(err: unknown): Error {
  const msg = errorMessage(err).trim();
  if (NETWORK_RE.test(msg)) return new Error('network');
  if (err instanceof Error) return err;
  return new Error(msg || 'unknown');
}

/** Une erreur de create_order (ou send_contact) devient OrderError ; le reste, une Error lisible. */
export function toOrderError(err: unknown): Error {
  if (err instanceof OrderError) return err;
  const msg = errorMessage(err).trim();
  const code = ORDER_CODES.find((c) => c === msg);
  if (code) return new OrderError(code);
  return toReadableError(err);
}

/** Erreur d'authentification Supabase vers les codes du mode démo. */
export function toAuthError(err: unknown): Error {
  const msg = errorMessage(err);
  if (/already registered|already exists|already been registered/i.test(msg)) return new Error('phone_taken');
  if (/invalid login credentials|invalid credentials|invalid_credentials/i.test(msg)) return new Error('bad_credentials');
  if (/password/i.test(msg) && /short|least|weak|characters/i.test(msg)) return new Error('password.short');
  if (/rate limit|too many/i.test(msg)) return new Error('rate_limited');
  return toReadableError(err);
}

function fail(err: unknown): never {
  throw toReadableError(err);
}

// ---------------------------------------------------------------------------
// Auth client : téléphone + mot de passe, sans SMS.
// L'e-mail Auth est technique, dérivé du numéro ; le vrai e-mail est dans customers.email.
// ---------------------------------------------------------------------------

export const TECH_EMAIL_DOMAIN = 'clients.ferme-korba.tn';

/** +21651788518 → 21651788518@clients.ferme-korba.tn */
export function techEmail(phoneE164: string): string {
  return `${phoneE164.replace(/[^\d]/g, '')}@${TECH_EMAIL_DOMAIN}`;
}

// ---------------------------------------------------------------------------
// Source publique (boutique)
// ---------------------------------------------------------------------------

export function createSupabasePublicSource(env: Required<DataEnv>): PublicDataSource {
  const db = getSupabaseClient(env);

  async function resolveCategoryId(ref: string): Promise<string | null> {
    const safe = searchTerm(ref);
    if (!safe) return null;
    const { data, error } = await db.from('categories').select('id').or(`slug.eq.${safe},id.eq.${safe}`).limit(1);
    if (error) fail(error);
    const rows = (data ?? []) as Pick<CategoryRow, 'id'>[];
    return rows[0]?.id ?? null;
  }

  return {
    kind: 'supabase',
    async listCategories() {
      const { data, error } = await db.from('categories').select('*').order('sort').order('id');
      if (error) fail(error);
      return ((data ?? []) as CategoryRow[]).map(rowToCategory);
    },
    async listProducts(opts) {
      let q = db.from('products').select('*').order('sort').order('id');
      if (opts?.category) {
        const id = await resolveCategoryId(opts.category);
        if (!id) return [];
        q = q.eq('category_id', id);
      }
      if (opts?.featured) q = q.eq('is_featured', true);
      const { data, error } = await q;
      if (error) fail(error);
      return ((data ?? []) as ProductRow[]).map(rowToProduct);
    },
    async getProduct(slug) {
      const { data, error } = await db.from('products').select('*').eq('slug', slug).maybeSingle();
      if (error) fail(error);
      return data ? rowToProduct(data as ProductRow) : null;
    },
    async listRecipes() {
      const { data, error } = await db.from('recipes').select('*').order('created_at').order('id');
      if (error) fail(error);
      return ((data ?? []) as RecipeRow[]).map(rowToRecipe);
    },
    async getRecipe(slug) {
      const { data, error } = await db.from('recipes').select('*').eq('slug', slug).maybeSingle();
      if (error) fail(error);
      return data ? rowToRecipe(data as RecipeRow) : null;
    },
    async listZones() {
      const { data, error } = await db.from('delivery_zones').select('*').eq('active', true).order('sort').order('id');
      if (error) fail(error);
      return ((data ?? []) as ZoneRow[]).map(rowToZone);
    },
    async listSlots() {
      const { data, error } = await db.from('delivery_slots').select('*').eq('active', true).order('sort').order('id');
      if (error) fail(error);
      return ((data ?? []) as SlotRow[]).map(rowToSlot);
    },
    async getSettings() {
      const { data, error } = await db.from('settings').select('*').eq('id', 1).maybeSingle();
      if (error) fail(error);
      if (!data) throw new Error('settings_missing');
      return rowToSettings(data as SettingsRow);
    },
    async createOrder(input: OrderInput) {
      const { data, error } = await db.rpc('create_order', { input });
      if (error) throw toOrderError(error);
      const out = data as { number?: string; tracking_token?: string } | null;
      if (!out || typeof out.number !== 'string' || typeof out.tracking_token !== 'string') throw new Error('unexpected_response');
      return { number: out.number, tracking_token: out.tracking_token };
    },
    async getOrderByToken(number, token) {
      const { data, error } = await db.rpc('get_order_by_token', { p_number: number.trim().toUpperCase(), p_token: token.trim() });
      if (error) fail(error);
      return data ? jsonToSummary(data as OrderSummaryForCustomer) : null;
    },
    async sendContact(input) {
      const { error } = await db.rpc('send_contact', {
        p_name: input.name,
        p_phone: input.phone,
        p_message: input.message,
        p_website: '',
      });
      if (error) throw toOrderError(error);
    },
  };
}

// ---------------------------------------------------------------------------
// Auth client
// ---------------------------------------------------------------------------

export function createSupabaseCustomerAuth(env: Required<DataEnv>): CustomerAuth {
  const db = getSupabaseClient(env);

  async function profileOf(userId: string): Promise<CustomerProfile | null> {
    const { data, error } = await db.from('customers').select('*').eq('id', userId).maybeSingle();
    if (error) fail(error);
    return data ? rowToCustomer(data as CustomerRow) : null;
  }

  async function currentUserId(): Promise<string | null> {
    const { data } = await db.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async function requireUserId(): Promise<string> {
    const id = await currentUserId();
    if (!id) throw new Error('not_logged_in');
    return id;
  }

  return {
    async register(input) {
      const { data, error } = await db.auth.signUp({
        email: techEmail(input.phone),
        password: input.password,
        options: { data: { name: input.name, phone: input.phone, email: input.email ?? '' } },
      });
      if (error) throw toAuthError(error);
      const user = data.user;
      if (!user) throw new Error('unexpected_response');
      // Quand l'e-mail existe déjà, Supabase renvoie un utilisateur sans identité plutôt qu'une erreur.
      if (Array.isArray(user.identities) && user.identities.length === 0) throw new Error('phone_taken');
      // Confirmation d'e-mail désactivée : la session est ouverte tout de suite et le trigger a créé le profil.
      const profile = await profileOf(user.id);
      if (profile) return profile;
      return {
        id: user.id,
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        default_address: null,
        created_at: iso(user.created_at),
      };
    },
    async login(input) {
      const { data, error } = await db.auth.signInWithPassword({ email: techEmail(input.phone), password: input.password });
      if (error) throw toAuthError(error);
      const user = data.user;
      if (!user) throw new Error('bad_credentials');
      const profile = await profileOf(user.id);
      if (!profile) {
        // Un compte Auth sans profil client (un admin, par exemple) n'a rien à faire ici.
        await db.auth.signOut();
        throw new Error('bad_credentials');
      }
      return profile;
    },
    async logout() {
      const { error } = await db.auth.signOut();
      if (error) fail(error);
    },
    async currentUser() {
      const id = await currentUserId();
      return id ? profileOf(id) : null;
    },
    onAuthChange(cb) {
      const { data } = db.auth.onAuthStateChange((_event, session) => {
        // Pas d'appel Supabase directement dans le rappel : on diffère (verrou interne du client).
        setTimeout(() => {
          const id = session?.user.id;
          if (!id) {
            cb(null);
            return;
          }
          void profileOf(id)
            .then(cb)
            .catch(() => cb(null));
        }, 0);
      });
      return () => data.subscription.unsubscribe();
    },
    async updateProfile(patch) {
      const id = await requireUserId();
      const row: Partial<Pick<CustomerRow, 'name' | 'email' | 'default_address'>> = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.email !== undefined) row.email = patch.email;
      if (patch.default_address !== undefined) row.default_address = patch.default_address;
      const { data, error } = await db.from('customers').update(row).eq('id', id).select('*').single();
      if (error) fail(error);
      return rowToCustomer(data as CustomerRow);
    },
    async changePassword(newPassword) {
      await requireUserId();
      const { error } = await db.auth.updateUser({ password: newPassword });
      if (error) throw toAuthError(error);
    },
    async listMyOrders() {
      const id = await currentUserId();
      if (!id) return [];
      const { data, error } = await db.rpc('list_my_orders');
      if (error) fail(error);
      return ((data ?? []) as OrderSummaryForCustomer[]).map(jsonToSummary);
    },
  };
}

// ---------------------------------------------------------------------------
// Auth admin : compte e-mail classique + ligne dans admins
// ---------------------------------------------------------------------------

interface AdminIdentity {
  id: string;
  email: string;
  name: string;
}

export function createSupabaseAdminAuth(env: Required<DataEnv>): AdminAuth {
  const db = getSupabaseClient(env);

  async function adminOf(userId: string, email: string): Promise<AdminIdentity | null> {
    const { data, error } = await db.from('admins').select('name').eq('user_id', userId).maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    return { id: userId, email, name: (data as { name: string }).name };
  }

  return {
    async login({ email, password }) {
      const { data, error } = await db.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw toAuthError(error);
      const user = data.user;
      if (!user) throw new Error('bad_credentials');
      const admin = await adminOf(user.id, user.email ?? email);
      if (!admin) {
        await db.auth.signOut();
        throw new Error('not_admin');
      }
      return admin;
    },
    async logout() {
      const { error } = await db.auth.signOut();
      if (error) fail(error);
    },
    async currentAdmin() {
      const { data } = await db.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      return adminOf(user.id, user.email ?? '');
    },
    onAuthChange(cb) {
      const { data } = db.auth.onAuthStateChange((_event, session) => {
        setTimeout(() => {
          const user = session?.user;
          if (!user) {
            cb(null);
            return;
          }
          void adminOf(user.id, user.email ?? '')
            .then(cb)
            .catch(() => cb(null));
        }, 0);
      });
      return () => data.subscription.unsubscribe();
    },
  };
}

// ---------------------------------------------------------------------------
// Source admin (espace de gestion)
// ---------------------------------------------------------------------------

const ORDER_SELECT = '*, order_items(*), order_events(*)';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un texte de recherche sûr pour un filtre PostgREST `.or()` : ni virgule, ni parenthèse, ni joker. */
export function searchTerm(q: string): string {
  return q.trim().replace(/[,()%*\\.]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Bornes d'un filtre par date de création, en heure de Tunis (UTC+1, sans heure d'été). */
export function tunisDayBounds(dateFrom?: string, dateTo?: string): { from?: string; to?: string } {
  const out: { from?: string; to?: string } = {};
  if (dateFrom) out.from = `${dateFrom}T00:00:00+01:00`;
  if (dateTo) out.to = `${dateTo}T23:59:59.999+01:00`;
  return out;
}

export function createSupabaseAdminSource(env: Required<DataEnv>): AdminDataSource {
  const db = getSupabaseClient(env);

  async function getOrder(id: string): Promise<Order | null> {
    const key = UUID_RE.test(id) ? 'id' : 'number';
    const value = key === 'number' ? id.trim().toUpperCase() : id;
    const { data, error } = await db.from('orders').select(ORDER_SELECT).eq(key, value).maybeSingle();
    if (error) fail(error);
    return data ? rowToOrder(data as OrderRow) : null;
  }

  async function upsertRow<Row extends object, T>(table: string, row: Row, map: (r: Row) => T): Promise<T> {
    const { data, error } = await db.from(table).upsert(row).select('*').single();
    if (error) fail(error);
    return map(data as Row);
  }

  async function deleteRow(table: string, id: string): Promise<void> {
    const { error } = await db.from(table).delete().eq('id', id);
    if (error) fail(error);
  }

  return {
    kind: 'supabase',
    async stats() {
      const { data, error } = await db.rpc('admin_stats');
      if (error) fail(error);
      const s = data as DashboardStats;
      return {
        today_orders: num(s.today_orders),
        today_revenue: num(s.today_revenue),
        pending: num(s.pending),
        week_orders: num(s.week_orders),
        week_revenue: num(s.week_revenue),
        month_revenue: num(s.month_revenue),
        low_stock: num(s.low_stock),
        top_products: (s.top_products ?? []).map((t) => ({ product_id: t.product_id, name: t.name, qty: num(t.qty) })),
        daily: (s.daily ?? []).map((d) => ({ date: d.date, orders: num(d.orders), revenue: num(d.revenue) })),
      };
    },
    async listOrders(filters: OrderFilters = {}) {
      const size = Math.max(1, Math.min(200, filters.page_size ?? 50));
      const page = Math.max(1, filters.page ?? 1);
      let q = db.from('orders').select(ORDER_SELECT, { count: 'exact' });
      if (filters.status === 'actives') q = q.in('status', ACTIVE_STATUSES);
      else if (filters.status) q = q.eq('status', filters.status);
      if (filters.delivery_date) q = q.eq('delivery_date', filters.delivery_date);
      const bounds = tunisDayBounds(filters.date_from, filters.date_to);
      if (bounds.from) q = q.gte('created_at', bounds.from);
      if (bounds.to) q = q.lte('created_at', bounds.to);
      if (filters.zone_id) q = q.eq('zone_id', filters.zone_id);
      if (filters.q) {
        const term = searchTerm(filters.q);
        if (term) {
          const phone = term.replace(/\s/g, '');
          q = q.or(`number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${phone}%`);
        }
      }
      const from = (page - 1) * size;
      const { data, error, count } = await q.order('created_at', { ascending: false }).range(from, from + size - 1);
      if (error) fail(error);
      return { rows: ((data ?? []) as OrderRow[]).map(rowToOrder), total: count ?? 0 };
    },
    getOrder,
    async setOrderStatus(id, status, note) {
      const { data, error } = await db.rpc('set_order_status', { p_order_id: id, p_status: status, p_note: note ?? null });
      if (error) fail(error);
      return rowToOrder(data as OrderRow);
    },
    async setWeighed(id, lines) {
      const { data, error } = await db.rpc('set_weighed', { p_order_id: id, p_lines: lines });
      if (error) fail(error);
      return rowToOrder(data as OrderRow);
    },
    async updateOrderNotes(id, notes) {
      const { error } = await db.from('orders').update({ notes }).eq('id', id);
      if (error) fail(error);
      const o = await getOrder(id);
      if (!o) throw new Error('not_found');
      return o;
    },
    onNewOrder(cb) {
      const channel = db
        .channel(`orders-new-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          const id = (payload.new as { id?: string }).id;
          if (!id) return;
          void getOrder(id)
            .then((o) => {
              if (o) cb(o);
            })
            .catch(() => {
              /* la commande apparaîtra au prochain rafraîchissement */
            });
        })
        .subscribe();
      return () => {
        void db.removeChannel(channel);
      };
    },

    async listProducts() {
      const { data, error } = await db.from('products').select('*').order('sort').order('id');
      if (error) fail(error);
      return ((data ?? []) as ProductRow[]).map(rowToProduct);
    },
    async upsertProduct(p) {
      return upsertRow('products', productToRow(p), rowToProduct);
    },
    async deleteProduct(id) {
      return deleteRow('products', id);
    },
    async setStock(id, stock) {
      const { error } = await db.from('products').update({ stock }).eq('id', id);
      if (error) fail(error);
    },
    async uploadImage(file, path) {
      const clean = path.replace(/^\/+/, '');
      const { error } = await db.storage.from('products').upload(clean, file, { upsert: true, contentType: file.type || undefined });
      if (error) fail(error);
      return db.storage.from('products').getPublicUrl(clean).data.publicUrl;
    },

    async listCategories() {
      const { data, error } = await db.from('categories').select('*').order('sort').order('id');
      if (error) fail(error);
      return ((data ?? []) as CategoryRow[]).map(rowToCategory);
    },
    async upsertCategory(c) {
      const row: CategoryRow = { id: c.id, slug: c.slug, name: c.name, description: c.description, image: c.image, sort: c.sort };
      return upsertRow('categories', row, rowToCategory);
    },
    async deleteCategory(id) {
      return deleteRow('categories', id);
    },

    async listRecipes() {
      const { data, error } = await db.from('recipes').select('*').order('created_at').order('id');
      if (error) fail(error);
      return ((data ?? []) as RecipeRow[]).map(rowToRecipe);
    },
    async upsertRecipe(r) {
      return upsertRow('recipes', recipeToRow(r), rowToRecipe);
    },
    async deleteRecipe(id) {
      return deleteRow('recipes', id);
    },

    async listZones() {
      const { data, error } = await db.from('delivery_zones').select('*').order('sort').order('id');
      if (error) fail(error);
      return ((data ?? []) as ZoneRow[]).map(rowToZone);
    },
    async upsertZone(z) {
      const row: ZoneRow = {
        id: z.id,
        name: z.name,
        areas: z.areas,
        fee: z.fee,
        free_from: z.free_from,
        lead_days: z.lead_days,
        active: z.active,
        sort: z.sort,
      };
      return upsertRow('delivery_zones', row, rowToZone);
    },
    async deleteZone(id) {
      return deleteRow('delivery_zones', id);
    },
    async listSlots() {
      const { data, error } = await db.from('delivery_slots').select('*').order('sort').order('id');
      if (error) fail(error);
      return ((data ?? []) as SlotRow[]).map(rowToSlot);
    },
    async upsertSlot(s) {
      return upsertRow('delivery_slots', slotToRow(s), rowToSlot);
    },
    async deleteSlot(id) {
      return deleteRow('delivery_slots', id);
    },

    async getSettings() {
      const { data, error } = await db.from('settings').select('*').eq('id', 1).maybeSingle();
      if (error) fail(error);
      if (!data) throw new Error('settings_missing');
      return rowToSettings(data as SettingsRow);
    },
    async saveSettings(s) {
      const row = {
        id: 1,
        shop_open: s.shop_open,
        announcement: s.announcement,
        min_order: s.min_order,
        max_days_ahead: s.max_days_ahead,
        cutoff_time: s.cutoff_time,
        closed_days: s.closed_days,
      };
      const { data, error } = await db.from('settings').upsert(row).select('*').single();
      if (error) fail(error);
      return rowToSettings(data as SettingsRow);
    },

    async listCustomers(q) {
      const { data, error } = await db.rpc('admin_customers', { p_q: q ?? null });
      if (error) fail(error);
      const rows = (data ?? []) as (CustomerRow & { orders_count: number | string; total_spent: number | string })[];
      return rows.map((r) => ({ ...rowToCustomer(r), orders_count: num(r.orders_count), total_spent: num(r.total_spent) }));
    },
    async listContactMessages() {
      const { data, error } = await db.from('contact_messages').select('*').order('created_at', { ascending: false });
      if (error) fail(error);
      return ((data ?? []) as ContactRow[]).map((m) => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        message: m.message,
        created_at: iso(m.created_at),
        read: Boolean(m.read),
      }));
    },
    async markContactRead(id) {
      const { error } = await db.from('contact_messages').update({ read: true }).eq('id', id);
      if (error) fail(error);
    },
  };
}
