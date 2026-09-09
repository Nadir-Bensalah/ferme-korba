import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { displayPrice, type Product, type StockStatus } from '@ferme/core';
import { source } from '@/lib/data';
import { qk, useCategories, useProducts } from '@/lib/queries';
import { STOCK_LABEL, imageUrl } from '@/lib/format';
import { useMutate } from '@/hooks/useMutate';
import { useConfirm } from '@/hooks/useConfirm';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

const STOCK_CLS: Record<StockStatus, string> = {
  en_stock: 'bg-prairie-soft text-prairie-deep border-prairie/30',
  bientot: 'bg-yolk-soft text-yolk-deep border-yolk/50',
  rupture: 'bg-paprika-soft text-paprika border-paprika/40',
};

const MODE_LABEL = { per_piece: 'à la pièce', per_kg: 'au kilo', per_kg_estimated: 'au kilo, pesé' } as const;

export function Products() {
  const [sp, setSp] = useSearchParams();
  const products = useProducts();
  const categories = useCategories();
  const confirm = useConfirm();
  const q = sp.get('q') ?? '';
  const cat = sp.get('cat') ?? '';
  const stock = sp.get('stock') ?? '';

  const setStock = useMutate((a: { id: string; stock: StockStatus }) => source.setStock(a.id, a.stock), { invalidate: [qk.products, qk.stats], success: 'Stock mis à jour' });
  const del = useMutate((id: string) => source.deleteProduct(id), { invalidate: [qk.products, qk.stats], success: 'Produit supprimé' });

  const rows = useMemo(() => {
    let list = products.data ?? [];
    if (cat) list = list.filter((p) => p.category_id === cat);
    if (stock === 'hors') list = list.filter((p) => p.stock !== 'en_stock');
    else if (stock) list = list.filter((p) => p.stock === stock);
    if (q) {
      const n = q.toLowerCase();
      list = list.filter((p) => p.name.fr.toLowerCase().includes(n) || p.name.ar.includes(q) || p.slug.includes(n));
    }
    return [...list].sort((a, b) => a.sort - b.sort || a.name.fr.localeCompare(b.name.fr));
  }, [products.data, cat, stock, q]);

  const catName = (id: string) => categories.data?.find((c) => c.id === id)?.name.fr ?? '';
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v);
    else next.delete(k);
    setSp(next, { replace: true });
  };

  const remove = async (p: Product) => {
    const r = await confirm({ title: `Supprimer « ${p.name.fr} » ?`, message: 'Le produit disparaît de la boutique. Les commandes passées gardent leur copie.', confirmLabel: 'Supprimer', danger: true });
    if (r.ok) del.mutate(p.id);
  };

  return (
    <div>
      <PageHeader
        title="Produits"
        subtitle={products.data ? `${products.data.length} produit${products.data.length > 1 ? 's' : ''}` : undefined}
        actions={
          <Link to="/produits/nouveau" className="btn-primary btn-sm">
            <Plus className="size-4" /> Nouveau produit
          </Link>
        }
      />
      <div className="card-flat mb-3 grid gap-2 p-3 sm:grid-cols-3">
        <input type="search" className="field field-sm" placeholder="Nom ou slug" value={q} onChange={(e) => set('q', e.target.value)} aria-label="Recherche" />
        <select className="field field-sm" value={cat} onChange={(e) => set('cat', e.target.value)} aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name.fr}
            </option>
          ))}
        </select>
        <select className="field field-sm" value={stock} onChange={(e) => set('stock', e.target.value)} aria-label="Stock">
          <option value="">Tous les stocks</option>
          <option value="hors">Rupture ou bientôt</option>
          <option value="en_stock">En stock</option>
          <option value="bientot">Bientôt</option>
          <option value="rupture">Rupture</option>
        </select>
      </div>

      {products.isPending ? (
        <SkeletonRows rows={6} height={72} />
      ) : products.isError ? (
        <ErrorState error={products.error} retry={() => void products.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucun produit"
          hint={q || cat || stock ? 'Aucun produit ne correspond aux filtres.' : 'Ajoutez votre premier produit.'}
          action={
            <Link to="/produits/nouveau" className="btn-primary btn-sm">
              <Plus className="size-4" /> Nouveau produit
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((p) => {
            const price = displayPrice(p.pricing, 'fr');
            return (
              <li key={p.id} className="card-flat flex items-center gap-3 p-2 pr-3">
                <Link to={`/produits/${p.id}`} className="shrink-0">
                  <img src={imageUrl(p.images[0] ?? '')} alt="" className="size-16 rounded-md bg-cream object-cover" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                </Link>
                <Link to={`/produits/${p.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{p.name.fr}</span>
                    {p.is_featured && <Star className="size-4 shrink-0 fill-yolk text-yolk" aria-label="Mis en avant" />}
                  </div>
                  <div className="truncate text-sm text-ink-3" dir="rtl">
                    {p.name.ar}
                  </div>
                  <div className="truncate text-xs text-ink-3">
                    {catName(p.category_id)} · {price.amount} {price.unit} · {MODE_LABEL[p.pricing.mode]} · ordre {p.sort}
                  </div>
                </Link>
                <select
                  className={`field field-sm w-28 shrink-0 border font-semibold ${STOCK_CLS[p.stock]}`}
                  value={p.stock}
                  aria-label={`Stock de ${p.name.fr}`}
                  onChange={(e) => setStock.mutate({ id: p.id, stock: e.target.value as StockStatus })}
                >
                  {(Object.keys(STOCK_LABEL) as StockStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STOCK_LABEL[s]}
                    </option>
                  ))}
                </select>
                <div className="hidden shrink-0 gap-1 sm:flex">
                  <Link to={`/produits/${p.id}`} className="btn-ghost btn-icon size-10" aria-label="Modifier">
                    <Pencil className="size-4" />
                  </Link>
                  <button type="button" className="btn-ghost btn-icon size-10 text-paprika" aria-label="Supprimer" onClick={() => void remove(p)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
