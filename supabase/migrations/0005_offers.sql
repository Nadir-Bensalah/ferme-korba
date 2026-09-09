-- Ferme Korba : les offres mises en avant (offre du jour, pack combiné, spécial saison).
-- Référence : Offer dans packages/core/src/types.ts, OfferRow dans packages/core/src/data/supabase.ts.
-- Le prix d'une offre est indicatif : en caisse, ce sont les produits du pack qui comptent.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.offers (
  id            text primary key check (length(id) between 1 and 64),
  -- deal = offre du jour (compte à rebours), combo = pack combiné, season = spécial saison.
  kind          text not null default 'season' check (kind in ('deal', 'combo', 'season')),
  eyebrow       jsonb not null default '{"fr":"","ar":""}' check (private.is_localized(eyebrow)),
  title         jsonb not null check (private.is_localized(title)),
  subtitle      jsonb not null default '{"fr":"","ar":""}' check (private.is_localized(subtitle)),
  -- Pastille : « Économisez 6 DT », « -20 % ». Vide = pas de pastille.
  badge         jsonb not null default '{"fr":"","ar":""}' check (private.is_localized(badge)),
  price         numeric(12,3) check (price is null or price > 0),
  compare_at    numeric(12,3) check (compare_at is null or compare_at > 0),
  image         text not null default '',
  -- Libellé du bouton : « Commander », « Ajouter le pack ».
  cta           jsonb not null default '{"fr":"","ar":""}' check (private.is_localized(cta)),
  -- Chemin du site, sans langue ni base : /produits/categorie/oeufs.
  link          text not null default '/produits' check (link ~ '^/'),
  -- Fin de l'offre. Vide pour une offre du jour = l'heure limite de commande du jour.
  ends_at       timestamptz,
  -- Produits du pack (slugs), pour « Ajouter le pack » au panier.
  product_slugs text[] not null default '{}',
  active        boolean not null default true,
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- L'ancien prix ne sert qu'à barrer : il doit dépasser le prix.
  constraint offers_compare_above_price check (price is null or compare_at is null or compare_at > price)
);
create index offers_active_sort_idx on public.offers (active, sort);

comment on table public.offers is 'Offres mises en avant sur l''accueil et la boutique, gérées depuis l''espace de gestion.';

create trigger offers_updated_at before update on public.offers
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Droits : mêmes règles que le catalogue, mais le public ne voit que les actives.
-- ---------------------------------------------------------------------------

revoke all on public.offers from anon, authenticated;
grant select on public.offers to anon, authenticated;
grant insert, update, delete on public.offers to authenticated;

alter table public.offers enable row level security;

create policy "offers: lecture des actives" on public.offers
  for select to anon, authenticated using (active or public.is_admin());
create policy "offers: écriture admin" on public.offers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
