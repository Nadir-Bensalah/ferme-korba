import { Link } from 'react-router-dom';
import { Pencil, Percent, Plus, Trash2 } from 'lucide-react';
import { formatPrice, type Localized, type Offer, type OfferKind } from '@ferme/core';
import { source } from '@/lib/data';
import { qk, useOffers } from '@/lib/queries';
import { fmtDateTime, imageUrl } from '@/lib/format';
import { useMutate } from '@/hooks/useMutate';
import { useConfirm } from '@/hooks/useConfirm';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

/** Les trois types d'offre : libellé, aide, surtitre proposé, couleur du surtitre. */
export const OFFER_KIND: Record<OfferKind, { label: string; hint: string; eyebrow: Localized; cls: string; chip: string }> = {
  deal: {
    label: 'Offre du jour',
    hint: 'Avec un compte à rebours jusqu’à l’heure limite de commande.',
    eyebrow: { fr: 'Offre du jour', ar: 'عرض اليوم' },
    cls: 'text-paprika',
    chip: 'bg-paprika-soft text-paprika',
  },
  combo: {
    label: 'Pack combiné',
    hint: 'Plusieurs produits ensemble, ajoutés au panier d’un coup.',
    eyebrow: { fr: 'Pack combiné', ar: 'باقة مشتركة' },
    cls: 'text-prairie',
    chip: 'bg-prairie-soft text-prairie-deep',
  },
  season: {
    label: 'Spécial saison',
    hint: 'Une mise en avant pour une période : Aïd, été, fêtes.',
    eyebrow: { fr: 'Spécial saison', ar: 'خاص بالموسم' },
    cls: 'text-yolk-deep',
    chip: 'bg-yolk-soft text-yolk-deep',
  },
};

export const OFFER_KINDS: OfferKind[] = ['deal', 'combo', 'season'];

/** Fin lisible : la date, ou la règle de l'offre du jour. */
export function offerEndText(o: Pick<Offer, 'kind' | 'ends_at'>): string {
  if (o.ends_at) return fmtDateTime(o.ends_at);
  return o.kind === 'deal' ? 'À l’heure limite du jour' : 'Pas de date de fin';
}

export function Offers() {
  const offers = useOffers();
  const confirm = useConfirm();
  const del = useMutate((id: string) => source.deleteOffer(id), { invalidate: [qk.offers], success: 'Offre supprimée' });
  const toggle = useMutate((o: Offer) => source.upsertOffer(o), { invalidate: [qk.offers], success: 'Offre mise à jour' });

  const remove = async (o: Offer) => {
    const c = await confirm({ title: `Supprimer « ${o.title.fr} » ?`, message: 'L’offre disparaît de la boutique tout de suite.', confirmLabel: 'Supprimer', danger: true });
    if (c.ok) del.mutate(o.id);
  };

  const rows = [...(offers.data ?? [])].sort((a, b) => a.sort - b.sort || a.title.fr.localeCompare(b.title.fr));

  return (
    <div>
      <PageHeader
        title="Offres"
        subtitle={offers.data ? `${offers.data.filter((o) => o.active).length} active${offers.data.filter((o) => o.active).length > 1 ? 's' : ''} sur ${offers.data.length}` : undefined}
        actions={
          <Link to="/offres/nouvelle" className="btn-primary btn-sm">
            <Plus className="size-4" /> Nouvelle offre
          </Link>
        }
      />
      {offers.isPending ? (
        <SkeletonRows rows={3} height={88} />
      ) : offers.isError ? (
        <ErrorState error={offers.error} retry={() => void offers.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Percent className="size-8" />}
          title="Aucune offre"
          hint="Une offre du jour, un pack ou une mise en avant de saison, affichés sur l’accueil et la boutique."
          action={
            <Link to="/offres/nouvelle" className="btn-primary btn-sm">
              <Plus className="size-4" /> Créer une offre
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((o) => {
            const kind = OFFER_KIND[o.kind];
            return (
              <li key={o.id} className={`card-flat flex items-center gap-3 p-2 pr-3 ${o.active ? '' : 'opacity-70'}`}>
                <Link to={`/offres/${o.id}`} className="shrink-0">
                  <img src={imageUrl(o.image)} alt="" className="size-16 rounded-md bg-cream object-cover sm:size-20" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                </Link>
                <Link to={`/offres/${o.id}`} className="min-w-0 flex-1">
                  <div className={`truncate text-[11px] font-bold uppercase tracking-wider ${kind.cls}`}>{o.eyebrow.fr || kind.label}</div>
                  <div className="truncate font-semibold">{o.title.fr}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                    <span className={`chip ${kind.chip}`}>{kind.label}</span>
                    {o.price != null && (
                      <span className="tabular">
                        <span className="font-semibold text-ink">{formatPrice(o.price, 'fr')}</span>
                        {o.compare_at != null && <span className="ml-1 line-through">{formatPrice(o.compare_at, 'fr')}</span>}
                      </span>
                    )}
                    {o.price == null && o.badge.fr && <span className="font-semibold text-ink">{o.badge.fr}</span>}
                    <span>Fin : {offerEndText(o)}</span>
                    <span>Ordre {o.sort}</span>
                  </div>
                </Link>
                <button
                  type="button"
                  role="switch"
                  aria-checked={o.active}
                  aria-label={`${o.active ? 'Désactiver' : 'Activer'} « ${o.title.fr} »`}
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ ...o, active: !o.active })}
                  className="flex min-h-12 shrink-0 items-center gap-2 px-1"
                >
                  <span className="hidden text-xs font-semibold text-ink-3 sm:inline">{o.active ? 'Active' : 'Inactive'}</span>
                  <span className={`relative h-7 w-12 shrink-0 rounded-pill transition-colors ${o.active ? 'bg-prairie' : 'bg-line-2'}`}>
                    <span className={`absolute top-0.5 size-6 rounded-pill bg-paper shadow-card transition-transform ${o.active ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                  </span>
                </button>
                <div className="hidden shrink-0 gap-1 sm:flex">
                  <Link to={`/offres/${o.id}`} className="btn-ghost btn-icon size-10" aria-label="Modifier">
                    <Pencil className="size-4" />
                  </Link>
                  <button type="button" className="btn-ghost btn-icon size-10 text-paprika" aria-label="Supprimer" onClick={() => void remove(o)}>
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
