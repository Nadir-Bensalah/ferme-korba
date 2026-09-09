import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import type { Recipe } from '@ferme/core';
import { source } from '@/lib/data';
import { qk, useProducts, useRecipes } from '@/lib/queries';
import { newId } from '@/lib/format';
import { slugify } from '@/lib/slug';
import { useMutate } from '@/hooks/useMutate';
import { useConfirm } from '@/hooks/useConfirm';
import { Checkbox, Input, LocalizedField, Select } from '@/components/Field';
import { ImageUploader } from '@/components/ImageUploader';
import { ListEditor } from '@/components/ListEditor';
import { ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { DIFFICULTY } from './Recipes';

const blank = (): Recipe => ({
  id: newId(),
  slug: '',
  title: { fr: '', ar: '' },
  intro: { fr: '', ar: '' },
  image: '',
  duration_min: 45,
  servings: 4,
  difficulty: 1,
  ingredients: { fr: [''], ar: [''] },
  steps: { fr: [''], ar: [''] },
  product_slugs: [],
});

export function RecipeForm() {
  const { id } = useParams();
  const recipes = useRecipes();
  const existing = id ? recipes.data?.find((r) => r.id === id) : undefined;
  if (id && recipes.isPending) return <SkeletonRows rows={8} />;
  if (id && recipes.isError) return <ErrorState error={recipes.error} retry={() => void recipes.refetch()} />;
  if (id && !existing) return <ErrorState error={new Error('Recette introuvable')} />;
  return <Form key={existing?.id ?? 'new'} initial={existing ? structuredClone(existing) : blank()} isNew={!id} />;
}

function Form({ initial, isNew }: { initial: Recipe; isNew: boolean }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const products = useProducts();
  const [r, setR] = useState<Recipe>(initial);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const patch = (p: Partial<Recipe>) => setR((x) => ({ ...x, ...p }));

  useEffect(() => {
    if (!slugTouched) setR((x) => ({ ...x, slug: slugify(x.title.fr) }));
  }, [r.title.fr, slugTouched]);

  const save = useMutate((x: Recipe) => source.upsertRecipe(x), { invalidate: [qk.recipes], success: isNew ? 'Recette créée' : 'Recette enregistrée', onSuccess: () => navigate('/recettes') });
  const del = useMutate((rid: string) => source.deleteRecipe(rid), { invalidate: [qk.recipes], success: 'Recette supprimée', onSuccess: () => navigate('/recettes') });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!r.title.fr.trim()) errs['title.fr'] = 'Obligatoire';
    if (!r.title.ar.trim()) errs['title.ar'] = 'Obligatoire';
    if (!r.intro.fr.trim()) errs['intro.fr'] = 'Obligatoire';
    if (!r.intro.ar.trim()) errs['intro.ar'] = 'Obligatoire';
    if (!r.slug) errs.slug = 'Obligatoire';
    if (!(r.duration_min > 0)) errs.duration_min = 'Durée requise';
    if (!(r.servings > 0)) errs.servings = 'Nombre requis';
    const clean = (a: string[]) => a.map((s) => s.trim()).filter(Boolean);
    const ingredients = { fr: clean(r.ingredients.fr), ar: clean(r.ingredients.ar) };
    const steps = { fr: clean(r.steps.fr), ar: clean(r.steps.ar) };
    if (ingredients.fr.length === 0) errs.ingredients = 'Au moins un ingrédient en français';
    if (steps.fr.length === 0) errs.steps = 'Au moins une étape en français';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    save.mutate({ ...r, title: { fr: r.title.fr.trim(), ar: r.title.ar.trim() }, intro: { fr: r.intro.fr.trim(), ar: r.intro.ar.trim() }, ingredients, steps });
  };

  const remove = async () => {
    const c = await confirm({ title: `Supprimer « ${r.title.fr} » ?`, confirmLabel: 'Supprimer', danger: true });
    if (c.ok) del.mutate(r.id);
  };

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={isNew ? 'Nouvelle recette' : r.title.fr || 'Recette'}
        back="/recettes"
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
            <LocalizedField label="Titre" value={r.title} onChange={(v) => patch({ title: v })} required errors={{ fr: errors['title.fr'], ar: errors['title.ar'] }} />
            <Input
              label="Adresse (slug)"
              value={r.slug}
              onChange={(e) => {
                setSlugTouched(true);
                patch({ slug: e.target.value });
              }}
              error={errors.slug}
              spellCheck={false}
            />
            <LocalizedField label="Introduction" value={r.intro} onChange={(v) => patch({ intro: v })} multiline rows={3} required errors={{ fr: errors['intro.fr'], ar: errors['intro.ar'] }} />
          </section>
          <section className="card-flat grid gap-4 p-4 sm:grid-cols-2">
            <ListEditor label="Ingrédients (FR)" value={r.ingredients.fr} onChange={(v) => patch({ ingredients: { ...r.ingredients, fr: v } })} placeholder="1 poulet fermier" />
            <ListEditor label="Ingrédients (AR)" dir="rtl" value={r.ingredients.ar} onChange={(v) => patch({ ingredients: { ...r.ingredients, ar: v } })} />
            {errors.ingredients && <p className="error sm:col-span-2">{errors.ingredients}</p>}
          </section>
          <section className="card-flat grid gap-4 p-4 sm:grid-cols-2">
            <ListEditor label="Étapes (FR)" value={r.steps.fr} onChange={(v) => patch({ steps: { ...r.steps, fr: v } })} placeholder="Préchauffez le four à 200 °C" />
            <ListEditor label="Étapes (AR)" dir="rtl" value={r.steps.ar} onChange={(v) => patch({ steps: { ...r.steps, ar: v } })} />
            {errors.steps && <p className="error sm:col-span-2">{errors.steps}</p>}
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <section className="card-flat flex flex-col gap-3 p-4">
            <ImageUploader single label="Photo" value={r.image ? [r.image] : []} onChange={(v) => patch({ image: v[0] ?? '' })} pathPrefix={`recipes/${r.slug || r.id}`} />
            <Input label="Durée (minutes)" inputMode="numeric" value={String(r.duration_min)} onChange={(e) => patch({ duration_min: Number(e.target.value) || 0 })} error={errors.duration_min} />
            <Input label="Personnes" inputMode="numeric" value={String(r.servings)} onChange={(e) => patch({ servings: Number(e.target.value) || 0 })} error={errors.servings} />
            <Select label="Difficulté" value={String(r.difficulty)} onChange={(e) => patch({ difficulty: Number(e.target.value) as 1 | 2 | 3 })}>
              {([1, 2, 3] as const).map((k) => (
                <option key={k} value={k}>
                  {DIFFICULTY[k]}
                </option>
              ))}
            </Select>
          </section>
          <section className="card-flat p-4">
            <h2 className="mb-1 text-base font-bold">Produits liés</h2>
            <p className="help mb-2">Pour le bouton « Ajouter les ingrédients » sur le site.</p>
            {products.data?.map((p) => (
              <Checkbox key={p.id} label={p.name.fr} checked={r.product_slugs.includes(p.slug)} onChange={(v) => patch({ product_slugs: v ? [...r.product_slugs, p.slug] : r.product_slugs.filter((s) => s !== p.slug) })} />
            ))}
          </section>
        </div>
      </div>
      <div className="sticky bottom-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom))] mt-4 flex justify-end gap-2 border-t border-line bg-cream/95 py-3 backdrop-blur md:bottom-0">
        {Object.keys(errors).length > 0 && <span className="error mr-auto self-center">Vérifiez les champs en rouge.</span>}
        <button type="button" className="btn-ghost" onClick={() => navigate('/recettes')}>
          Annuler
        </button>
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
