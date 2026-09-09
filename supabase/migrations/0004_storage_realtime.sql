-- Ferme Korba : photos des produits (Storage) et alerte des nouvelles commandes (Realtime).

-- ---------------------------------------------------------------------------
-- Bucket « products » : lecture publique, écriture admin, 5 Mo, images seulement.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'products', 'products', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "products: lecture publique" on storage.objects
  for select to anon, authenticated using (bucket_id = 'products');
create policy "products: envoi admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'products' and public.is_admin());
create policy "products: remplacement admin" on storage.objects
  for update to authenticated using (bucket_id = 'products' and public.is_admin())
  with check (bucket_id = 'products' and public.is_admin());
create policy "products: suppression admin" on storage.objects
  for delete to authenticated using (bucket_id = 'products' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime : l'espace de gestion écoute les insertions sur orders.
-- La RLS s'applique aussi au flux : seul un admin reçoit les lignes.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
    ) then
      alter publication supabase_realtime add table public.orders;
    end if;
  else
    create publication supabase_realtime for table public.orders;
  end if;
end;
$$;
