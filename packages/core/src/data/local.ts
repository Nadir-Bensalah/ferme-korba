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
import type { AdminAuth, AdminDataSource, CustomerAuth, OrderFilters, PublicDataSource } from './source';
import { seed } from '../seed';
import { buildOrder, formatOrderNumber, canTransition, applyWeighing, ACTIVE_STATUSES } from '../orders';
import { roundMillimes } from '../money';

/**
 * Mode démo : tout vit dans le navigateur (localStorage).
 * Sert au site GitHub Pages tant que Supabase n'est pas branché, et aux tests.
 */

const KEY = 'ferme-korba:demo:v1';

interface DemoState {
  categories: Category[];
  products: Product[];
  recipes: Recipe[];
  offers: Offer[];
  zones: DeliveryZone[];
  slots: DeliverySlot[];
  settings: Settings;
  orders: Order[];
  seq: number;
  customers: (CustomerProfile & { password: string })[];
  session: string | null;
  adminSession: boolean;
  contacts: { id: string; name: string; phone: string; message: string; created_at: string; read: boolean }[];
  newsletter: { email: string; lang: 'fr' | 'ar'; created_at: string }[];
}

const listeners = new Set<(o: Order) => void>();
const authListeners = new Set<(u: CustomerProfile | null) => void>();
const adminListeners = new Set<(a: { id: string; email: string; name: string } | null) => void>();

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

let memory: DemoState | null = null;

function fresh(): DemoState {
  return {
    categories: structuredClone(seed.categories),
    products: structuredClone(seed.products),
    recipes: structuredClone(seed.recipes),
    offers: structuredClone(seed.offers),
    zones: structuredClone(seed.zones),
    slots: structuredClone(seed.slots),
    settings: structuredClone(seed.settings),
    orders: [],
    seq: 0,
    customers: [],
    session: null,
    adminSession: false,
    contacts: [],
    newsletter: [],
  };
}

function load(): DemoState {
  if (memory) return memory;
  if (hasStorage()) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        memory = { ...fresh(), ...(JSON.parse(raw) as Partial<DemoState>) };
        return memory;
      }
    } catch {
      /* stockage vide ou corrompu : on repart du jeu de démo */
    }
  }
  memory = fresh();
  return memory;
}

function save(state: DemoState): void {
  memory = state;
  if (hasStorage()) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota plein : on garde en mémoire */
    }
  }
}

export function resetDemo(): void {
  memory = null;
  if (hasStorage()) localStorage.removeItem(KEY);
}

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const token = (): string => {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

function toSummary(o: Order): OrderSummaryForCustomer {
  return {
    number: o.number,
    status: o.status,
    delivery_date: o.delivery_date,
    slot: o.slot,
    items: o.items.map(({ name, qty, pricing, line_total, image, slug }) => ({ name, qty, pricing, line_total, image, slug })),
    subtotal: o.subtotal,
    delivery_fee: o.delivery_fee,
    total: o.total,
    final_total: o.final_total,
    history: o.history,
    created_at: o.created_at,
    address: o.address,
    customer: { name: o.customer.name, phone: o.customer.phone },
  };
}

export function createLocalPublicSource(): PublicDataSource {
  return {
    kind: 'local',
    async listCategories() {
      return [...load().categories].sort((a, b) => a.sort - b.sort);
    },
    async listProducts(opts) {
      let rows = load().products;
      if (opts?.category) {
        const cat = load().categories.find((c) => c.slug === opts.category || c.id === opts.category);
        rows = rows.filter((p) => cat && p.category_id === cat.id);
      }
      if (opts?.featured) rows = rows.filter((p) => p.is_featured);
      return [...rows].sort((a, b) => a.sort - b.sort);
    },
    async getProduct(slug) {
      return load().products.find((p) => p.slug === slug) ?? null;
    },
    async listRecipes() {
      return [...load().recipes];
    },
    async getRecipe(slug) {
      return load().recipes.find((r) => r.slug === slug) ?? null;
    },
    async listZones() {
      return load()
        .zones.filter((z) => z.active)
        .sort((a, b) => a.sort - b.sort);
    },
    async listSlots() {
      return load()
        .slots.filter((s) => s.active)
        .sort((a, b) => a.sort - b.sort);
    },
    async getSettings() {
      return load().settings;
    },
    async listOffers() {
      return load()
        .offers.filter((o) => o.active)
        .sort((a, b) => a.sort - b.sort);
    },
    async createOrder(input: OrderInput) {
      await delay(400);
      const state = load();
      const order = buildOrder(input, {
        products: state.products,
        zones: state.zones,
        slots: state.slots,
        settings: state.settings,
        nextNumber: () => formatOrderNumber(state.seq + 1),
        makeId: uuid,
        makeToken: token,
      });
      state.seq += 1;
      state.orders.unshift(order);
      save(state);
      queueMicrotask(() => listeners.forEach((cb) => cb(order)));
      return { number: order.number, tracking_token: order.tracking_token };
    },
    async getOrderByToken(number, tok) {
      await delay();
      const o = load().orders.find((x) => x.number === number.trim().toUpperCase() && x.tracking_token === tok);
      return o ? toSummary(o) : null;
    },
    async sendContact(input) {
      await delay(300);
      const state = load();
      state.contacts.unshift({ id: uuid(), ...input, created_at: new Date().toISOString(), read: false });
      save(state);
    },
    async subscribeNewsletter(email, lang) {
      await delay(300);
      const state = load();
      const clean = email.trim().toLowerCase();
      if (!state.newsletter.some((n) => n.email === clean)) state.newsletter.push({ email: clean, lang, created_at: new Date().toISOString() });
      save(state);
    },
  };
}

function publicProfile(c: CustomerProfile & { password?: string }): CustomerProfile {
  const { password: _pw, ...rest } = c;
  return rest;
}

export function createLocalCustomerAuth(): CustomerAuth {
  const current = (): CustomerProfile | null => {
    const s = load();
    const c = s.customers.find((x) => x.id === s.session);
    return c ? publicProfile(c) : null;
  };
  const notify = () => authListeners.forEach((cb) => cb(current()));
  return {
    async register(input) {
      await delay(300);
      const s = load();
      if (s.customers.some((c) => c.phone === input.phone)) throw new Error('phone_taken');
      const c: CustomerProfile & { password: string } = {
        id: uuid(),
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        default_address: null,
        created_at: new Date().toISOString(),
        password: input.password,
      };
      s.customers.push(c);
      s.session = c.id;
      save(s);
      notify();
      return publicProfile(c);
    },
    async login(input) {
      await delay(300);
      const s = load();
      const c = s.customers.find((x) => x.phone === input.phone && x.password === input.password);
      if (!c) throw new Error('bad_credentials');
      s.session = c.id;
      save(s);
      notify();
      return publicProfile(c);
    },
    async logout() {
      const s = load();
      s.session = null;
      save(s);
      notify();
    },
    async currentUser() {
      return current();
    },
    onAuthChange(cb) {
      authListeners.add(cb);
      return () => authListeners.delete(cb);
    },
    async updateProfile(patch) {
      const s = load();
      const c = s.customers.find((x) => x.id === s.session);
      if (!c) throw new Error('not_logged_in');
      if (patch.name !== undefined) c.name = patch.name;
      if (patch.email !== undefined) c.email = patch.email;
      if (patch.default_address !== undefined) c.default_address = patch.default_address as AddressInput | null;
      save(s);
      notify();
      return publicProfile(c);
    },
    async changePassword(newPassword) {
      const s = load();
      const c = s.customers.find((x) => x.id === s.session);
      if (!c) throw new Error('not_logged_in');
      c.password = newPassword;
      save(s);
    },
    async listMyOrders() {
      const s = load();
      const me = s.customers.find((x) => x.id === s.session);
      if (!me) return [];
      return s.orders.filter((o) => o.customer_user_id === me.id || o.customer.phone === me.phone).map(toSummary);
    },
  };
}

const DEMO_ADMIN = { id: 'admin-demo', email: 'demo@ferme-korba.tn', name: 'Démo' };

export function createLocalAdminAuth(): AdminAuth {
  const notify = () => adminListeners.forEach((cb) => cb(load().adminSession ? DEMO_ADMIN : null));
  return {
    async login({ email, password }) {
      await delay(300);
      if (email.trim().toLowerCase() !== DEMO_ADMIN.email || password !== 'demo1234') throw new Error('bad_credentials');
      const s = load();
      s.adminSession = true;
      save(s);
      notify();
      return DEMO_ADMIN;
    },
    async logout() {
      const s = load();
      s.adminSession = false;
      save(s);
      notify();
    },
    async currentAdmin() {
      return load().adminSession ? DEMO_ADMIN : null;
    },
    onAuthChange(cb) {
      adminListeners.add(cb);
      return () => adminListeners.delete(cb);
    },
  };
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function createLocalAdminSource(): AdminDataSource {
  const upsert = <T extends { id: string }>(arr: T[], item: T): T => {
    const i = arr.findIndex((x) => x.id === item.id);
    if (i >= 0) arr[i] = item;
    else arr.push(item);
    return item;
  };
  return {
    kind: 'local',
    async stats() {
      const s = load();
      const now = new Date();
      const today = isoDay(now);
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 6);
      const monthAgo = new Date(now);
      monthAgo.setDate(now.getDate() - 29);
      const valid = s.orders.filter((o) => o.status !== 'annulee' && o.status !== 'refusee');
      const revenue = (o: Order) => o.final_total ?? o.total;
      const todayOrders = valid.filter((o) => o.created_at.slice(0, 10) === today);
      const weekOrders = valid.filter((o) => new Date(o.created_at) >= weekAgo);
      const monthOrders = valid.filter((o) => new Date(o.created_at) >= monthAgo);
      const top = new Map<string, { name: Product['name']; qty: number }>();
      for (const o of monthOrders)
        for (const it of o.items) {
          const t = top.get(it.product_id) ?? { name: it.name, qty: 0 };
          t.qty += it.qty;
          top.set(it.product_id, t);
        }
      const daily: DashboardStats['daily'] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = isoDay(d);
        const rows = valid.filter((o) => o.created_at.slice(0, 10) === key);
        daily.push({ date: key, orders: rows.length, revenue: roundMillimes(rows.reduce((a, o) => a + revenue(o), 0)) });
      }
      return {
        today_orders: todayOrders.length,
        today_revenue: roundMillimes(todayOrders.reduce((a, o) => a + revenue(o), 0)),
        pending: s.orders.filter((o) => o.status === 'nouvelle').length,
        week_orders: weekOrders.length,
        week_revenue: roundMillimes(weekOrders.reduce((a, o) => a + revenue(o), 0)),
        month_revenue: roundMillimes(monthOrders.reduce((a, o) => a + revenue(o), 0)),
        low_stock: s.products.filter((p) => p.stock !== 'en_stock').length,
        top_products: [...top.entries()]
          .map(([product_id, v]) => ({ product_id, ...v }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5),
        daily,
      };
    },
    async listOrders(filters: OrderFilters = {}) {
      const s = load();
      let rows = [...s.orders];
      if (filters.status === 'actives') rows = rows.filter((o) => ACTIVE_STATUSES.includes(o.status));
      else if (filters.status) rows = rows.filter((o) => o.status === filters.status);
      if (filters.delivery_date) rows = rows.filter((o) => o.delivery_date === filters.delivery_date);
      if (filters.date_from) rows = rows.filter((o) => o.created_at.slice(0, 10) >= filters.date_from!);
      if (filters.date_to) rows = rows.filter((o) => o.created_at.slice(0, 10) <= filters.date_to!);
      if (filters.zone_id) rows = rows.filter((o) => o.address.zone_id === filters.zone_id);
      if (filters.q) {
        const q = filters.q.trim().toLowerCase();
        rows = rows.filter(
          (o) =>
            o.number.toLowerCase().includes(q) ||
            o.customer.name.toLowerCase().includes(q) ||
            o.customer.phone.includes(q.replace(/\s/g, '')),
        );
      }
      const total = rows.length;
      const size = filters.page_size ?? 50;
      const page = filters.page ?? 1;
      return { rows: rows.slice((page - 1) * size, page * size), total };
    },
    async getOrder(id) {
      return load().orders.find((o) => o.id === id || o.number === id) ?? null;
    },
    async setOrderStatus(id, status: OrderStatus, note) {
      const s = load();
      const o = s.orders.find((x) => x.id === id);
      if (!o) throw new Error('not_found');
      if (!canTransition(o.status, status)) throw new Error('bad_transition');
      o.status = status;
      o.history.push({ status, at: new Date().toISOString(), note, by: DEMO_ADMIN.name });
      o.updated_at = new Date().toISOString();
      save(s);
      return o;
    },
    async setWeighed(id, lines) {
      const s = load();
      const i = s.orders.findIndex((x) => x.id === id);
      if (i < 0) throw new Error('not_found');
      const next = applyWeighing(s.orders[i]!, lines);
      s.orders[i] = next;
      save(s);
      return next;
    },
    async updateOrderNotes(id, notes) {
      const s = load();
      const o = s.orders.find((x) => x.id === id);
      if (!o) throw new Error('not_found');
      o.notes = notes;
      o.updated_at = new Date().toISOString();
      save(s);
      return o;
    },
    onNewOrder(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async listProducts() {
      return [...load().products].sort((a, b) => a.sort - b.sort);
    },
    async upsertProduct(p) {
      const s = load();
      const item = upsert(s.products, { ...p, updated_at: new Date().toISOString() });
      save(s);
      return item;
    },
    async deleteProduct(id) {
      const s = load();
      s.products = s.products.filter((p) => p.id !== id);
      save(s);
    },
    async setStock(id, stock) {
      const s = load();
      const p = s.products.find((x) => x.id === id);
      if (p) {
        p.stock = stock;
        save(s);
      }
    },
    async uploadImage(file) {
      // En démo, l'image reste dans le navigateur sous forme de data URL.
      return new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
    },
    async listCategories() {
      return [...load().categories].sort((a, b) => a.sort - b.sort);
    },
    async upsertCategory(c) {
      const s = load();
      const item = upsert(s.categories, c);
      save(s);
      return item;
    },
    async deleteCategory(id) {
      const s = load();
      s.categories = s.categories.filter((c) => c.id !== id);
      save(s);
    },
    async listRecipes() {
      return [...load().recipes];
    },
    async upsertRecipe(r) {
      const s = load();
      const item = upsert(s.recipes, r);
      save(s);
      return item;
    },
    async deleteRecipe(id) {
      const s = load();
      s.recipes = s.recipes.filter((r) => r.id !== id);
      save(s);
    },
    async listOffers() {
      return [...load().offers].sort((a, b) => a.sort - b.sort);
    },
    async upsertOffer(o) {
      const s = load();
      const item = upsert(s.offers, { ...o, updated_at: new Date().toISOString() });
      save(s);
      return item;
    },
    async deleteOffer(id) {
      const s = load();
      s.offers = s.offers.filter((o) => o.id !== id);
      save(s);
    },
    async listZones() {
      return [...load().zones].sort((a, b) => a.sort - b.sort);
    },
    async upsertZone(z) {
      const s = load();
      const item = upsert(s.zones, z);
      save(s);
      return item;
    },
    async deleteZone(id) {
      const s = load();
      s.zones = s.zones.filter((z) => z.id !== id);
      save(s);
    },
    async listSlots() {
      return [...load().slots].sort((a, b) => a.sort - b.sort);
    },
    async upsertSlot(sl) {
      const s = load();
      const item = upsert(s.slots, sl);
      save(s);
      return item;
    },
    async deleteSlot(id) {
      const s = load();
      s.slots = s.slots.filter((x) => x.id !== id);
      save(s);
    },
    async getSettings() {
      return load().settings;
    },
    async saveSettings(st) {
      const s = load();
      s.settings = { ...st, updated_at: new Date().toISOString() };
      save(s);
      return s.settings;
    },
    async listCustomers(q) {
      const s = load();
      const byPhone = new Map<string, CustomerProfile & { orders_count: number; total_spent: number }>();
      for (const c of s.customers) byPhone.set(c.phone, { ...publicProfile(c), orders_count: 0, total_spent: 0 });
      for (const o of s.orders) {
        const row =
          byPhone.get(o.customer.phone) ??
          ({
            id: o.customer.phone,
            name: o.customer.name,
            phone: o.customer.phone,
            email: o.customer.email ?? null,
            default_address: null,
            created_at: o.created_at,
            orders_count: 0,
            total_spent: 0,
          } as CustomerProfile & { orders_count: number; total_spent: number });
        row.orders_count += 1;
        if (o.status !== 'annulee' && o.status !== 'refusee') row.total_spent = roundMillimes(row.total_spent + (o.final_total ?? o.total));
        byPhone.set(o.customer.phone, row);
      }
      let rows = [...byPhone.values()];
      if (q) {
        const needle = q.toLowerCase();
        rows = rows.filter((r) => r.name.toLowerCase().includes(needle) || r.phone.includes(needle.replace(/\s/g, '')));
      }
      return rows.sort((a, b) => b.total_spent - a.total_spent);
    },
    async listContactMessages() {
      return [...load().contacts];
    },
    async markContactRead(id) {
      const s = load();
      const m = s.contacts.find((x) => x.id === id);
      if (m) {
        m.read = true;
        save(s);
      }
    },
  };
}
