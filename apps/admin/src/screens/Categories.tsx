import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Category } from '@ferme/core';
import { source } from '@/lib/data';
import { qk, useCategories, useProducts } from '@/lib/queries';
import { imageUrl, newId } from '@/lib/format';
import { slugify } from '@/lib/slug';
import { useMutate } from '@/hooks/useMutate';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { Input, LocalizedField } from '@/components/Field';
import { ImageUploader } from '@/components/ImageUploader';
import { Modal } from '@/components/Modal';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

const blank = (): Category => ({ id: newId(), slug: '', name: { fr: '', ar: '' }, description: { fr: '', ar: '' }, image: '', sort: 10 });

export function Categories() {
  const cats = useCategories();
  const products = useProducts();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<Category | null>(null);

  const save = useMutate((c: Category) => source.upsertCategory(c), { invalidate: [qk.categories], success: 'Catégorie enregistrée', onSuccess: () => setEditing(null) });
  const del = useMutate((id: string) => source.deleteCategory(id), { invalidate: [qk.categories], success: 'Catégorie supprimée' });

  const usage = (id: string) => products.data?.filter((p) => p.category_id === id).length ?? 0;

  const remove = async (c: Category) => {
    const n = usage(c.id);
    if (n > 0) {
      toast.error('Suppression bloquée', `${n} produit${n > 1 ? 's utilisent' : ' utilise'} cette catégorie. Déplacez-les d'abord.`);
      return;
    }
    const r = await confirm({ title: `Supprimer « ${c.name.fr} » ?`, confirmLabel: 'Supprimer', danger: true });
    if (r.ok) del.mutate(c.id);
  };

  return (
    <div>
      <PageHeader
        title="Catégories"
        actions={
          <button type="button" className="btn-primary btn-sm" onClick={() => setEditing(blank())}>
            <Plus className="size-4" /> Nouvelle catégorie
          </button>
        }
      />
      {cats.isPending ? (
        <SkeletonRows rows={5} height={72} />
      ) : cats.isError ? (
        <ErrorState error={cats.error} retry={() => void cats.refetch()} />
      ) : cats.data.length === 0 ? (
        <EmptyState title="Aucune catégorie" action={<button type="button" className="btn-primary btn-sm" onClick={() => setEditing(blank())}>Créer la première</button>} />
      ) : (
        <ul className="flex flex-col gap-2">
          {cats.data.map((c) => (
            <li key={c.id} className="card-flat flex items-center gap-3 p-2 pr-3">
              <img src={imageUrl(c.image)} alt="" className="size-16 shrink-0 rounded-md bg-cream object-cover" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(c)}>
                <div className="truncate font-semibold">{c.name.fr}</div>
                <div className="truncate text-sm text-ink-3" dir="rtl">
                  {c.name.ar}
                </div>
                <div className="text-xs text-ink-3">
                  {usage(c.id)} produit{usage(c.id) > 1 ? 's' : ''} · ordre {c.sort} · /{c.slug}
                </div>
              </button>
              <button type="button" className="btn-ghost btn-icon size-10" aria-label="Modifier" onClick={() => setEditing(c)}>
                <Pencil className="size-4" />
              </button>
              <button type="button" className="btn-ghost btn-icon size-10 text-paprika" aria-label="Supprimer" onClick={() => void remove(c)}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && <CategoryModal initial={editing} onClose={() => setEditing(null)} onSave={(c) => save.mutate(c)} busy={save.isPending} />}
    </div>
  );
}

function CategoryModal({ initial, onClose, onSave, busy }: { initial: Category; onClose: () => void; onSave: (c: Category) => void; busy: boolean }) {
  const [c, setC] = useState<Category>(initial);
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!c.name.fr.trim() || !c.name.ar.trim()) return setErr('Le nom est obligatoire en français et en arabe.');
    const slug = c.slug.trim() || slugify(c.name.fr);
    onSave({ ...c, slug, name: { fr: c.name.fr.trim(), ar: c.name.ar.trim() }, description: { fr: c.description.fr.trim(), ar: c.description.ar.trim() } });
  };
  return (
    <Modal
      title={initial.name.fr ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" form="cat-form" className="btn-primary" disabled={busy}>
            Enregistrer
          </button>
        </>
      }
    >
      <form id="cat-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <LocalizedField label="Nom" value={c.name} onChange={(v) => setC({ ...c, name: v, slug: c.slug || slugify(v.fr) })} required />
        <Input label="Adresse (slug)" value={c.slug} onChange={(e) => setC({ ...c, slug: e.target.value })} spellCheck={false} />
        <LocalizedField label="Description" value={c.description} onChange={(v) => setC({ ...c, description: v })} multiline rows={2} />
        <ImageUploader single label="Image" value={c.image ? [c.image] : []} onChange={(v) => setC({ ...c, image: v[0] ?? '' })} pathPrefix={`categories/${c.slug || c.id}`} />
        <Input label="Ordre" inputMode="numeric" value={String(c.sort)} onChange={(e) => setC({ ...c, sort: Number(e.target.value) || 0 })} className="max-w-32" />
        {err && <p className="error">{err}</p>}
      </form>
    </Modal>
  );
}
