import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Trash2 } from 'lucide-react';
import { fieldErrors, type Badge, type Localized, type Pricing, type Product, type StockStatus } from '@ferme/core';
import { source } from '@/lib/data';
import { qk, useCategories, useProducts } from '@/lib/queries';
import { BADGE_LABEL, STOCK_LABEL, newId } from '@/lib/format';
import { SLUG_RE, slugify } from '@/lib/slug';
import { useMutate } from '@/hooks/useMutate';
import { useConfirm } from '@/hooks/useConfirm';
import { Checkbox, Input, LocalizedField, Select, Toggle } from '@/components/Field';
import { ImageUploader } from '@/components/ImageUploader';
import { ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

interface Draft {
  id: string;
  slug: string;
  slugTouched: boolean;
  category_id: string;
  name: Localized;
  short: Localized;
  description: Localized;
  tips: Localized;
  mode: Pricing['mode'];
  price: string;
  min_qty: string;
  max_qty: string;
  price_per_kg: string;
  step_kg: string;
  min_kg: string;
  max_kg: string;
  est_weight_kg: string;
  min_weight_kg: string;
  max_weight_kg: string;
  compare_at: string;
  badges: Badge[];
  stock: StockStatus;
  is_featured: boolean;
  sort: string;
  images: string[];
}

const empty = (): Draft => ({
  id: newId(),
  slug: '',
  slugTouched: false,
  category_id: '',
  name: { fr: '', ar: '' },
  short: { fr: '', ar: '' },
  description: { fr: '', ar: '' },
  tips: { fr: '', ar: '' },
  mode: 'per_piece',
  price: '',
  min_qty: '1',
  max_qty: '',
  price_per_kg: '',
  step_kg: '0.5',
  min_kg: '0.5',
  max_kg: '',
  est_weight_kg: '',
  min_weight_kg: '',
  max_weight_kg: '',
  compare_at: '',
  badges: [],
  stock: 'en_stock',
  is_featured: false,
  sort: '10',
  images: [],
});

const s = (n: number | undefined) => (n == null ? '' : String(n));

function fromProduct(p: Product): Draft {
  const d: Draft = {
    ...empty(),
    id: p.id,
    slug: p.slug,
    slugTouched: true,
    category_id: p.category_id,
    name: { ...p.name },
    short: { ...p.short },
    description: { ...p.description },
    tips: p.tips ? { ...p.tips } : { fr: '', ar: '' },
    mode: p.pricing.mode,
    compare_at: s(p.compare_at),
    badges: [...p.badges],
    stock: p.stock,
    is_featured: p.is_featured,
    sort: String(p.sort),
    images: [...p.images],
  };
  switch (p.pricing.mode) {
    case 'per_piece':
      d.price = s(p.pricing.price);
      d.min_qty = s(p.pricing.min_qty);
      d.max_qty = s(p.pricing.max_qty);
      break;
    case 'per_kg':
      d.price_per_kg = s(p.pricing.price_per_kg);
      d.step_kg = s(p.pricing.step_kg);
      d.min_kg = s(p.pricing.min_kg);
      d.max_kg = s(p.pricing.max_kg);
      break;
    case 'per_kg_estimated':
      d.price_per_kg = s(p.pricing.price_per_kg);
      d.est_weight_kg = s(p.pricing.est_weight_kg);
      d.min_weight_kg = s(p.pricing.min_weight_kg);
      d.max_weight_kg = s(p.pricing.max_weight_kg);
      d.min_qty = s(p.pricing.min_qty);
      d.max_qty = s(p.pricing.max_qty);
      break;
  }
  return d;
}

const toNum = (v: unknown): unknown => (typeof v === 'string' ? (v.trim() === '' ? undefined : Number(v.replace(',', '.'))) : v);
const num = (m: string) => z.preprocess(toNum, z.number({ invalid_type_error: m, required_error: m }).finite().min(0, m));
const pos = (m: string) => z.preprocess(toNum, z.number({ invalid_type_error: m, required_error: m }).finite().positive(m));
const optNum = z.preprocess(toNum, z.number({ invalid_type_error: 'Nombre invalide' }).finite().min(0).optional());
const req = (m: string) => z.string().trim().min(1, m);
const loc = (m: string) => z.object({ fr: req(m), ar: req(m) });

const baseSchema = z.object({
  slug: z.string().regex(SLUG_RE, 'Lettres minuscules, chiffres et tirets seulement'),
  category_id: req('Choisissez une catégorie'),
  name: loc('Obligatoire'),
  short: loc('Obligatoire'),
  description: loc('Obligatoire'),
  compare_at: optNum,
  sort: num('Nombre requis'),
});

const pricingSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('per_piece'), price: pos('Prix requis'), min_qty: optNum, max_qty: optNum }),
  z.object({ mode: z.literal('per_kg'), price_per_kg: pos('Prix au kilo requis'), step_kg: pos('Pas requis'), min_kg: pos('Minimum requis'), max_kg: optNum }),
  z.object({
    mode: z.literal('per_kg_estimated'),
    price_per_kg: pos('Prix au kilo requis'),
    est_weight_kg: pos('Poids estimé requis'),
    min_weight_kg: optNum,
    max_weight_kg: optNum,
    min_qty: optNum,
    max_qty: optNum,
  }),
]);

export function ProductForm() {
  const { id } = useParams();
  const isNew = !id;
  const products = useProducts();
  const categories = useCategories();
  const existing = id ? products.data?.find((p) => p.id === id) : undefined;

  if (!isNew && products.isPending) return <SkeletonRows rows={8} />;
  if (!isNew && products.isError) return <ErrorState error={products.error} retry={() => void products.refetch()} />;
  if (!isNew && !existing) return <ErrorState error={new Error('Produit introuvable')} />;
  return <Form key={existing?.id ?? 'new'} initial={existing ? fromProduct(existing) : empty()} isNew={isNew} categories={categories.data ?? []} />;
}

function Form({ initial, isNew, categories }: { initial: Draft; isNew: boolean; categories: { id: string; name: Localized }[] }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  useEffect(() => {
    if (!d.slugTouched) setD((x) => ({ ...x, slug: slugify(x.name.fr) }));
  }, [d.name.fr, d.slugTouched]);

  useEffect(() => {
    if (!d.category_id && categories[0]) patch({ category_id: categories[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const save = useMutate((p: Product) => source.upsertProduct(p), {
    invalidate: [qk.products, qk.stats],
    success: isNew ? 'Produit créé' : 'Produit enregistré',
    onSuccess: () => navigate('/produits'),
  });
  const del = useMutate((pid: string) => source.deleteProduct(pid), { invalidate: [qk.products, qk.stats], success: 'Produit supprimé', onSuccess: () => navigate('/produits') });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const base = baseSchema.safeParse(d);
    const pricing = pricingSchema.safeParse(d);
    const errs: Record<string, string> = {};
    if (!base.success) Object.assign(errs, fieldErrors(base.error));
    if (!pricing.success) Object.assign(errs, fieldErrors(pricing.error));
    if (d.images.length === 0) errs.images = 'Ajoutez au moins une photo';
    setErrors(errs);
    if (!base.success || !pricing.success || Object.keys(errs).length) return;
    const b = base.data;
    const product: Product = {
      id: d.id,
      slug: b.slug,
      category_id: b.category_id,
      name: b.name,
      short: b.short,
      description: b.description,
      images: d.images,
      pricing: pricing.data,
      compare_at: b.compare_at,
      badges: d.badges,
      stock: d.stock,
      is_featured: d.is_featured,
      sort: b.sort,
      tips: d.tips.fr.trim() || d.tips.ar.trim() ? { fr: d.tips.fr.trim(), ar: d.tips.ar.trim() } : undefined,
    };
    save.mutate(product);
  };

  const remove = async () => {
    const r = await confirm({ title: `Supprimer « ${d.name.fr} » ?`, message: 'Le produit disparaît de la boutique.', confirmLabel: 'Supprimer', danger: true });
    if (r.ok) del.mutate(d.id);
  };

  const locErr = (k: string) => ({ fr: errors[`${k}.fr`], ar: errors[`${k}.ar`] });

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={isNew ? 'Nouveau produit' : d.name.fr || 'Produit'}
        back="/produits"
        actions={
          !isNew ? (
            <button type="button" className="btn-ghost btn-sm text-paprika" onClick={() => void remove()}>
              <Trash2 className="size-4" /> Supprimer
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className="card-flat flex flex-col gap-4 p-4">
            <h2 className="text-base font-bold">Présentation</h2>
            <LocalizedField label="Nom" value={d.name} onChange={(v) => patch({ name: v })} required errors={locErr('name')} />
            <Input
              label="Adresse (slug)"
              value={d.slug}
              onChange={(e) => patch({ slug: e.target.value, slugTouched: true })}
              error={errors.slug}
              help="Généré depuis le nom français. Ne le changez plus une fois le produit publié."
              spellCheck={false}
              autoCapitalize="off"
            />
            <LocalizedField label="Phrase courte" value={d.short} onChange={(v) => patch({ short: v })} required errors={locErr('short')} />
            <LocalizedField label="Description" value={d.description} onChange={(v) => patch({ description: v })} multiline rows={4} required errors={locErr('description')} />
            <LocalizedField label="Conseils (conservation, cuisson)" value={d.tips} onChange={(v) => patch({ tips: v })} multiline rows={2} />
          </section>

          <section className="card-flat flex flex-col gap-4 p-4">
            <h2 className="text-base font-bold">Prix</h2>
            <Select label="Mode de vente" value={d.mode} onChange={(e) => patch({ mode: e.target.value as Pricing['mode'] })}>
              <option value="per_piece">À la pièce (prix fixe)</option>
              <option value="per_kg">Au kilo (le client choisit un poids)</option>
              <option value="per_kg_estimated">Au kilo, pesé (le client choisit des pièces, prix ajusté à la pesée)</option>
            </Select>
            {d.mode === 'per_piece' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Input label="Prix (DT)" inputMode="decimal" value={d.price} onChange={(e) => patch({ price: e.target.value })} error={errors.price} />
                <Input label="Quantité minimum" inputMode="numeric" value={d.min_qty} onChange={(e) => patch({ min_qty: e.target.value })} error={errors.min_qty} />
                <Input label="Quantité maximum" inputMode="numeric" value={d.max_qty} onChange={(e) => patch({ max_qty: e.target.value })} error={errors.max_qty} help="Vide : 30" />
              </div>
            )}
            {d.mode === 'per_kg' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Prix au kilo (DT)" inputMode="decimal" value={d.price_per_kg} onChange={(e) => patch({ price_per_kg: e.target.value })} error={errors.price_per_kg} />
                <Input label="Pas (kg)" inputMode="decimal" value={d.step_kg} onChange={(e) => patch({ step_kg: e.target.value })} error={errors.step_kg} help="0,5 = par demi-kilo" />
                <Input label="Minimum (kg)" inputMode="decimal" value={d.min_kg} onChange={(e) => patch({ min_kg: e.target.value })} error={errors.min_kg} />
                <Input label="Maximum (kg)" inputMode="decimal" value={d.max_kg} onChange={(e) => patch({ max_kg: e.target.value })} error={errors.max_kg} help="Vide : 20" />
              </div>
            )}
            {d.mode === 'per_kg_estimated' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Prix au kilo (DT)" inputMode="decimal" value={d.price_per_kg} onChange={(e) => patch({ price_per_kg: e.target.value })} error={errors.price_per_kg} />
                <Input label="Poids estimé d'une pièce (kg)" inputMode="decimal" value={d.est_weight_kg} onChange={(e) => patch({ est_weight_kg: e.target.value })} error={errors.est_weight_kg} />
                <Input label="Poids minimum (kg)" inputMode="decimal" value={d.min_weight_kg} onChange={(e) => patch({ min_weight_kg: e.target.value })} error={errors.min_weight_kg} />
                <Input label="Poids maximum (kg)" inputMode="decimal" value={d.max_weight_kg} onChange={(e) => patch({ max_weight_kg: e.target.value })} error={errors.max_weight_kg} />
                <Input label="Pièces minimum" inputMode="numeric" value={d.min_qty} onChange={(e) => patch({ min_qty: e.target.value })} error={errors.min_qty} />
                <Input label="Pièces maximum" inputMode="numeric" value={d.max_qty} onChange={(e) => patch({ max_qty: e.target.value })} error={errors.max_qty} help="Vide : 30" />
              </div>
            )}
            <Input label="Prix barré (DT)" inputMode="decimal" value={d.compare_at} onChange={(e) => patch({ compare_at: e.target.value })} error={errors.compare_at} help="Seulement pour afficher une promo. Même unité que le prix." className="sm:max-w-xs" />
          </section>

          <section className="card-flat p-4">
            <ImageUploader value={d.images} onChange={(v) => patch({ images: v })} pathPrefix={`products/${d.slug || d.id}`} />
            {errors.images && <p className="error">{errors.images}</p>}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="card-flat flex flex-col gap-3 p-4">
            <h2 className="text-base font-bold">Boutique</h2>
            <Select label="Catégorie" value={d.category_id} onChange={(e) => patch({ category_id: e.target.value })} error={errors.category_id}>
              <option value="">Choisir…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name.fr}
                </option>
              ))}
            </Select>
            <Select label="Stock" value={d.stock} onChange={(e) => patch({ stock: e.target.value as StockStatus })}>
              {(Object.keys(STOCK_LABEL) as StockStatus[]).map((k) => (
                <option key={k} value={k}>
                  {STOCK_LABEL[k]}
                </option>
              ))}
            </Select>
            <Toggle label="Mis en avant" help="Affiché sur la page d'accueil" checked={d.is_featured} onChange={(v) => patch({ is_featured: v })} />
            <Input label="Ordre d'affichage" inputMode="numeric" value={d.sort} onChange={(e) => patch({ sort: e.target.value })} error={errors.sort} help="Du plus petit au plus grand" />
          </section>
          <section className="card-flat p-4">
            <h2 className="mb-1 text-base font-bold">Badges</h2>
            {(Object.keys(BADGE_LABEL) as Badge[]).map((b) => (
              <Checkbox key={b} label={BADGE_LABEL[b]} checked={d.badges.includes(b)} onChange={(v) => patch({ badges: v ? [...d.badges, b] : d.badges.filter((x) => x !== b) })} />
            ))}
          </section>
        </div>
      </div>

      <div className="sticky bottom-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom))] mt-4 flex justify-end gap-2 border-t border-line bg-cream/95 py-3 backdrop-blur md:bottom-0">
        {Object.keys(errors).length > 0 && <span className="error mr-auto self-center">Vérifiez les champs en rouge.</span>}
        <button type="button" className="btn-ghost" onClick={() => navigate('/produits')}>
          Annuler
        </button>
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
