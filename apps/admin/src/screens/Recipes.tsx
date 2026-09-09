import { Link } from 'react-router-dom';
import { Clock, Pencil, Plus, Trash2, Users } from 'lucide-react';
import type { Recipe } from '@ferme/core';
import { source } from '@/lib/data';
import { qk, useRecipes } from '@/lib/queries';
import { imageUrl } from '@/lib/format';
import { useMutate } from '@/hooks/useMutate';
import { useConfirm } from '@/hooks/useConfirm';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

export const DIFFICULTY = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' } as const;

export function Recipes() {
  const recipes = useRecipes();
  const confirm = useConfirm();
  const del = useMutate((id: string) => source.deleteRecipe(id), { invalidate: [qk.recipes], success: 'Recette supprimée' });

  const remove = async (r: Recipe) => {
    const c = await confirm({ title: `Supprimer « ${r.title.fr} » ?`, confirmLabel: 'Supprimer', danger: true });
    if (c.ok) del.mutate(r.id);
  };

  return (
    <div>
      <PageHeader
        title="Recettes"
        actions={
          <Link to="/recettes/nouvelle" className="btn-primary btn-sm">
            <Plus className="size-4" /> Nouvelle recette
          </Link>
        }
      />
      {recipes.isPending ? (
        <SkeletonRows rows={4} height={80} />
      ) : recipes.isError ? (
        <ErrorState error={recipes.error} retry={() => void recipes.refetch()} />
      ) : recipes.data.length === 0 ? (
        <EmptyState title="Aucune recette" hint="Une recette fait vendre les produits qu'elle utilise." action={<Link to="/recettes/nouvelle" className="btn-primary btn-sm">Écrire la première</Link>} />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {recipes.data.map((r) => (
            <li key={r.id} className="card-flat flex items-center gap-3 p-2 pr-3">
              <Link to={`/recettes/${r.id}`} className="shrink-0">
                <img src={imageUrl(r.image)} alt="" className="size-20 rounded-md bg-cream object-cover" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
              </Link>
              <Link to={`/recettes/${r.id}`} className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.title.fr}</div>
                <div className="truncate text-sm text-ink-3" dir="rtl">
                  {r.title.ar}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-3">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" /> {r.duration_min} min
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {r.servings} pers.
                  </span>
                  <span>{DIFFICULTY[r.difficulty]}</span>
                  <span>{r.product_slugs.length} produit{r.product_slugs.length > 1 ? 's' : ''}</span>
                </div>
              </Link>
              <Link to={`/recettes/${r.id}`} className="btn-ghost btn-icon size-10" aria-label="Modifier">
                <Pencil className="size-4" />
              </Link>
              <button type="button" className="btn-ghost btn-icon size-10 text-paprika" aria-label="Supprimer" onClick={() => void remove(r)}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
