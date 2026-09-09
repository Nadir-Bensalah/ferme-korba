import { z } from 'zod';

/**
 * Numéros tunisiens : 8 chiffres, mobiles en 2, 4, 5, 9 et fixes en 3, 7.
 * On accepte +216, 00216, espaces, points et tirets, puis on normalise.
 */
export const TN_PHONE_RE = /^(?:\+216|00216)?[\s.-]?(?:[2-579]\d)[\s.-]?\d{3}[\s.-]?\d{3}$/;

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  const local = digits.replace(/^\+?216/, '').replace(/^00216/, '');
  if (!/^[2-579]\d{7}$/.test(local)) return null;
  return `+216${local}`;
}

export function formatPhone(e164: string): string {
  const local = e164.replace(/^\+216/, '');
  if (local.length !== 8) return e164;
  return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}

/** Lettres latines et arabes, espaces, apostrophes et tirets. Pas de chiffres. */
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]{1,59}$/u;

/** Retire les balises et compresse les espaces : ce qui part en base reste lisible. */
export function cleanText(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/[\u00a0\u2000-\u200b\u2028\u2029\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const phoneSchema = z
  .string()
  .trim()
  .min(8, 'phone.short')
  .max(20, 'phone.long')
  .refine((v) => normalizePhone(v) !== null, 'phone.invalid')
  .transform((v) => normalizePhone(v) as string);

export const nameSchema = z
  .string()
  .transform(cleanText)
  .pipe(z.string().min(2, 'name.short').max(60, 'name.long').regex(NAME_RE, 'name.invalid'));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(120, 'email.long')
  .email('email.invalid');

export const optionalEmailSchema = z
  .union([z.literal(''), emailSchema])
  .optional()
  .transform((v) => (v ? v : undefined));

export const customerSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema,
});

export const addressSchema = z.object({
  zone_id: z.string().min(1, 'zone.required').max(64),
  street: z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(5, 'street.short').max(200, 'street.long')),
  city: z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(2, 'city.short').max(80, 'city.long')),
  landmark: z
    .string()
    .transform(cleanText)
    .pipe(z.string().max(160, 'landmark.long'))
    .optional(),
});

const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const orderItemInputSchema = z.object({
  product_id: z.string().min(1).max(64),
  qty: z.number().finite().positive().max(100),
});

export const orderInputSchema = z.object({
  lang: z.enum(['fr', 'ar']),
  customer: customerSchema,
  address: addressSchema,
  delivery_date: z.string().regex(ISO_DATE_RE, 'date.invalid'),
  slot_id: z.string().min(1, 'slot.required').max(64),
  items: z.array(orderItemInputSchema).min(1, 'items.empty').max(40, 'items.many'),
  notes: z
    .string()
    .transform(cleanText)
    .pipe(z.string().max(300, 'notes.long'))
    .optional(),
  customer_user_id: z.string().uuid().nullable().optional(),
  /** Champ piège : un robot le remplit, un humain ne le voit pas. */
  website: z.string().max(0, 'bot').optional(),
});

export type OrderInputParsed = z.infer<typeof orderInputSchema>;

export const passwordSchema = z.string().min(8, 'password.short').max(72, 'password.long');

export const registerSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'password.required').max(72),
});

/** Formulaire de contact : mêmes gardes que la commande. */
export const contactSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  message: z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(10, 'message.short').max(1000, 'message.long')),
  website: z.string().max(0, 'bot').optional(),
});

/** Transforme une erreur zod en { champ: code } pour l'affichage. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Une date de livraison doit être entre demain (ou aujourd'hui avant l'heure limite) et N jours. */
export function isDeliveryDateAllowed(
  dateISO: string,
  opts: { now?: Date; maxDaysAhead: number; cutoffTime: string; closedDays: number[]; leadDays: number },
): boolean {
  if (!ISO_DATE_RE.test(dateISO)) return false;
  const now = opts.now ?? new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = dateISO.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return false;
  const [ch, cm] = opts.cutoffTime.split(':').map(Number) as [number, number];
  const pastCutoff = now.getHours() > ch || (now.getHours() === ch && now.getMinutes() >= cm);
  const firstOffset = Math.max(opts.leadDays, pastCutoff ? 1 : 0);
  const first = new Date(today);
  first.setDate(first.getDate() + firstOffset);
  const last = new Date(today);
  last.setDate(last.getDate() + opts.maxDaysAhead);
  if (date < first || date > last) return false;
  if (opts.closedDays.includes(date.getDay())) return false;
  return true;
}

/** Liste des dates proposables, dans l'ordre. */
export function allowedDeliveryDates(opts: {
  now?: Date;
  maxDaysAhead: number;
  cutoffTime: string;
  closedDays: number[];
  leadDays: number;
}): string[] {
  const now = opts.now ?? new Date();
  const out: string[] = [];
  for (let i = 0; i <= opts.maxDaysAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (isDeliveryDateAllowed(iso, { ...opts, now })) out.push(iso);
  }
  return out;
}
