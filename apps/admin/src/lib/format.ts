import type { Localized, Order, OrderStatus } from '@ferme/core';

const dateShort = new Intl.DateTimeFormat('fr-TN', { weekday: 'short', day: 'numeric', month: 'short' });
const dateLong = new Intl.DateTimeFormat('fr-TN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dateNum = new Intl.DateTimeFormat('fr-TN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat('fr-TN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const timeOnly = new Intl.DateTimeFormat('fr-TN', { hour: '2-digit', minute: '2-digit' });
const dayOnly = new Intl.DateTimeFormat('fr-TN', { day: 'numeric', month: 'short' });

/** « AAAA-MM-JJ » en date locale, sans décalage de fuseau. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function fmtDate(iso: string): string {
  return dateShort.format(parseISODate(iso));
}
export function fmtDateLong(iso: string): string {
  return dateLong.format(parseISODate(iso));
}
export function fmtDateNum(iso: string): string {
  return dateNum.format(parseISODate(iso));
}
export function fmtDay(iso: string): string {
  return dayOnly.format(parseISODate(iso));
}
export function fmtDateTime(isoTimestamp: string): string {
  return dateTime.format(new Date(isoTimestamp));
}
export function fmtTime(isoTimestamp: string): string {
  return timeOnly.format(new Date(isoTimestamp));
}
export function fmtDateTimeNum(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${dateNum.format(d)} ${timeOnly.format(d)}`;
}

/** Libellé relatif court pour une date de livraison. */
export function relativeDay(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Aujourd'hui";
  if (iso === addDaysISO(today, 1)) return 'Demain';
  if (iso === addDaysISO(today, -1)) return 'Hier';
  return fmtDate(iso);
}

export const L = (v: Localized | undefined | null): string => v?.fr ?? '';

export const STATUS: Record<OrderStatus, { label: string; action: string; cls: string; dot: string }> = {
  nouvelle: { label: 'À confirmer', action: 'Nouvelle', cls: 'bg-yolk-soft text-yolk-deep', dot: 'bg-yolk' },
  confirmee: { label: 'Confirmée', action: 'Confirmer', cls: 'bg-sky text-sky-deep', dot: 'bg-sky-deep' },
  en_preparation: { label: 'En préparation', action: 'Préparer', cls: 'bg-plum-soft text-plum', dot: 'bg-plum' },
  en_livraison: { label: 'En livraison', action: 'En livraison', cls: 'bg-prairie-soft text-prairie-deep', dot: 'bg-prairie' },
  livree: { label: 'Livrée', action: 'Livrée', cls: 'bg-moss text-prairie-deep', dot: 'bg-prairie-deep' },
  annulee: { label: 'Annulée', action: 'Annuler', cls: 'bg-line text-ink-3', dot: 'bg-ink-3' },
  refusee: { label: 'Refusée', action: 'Refusée', cls: 'bg-paprika-soft text-paprika', dot: 'bg-paprika' },
};

export const STOCK_LABEL = {
  en_stock: 'En stock',
  bientot: 'Bientôt',
  rupture: 'Rupture',
} as const;

export const BADGE_LABEL = {
  fermier: 'Fermier',
  nouveau: 'Nouveau',
  promo: 'Promo',
  best: 'Meilleure vente',
} as const;

export const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const;

/** L'admin est servi sous /admin/ : les images du site vivent à la racine. */
const siteRoot = import.meta.env.BASE_URL.replace(/admin\/?$/, '');

export function imageUrl(path: string): string {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return siteRoot + path.replace(/^\//, '');
}

export function telHref(phone: string): string {
  return `tel:${phone}`;
}

export function waHref(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export function mapsHref(order: Pick<Order, 'address'>): string {
  const q = [order.address.street, order.address.city, order.address.zone_name.fr, 'Tunisie'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Montant à encaisser : le total pesé s'il existe, sinon l'estimation. */
export function orderAmount(o: Pick<Order, 'total' | 'final_total'>): number {
  return o.final_total ?? o.total;
}

export function slotText(slot: Order['slot']): string {
  return `${slot.label.fr}, ${slot.from} à ${slot.to}`;
}

export function whatsappMessage(o: Order): string {
  return `Bonjour ${o.customer.name}, votre commande ${o.number} est confirmée pour ${fmtDateLong(o.delivery_date)} (${slotText(o.slot)}). Paiement à la livraison. Merci, Ferme Korba.`;
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function errorMessage(e: unknown): string {
  const code = e instanceof Error ? e.message : String(e);
  switch (code) {
    case 'bad_credentials':
      return 'E-mail ou mot de passe incorrect.';
    case 'bad_transition':
      return 'Ce changement de statut n’est pas permis.';
    case 'not_found':
      return 'Introuvable.';
    case 'Failed to fetch':
      return 'Pas de connexion.';
    default:
      return code || 'Une erreur est survenue.';
  }
}
