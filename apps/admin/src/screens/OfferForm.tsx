import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Check, Trash2 } from 'lucide-react';
import { fieldErrors, formatPrice, type Localized, type Offer, type OfferKind, type Product } from '@ferme/core';
import { source } from '@/lib/data';
import { qk, useCategories, useOffers, useProducts } from '@/lib/queries';
import { imageUrl } from '@/lib/format';
import { useMutate } from '@/hooks/useMutate';
import { useConfirm } from '@/hooks/useConfirm';
import { Input, LocalizedField, Select, Toggle } from '@/components/Field';
import { ImageUploader } from '@/components/ImageUploader';
import { ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { OFFER_KIND, OFFER_KINDS } from './Offers';

const CTA_ORDER: Localized = { fr: 'Commander', ar: 'اطلب الآن' };
const CTA_PACK: Localized = { fr: 'Ajouter le pack', ar: 'أضف الباقة' };

const sameText = (a: Localized, b: Localized) => a.fr.trim() === b.fr.trim() && a.ar.trim() === b.ar.trim();
const isBlank = (v: Localized) => !v.fr.trim() && !v.ar.trim();

/** Identifiant court et lisible : o- suivi de l'horodatage en base 36. */
const newOfferId = () => `o-${Date.now().toString(36)}`;

const blank = (): Offer => ({
  id: newOfferId(),
  kind: 'deal',
  eyebrow: { ...OFFER_KIND.deal.eyebrow },
  title: { fr: '', ar: '' },
  subtitle: { fr: '', ar: '' },
  badge: { fr: '', ar: '' },
  price: null,
  compare_at: null,
  image: '',
  cta: { ...CTA_ORDER },
  link: '/produits',
  ends_at: null,
  product_slugs: [],
  active: true,
  sort: 0,
});

// ---------------------------------------------------------------------------
// Dates : le champ datetime-local parle en heure locale, la base en ISO.
// ---------------------------------------------------------------------------

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromLocalInput(s: string): string | null {
  if (!s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ---------------------------------------------------------------------------
// Lien : une catégorie, un produit ou une adresse libre du site.
// ---------------------------------------------------------------------------

type LinkMode = 'category' | 'product' | 'url';

const CATEGORY_LINK = /^\/produits\/categorie\/([^/]+)$/;
const PRODUCT_LINK = /^\/produits\/([^/]+)$/;

function detectLinkMode(link: string): LinkMode {
  if (CATEGORY_LINK.test(link)) return 'category';
  if (PRODUCT_LINK.test(link)) return 'product';
  return 'url';
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const toNum = (v: unknown): unknown => (typeof v === 'string' ? (v.trim() === '' ? undefined : Number(v.replace(',', '.'))) : v);
const optPrice = z.preprocess(toNum, z.number({ invalid_type_error: 'Nombre invalide' }).finite().positive('Doit être supérieur à 0').optional());
const req = (m: string) => z.string().trim().min(1, m);
const text = z.object({ fr: z.string().trim(), ar: z.string().trim() });

const schema = z
  .object({
    kind: z.enum(['deal', 'combo', 'season']),
    eyebrow: text,
    title: z.object({ fr: req('Obligatoire'), ar: req('Obligatoire') }),
    subtitle: text,
    badge: text,
    price: optPrice,
    compare_at: optPrice,
    image: z.string().trim(),
    cta: z.object({ fr: req('Obligatoire'), ar: req('Obligatoire') }),
    link: z.string().trim().regex(/^\//, 'Une adresse du site commence par /'),
    ends_at: z.string().nullable(),
    product_slugs: z.array(z.string()),
    active: z.boolean(),
    sort: z.preprocess(toNum, z.number({ invalid_type_error: 'Nombre requis', required_error: 'Nombre requis' }).int('Nombre entier').min(0, 'Nombre requis')),
  })
  .superRefine((v, ctx) => {
    if (v.price !== undefined && v.compare_at !== undefined && v.compare_at <= v.price) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compare_at'], message: 'L’ancien prix doit être supérieur au prix' });
    }
  });

/** Ce que l'écran manipule : l'offre, plus les champs saisis en texte. */
interface Draft {
  o: Offer;
  price: string;
  compare_at: string;
  ends: string;
  sort: string;
  linkMode: LinkMode;
}

const toDraft = (o: Offer): Draft => ({
  o,
  price: o.price == null ? '' : String(o.price).replace('.', ','),
  compare_at: o.compare_at == null ? '' : String(o.compare_at).replace('.', ','),
  ends: toLocalInput(o.ends_at),
  sort: String(o.sort),
  linkMode: detectLinkMode(o.link),
});

export function OfferForm() {
  const { id } = useParams();
  const offers = useOffers();
  const existing = id ? offers.data?.find((o) => o.id === id) : undefined;
  if (id && offers.isPending) return <SkeletonRows rows={8} />;
  if (id && offers.isError) return <ErrorState error={offers.error} retry={() => void offers.refetch()} />;
  if (id && !existing) return <ErrorState error={new Error('Offre introuvable')} />;
  return <Form key={existing?.id ?? 'new'} initial={existing ? structuredClone(existing) : blank()} isNew={!id} />;
}

function Form({ initial, isNew }: { initial: Offer; isNew: boolean }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const products = useProducts();
  const categories = useCategories();
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const o = d.o;
  const patch = (p: Partial<Offer>) => setD((x) => ({ ...x, o: { ...x.o, ...p } }));
  const patchDraft = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const save = useMutate((x: Offer) => source.upsertOffer(x), { invalidate: [qk.offers, qk.stats], success: isNew ? 'Offre créée' : 'Offre enregistrée', onSuccess: () => navigate('/offres') });
  const del = useMutate((oid: string) => source.deleteOffer(oid), { invalidate: [qk.offers, qk.stats], success: 'Offre supprimée', onSuccess: () => navigate('/offres') });

  /** Changer de type propose le surtitre du nouveau type, sauf si l'ancien a été personnalisé. */
  const setKind = (kind: OfferKind) => {
    const keepEyebrow = !isBlank(o.eyebrow) && !sameText(o.eyebrow, OFFER_KIND[o.kind].eyebrow);
    patch({ kind, eyebrow: keepEyebrow ? o.eyebrow : { ...OFFER_KIND[kind].eyebrow } });
  };

  /** Choisir des produits propose « Ajouter le pack », les retirer tous revient à « Commander ». */
  const setProductSlugs = (slugs: string[]) => {
    let cta = o.cta;
    if (slugs.length > 0 && (isBlank(cta) || sameText(cta, CTA_ORDER))) cta = { ...CTA_PACK };
    if (slugs.length === 0 && (isBlank(cta) || sameText(cta, CTA_PACK))) cta = { ...CTA_ORDER };
    patch({ product_slugs: slugs, cta });
  };

  const setLinkMode = (mode: LinkMode) => {
    if (mode === d.linkMode) return;
    let link = '';
    if (mode === 'category') {
      const first = categories.data?.[0];
      link = first ? `/produits/categorie/${first.slug}` : '';
    } else if (mode === 'product') {
      const first = products.data?.[0];
      link = first ? `/produits/${first.slug}` : '';
    } else {
      link = '/';
    }
    setD((x) => ({ ...x, linkMode: mode, o: { ...x.o, link } }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ ...o, price: d.price, compare_at: d.compare_at, sort: d.sort });
    const errs: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error);
    const ends = fromLocalInput(d.ends);
    if (d.ends.trim() && ends === null) errs.ends_at = 'Date invalide';
    if (d.linkMode !== 'url' && !o.link) errs.link = 'Choisissez une cible';
    setErrors(errs);
    if (!parsed.success || Object.keys(errs).length) return;
    const v = parsed.data;
    save.mutate({
      ...o,
      kind: v.kind,
      eyebrow: v.eyebrow,
      title: v.title,
      subtitle: v.subtitle,
      badge: v.badge,
      price: v.price ?? null,
      compare_at: v.compare_at ?? null,
      image: v.image,
      cta: v.cta,
      link: v.link,
      ends_at: ends,
      product_slugs: v.product_slugs,
      active: v.active,
      sort: v.sort,
    });
  };

  const remove = async () => {
    const c = await confirm({ title: `Supprimer « ${o.title.fr} » ?`, message: 'L’offre disparaît de la boutique tout de suite.', confirmLabel: 'Supprimer', danger: true });
    if (c.ok) del.mutate(o.id);
  };

  /** L'aperçu suit la saisie, même incomplète : les nombres illisibles sont ignorés. */
  const preview = useMemo<Offer>(() => {
    const n = (s: string) => {
      const v = Number(s.replace(',', '.'));
      return s.trim() && Number.isFinite(v) && v > 0 ? v : null;
    };
    return { ...o, price: n(d.price), compare_at: n(d.compare_at), ends_at: fromLocalInput(d.ends) };
  }, [o, d.price, d.compare_at, d.ends]);

  const catalogImages = useMemo(() => {
    const seen = new Set<string>();
    const out: { src: string; name: string }[] = [];
    for (const p of products.data ?? []) {
      for (const src of p.images) {
        if (!src || seen.has(src)) continue;
        seen.add(src);
        out.push({ src, name: p.name.fr });
      }
    }
    return out;
  }, [products.data]);

  const kindMeta = OFFER_KIND[o.kind];

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={isNew ? 'Nouvelle offre' : o.title.fr || 'Offre'}
        subtitle={isNew ? undefined : kindMeta.label}
        back="/offres"
        actions={
          !isNew ? (
            <button type="button" className="btn-ghost btn-sm text-paprika" onClick={() => void remove()}>
              <Trash2 className="size-4" /> Supprimer
            </button>
          ) : undefined
        }
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          {/* Type */}
          <section className="card-flat p-4">
            <div className="label">Type d’offre</div>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Type d’offre">
              {OFFER_KINDS.map((k) => {
                const m = OFFER_KIND[k];
                const on = o.kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setKind(k)}
                    className={`flex min-h-12 items-start gap-2 rounded-md border p-3 text-left transition-colors ${on ? 'border-prairie bg-prairie-soft' : 'border-line-2 bg-paper hover:border-ink'}`}
                  >
                    <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border ${on ? 'border-prairie bg-prairie text-white' : 'border-line-2'}`}>{on && <Check className="size-3.5" />}</span>
                    <span>
                      <span className={`block text-sm font-bold ${on ? 'text-prairie-deep' : ''}`}>{m.label}</span>
                      <span className="block text-xs text-ink-3">{m.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Textes */}
          <section className="card-flat flex flex-col gap-4 p-4">
            <LocalizedField label="Surtitre" value={o.eyebrow} onChange={(v) => patch({ eyebrow: v })} />
            <LocalizedField label="Titre" value={o.title} onChange={(v) => patch({ title: v })} required errors={{ fr: errors['title.fr'], ar: errors['title.ar'] }} />
            <LocalizedField label="Sous-titre" value={o.subtitle} onChange={(v) => patch({ subtitle: v })} />
            <div>
              <LocalizedField label="Pastille" value={o.badge} onChange={(v) => patch({ badge: v })} />
              <p className="help">Facultative. Par exemple « Économisez 6 DT » ou « -20 % ».</p>
            </div>
          </section>

          {/* Prix */}
          <section className="card-flat grid gap-4 p-4 sm:grid-cols-2">
            <Input label="Prix (DT)" inputMode="decimal" placeholder="49,900" value={d.price} onChange={(e) => patchDraft({ price: e.target.value })} error={errors.price} help="Facultatif. Le prix du pack, affiché en gros." />
            <Input label="Ancien prix (DT)" inputMode="decimal" placeholder="55,900" value={d.compare_at} onChange={(e) => patchDraft({ compare_at: e.target.value })} error={errors.compare_at} help="Facultatif. Affiché barré, à côté du prix." />
          </section>

          {/* Photo */}
          <section className="card-flat flex flex-col gap-3 p-4">
            <ImageUploader single label="Photo" value={o.image ? [o.image] : []} onChange={(v) => patch({ image: v[0] ?? '' })} pathPrefix={`offers/${o.id}`} />
            {catalogImages.length > 0 && (
              <div>
                <div className="label">Ou une photo du catalogue</div>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
                  {catalogImages.map((im) => {
                    const on = o.image === im.src;
                    return (
                      <button
                        key={im.src}
                        type="button"
                        aria-pressed={on}
                        aria-label={im.name}
                        title={im.name}
                        onClick={() => patch({ image: on ? '' : im.src })}
                        className={`relative aspect-square overflow-hidden rounded-md border-2 bg-cream ${on ? 'border-prairie' : 'border-transparent hover:border-line-2'}`}
                      >
                        <img src={imageUrl(im.src)} alt="" className="size-full object-cover" loading="lazy" />
                        {on && (
                          <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-pill bg-prairie text-white">
                            <Check className="size-3.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
                    {/* Lien et fin */}
          <section className="card-flat flex flex-col gap-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Le bouton mène vers" value={d.linkMode} onChange={(e) => setLinkMode(e.target.value as LinkMode)}>
                <option value="category">Une catégorie</option>
                <option value="product">Un produit</option>
                <option value="url">Une adresse du site</option>
              </Select>
              {d.linkMode === 'category' ? (
                <Select label="Catégorie" value={o.link} onChange={(e) => patch({ link: e.target.value })} error={errors.link}>
                  <option value="">Choisir…</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={`/produits/categorie/${c.slug}`}>
                      {c.name.fr}
                    </option>
                  ))}
                </Select>
              ) : d.linkMode === 'product' ? (
                <Select label="Produit" value={o.link} onChange={(e) => patch({ link: e.target.value })} error={errors.link}>
                  <option value="">Choisir…</option>
                  {products.data?.map((p) => (
                    <option key={p.id} value={`/produits/${p.slug}`}>
                      {p.name.fr}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input label="Adresse" value={o.link} onChange={(e) => patch({ link: e.target.value })} error={errors.link} placeholder="/recettes" spellCheck={false} help="Sans la langue : /recettes, /produits, /contact." />
              )}
            </div>
            <Input
              label="Fin de l’offre"
              type="datetime-local"
              value={d.ends}
              onChange={(e) => patchDraft({ ends: e.target.value })}
              error={errors.ends_at}
              help="Vide = l’offre se termine à l’heure limite de commande du jour, tous les jours."
            />
          </section>

          {/* Produits du pack */}
          <section className="card-flat p-4">
            <h2 className="mb-1 text-base font-bold">Produits du pack</h2>
            <p className="help mb-3">« Ajouter le pack » met ces produits dans le panier du client.</p>
            {products.isPending ? (
              <SkeletonRows rows={2} height={64} />
            ) : (
              <ProductPicker products={products.data ?? []} value={o.product_slugs} onChange={setProductSlugs} />
            )}
          </section>

          {/* Bouton */}
          <section className="card-flat flex flex-col gap-4 p-4">
            <LocalizedField label="Texte du bouton" value={o.cta} onChange={(v) => patch({ cta: v })} required errors={{ fr: errors['cta.fr'], ar: errors['cta.ar'] }} />
          </section>
          {/* Réglages */}
          <section className="card-flat flex flex-col gap-3 p-4">
            <Toggle label="Active" help="Une offre inactive reste ici mais n’est pas montrée." checked={o.active} onChange={(v) => patch({ active: v })} />
            <Input label="Ordre" inputMode="numeric" value={d.sort} onChange={(e) => patchDraft({ sort: e.target.value })} error={errors.sort} help="Les petits nombres passent devant." />
          </section>
        </div>

        {/* Colonne de droite : l'aperçu, qui suit le défilement sur ordinateur */}
        <div className="order-first lg:order-none lg:col-span-2">
          <section className="lg:sticky lg:top-[calc(var(--header-h)+2.5rem)]">
            <div className="label">Aperçu, en français</div>
            <OfferPreview o={preview} />
            <p className="help">Ce que verra le client, à quelques détails près.</p>
          </section>
        </div>
      </div>

      <div className="sticky bottom-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom))] mt-4 flex justify-end gap-2 border-t border-line bg-cream/95 py-3 backdrop-blur md:bottom-0">
        {Object.keys(errors).length > 0 && <span className="error mr-auto self-center">Vérifiez les champs en rouge.</span>}
        <button type="button" className="btn-ghost" onClick={() => navigate('/offres')}>
          Annuler
        </button>
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Multi-sélection des produits, avec vignettes.
// ---------------------------------------------------------------------------

function ProductPicker({ products, value, onChange }: { products: Product[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (slug: string) => onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  const sorted = [...products].sort((a, b) => a.sort - b.sort || a.name.fr.localeCompare(b.name.fr));
  return (
    <div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {sorted.map((p) => {
          const on = value.includes(p.slug);
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.slug)}
                className={`flex min-h-12 w-full items-center gap-2 rounded-md border p-1.5 pr-2 text-left transition-colors ${on ? 'border-prairie bg-prairie-soft' : 'border-line bg-paper hover:border-ink'}`}
              >
                <img src={imageUrl(p.images[0] ?? '')} alt="" className="size-10 shrink-0 rounded-sm bg-cream object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name.fr}</span>
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-pill border ${on ? 'border-prairie bg-prairie text-white' : 'border-line-2'}`}>{on && <Check className="size-3.5" />}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {value.length > 0 && (
        <p className="help">
          {value.length} produit{value.length > 1 ? 's' : ''} dans le pack.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aperçu : une carte proche de ce que la boutique affiche.
// ---------------------------------------------------------------------------

const PREVIEW_COUNTDOWN = ['08', '23', '59'] as const;

export function OfferPreview({ o }: { o: Offer }) {
  const m = OFFER_KIND[o.kind];
  return (
    <div className="card overflow-hidden border border-line" aria-hidden="true">
      <div className="flex gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-bold uppercase tracking-[0.12em] ${m.cls}`}>{o.eyebrow.fr || m.label}</div>
          <div className="mt-1 font-display text-lg font-bold leading-tight">{o.title.fr || 'Titre de l’offre'}</div>
          {o.subtitle.fr && <div className="mt-1 text-sm text-ink-2">{o.subtitle.fr}</div>}
          {o.badge.fr && <span className="chip mt-2 bg-yolk text-ink">{o.badge.fr}</span>}
          {o.price != null && (
            <div className="mt-2 flex items-baseline gap-2 tabular">
              <span className="font-display text-xl font-bold">{formatPrice(o.price, 'fr')}</span>
              {o.compare_at != null && <span className="text-sm text-ink-3 line-through">{formatPrice(o.compare_at, 'fr')}</span>}
            </div>
          )}
          {o.kind === 'deal' && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs text-ink-3">Il reste</span>
              {PREVIEW_COUNTDOWN.map((v, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="rounded-sm bg-ink px-1.5 py-0.5 font-display text-sm font-bold text-white tabular">{v}</span>
                  {i < PREVIEW_COUNTDOWN.length - 1 && <span className="text-sm font-bold text-ink-3">:</span>}
                </span>
              ))}
            </div>
          )}
          <span className="btn-primary btn-sm mt-3">{o.cta.fr || 'Commander'}</span>
        </div>
        <div className="size-28 shrink-0 overflow-hidden rounded-md bg-cream sm:size-32">
          {o.image && <img src={imageUrl(o.image)} alt="" className="size-full object-cover" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />}
        </div>
      </div>
    </div>
  );
}
