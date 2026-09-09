-- Ferme Korba : droits d'accès (RLS).
--
-- Règle générale :
--   - anon et authenticated lisent le catalogue, les zones et créneaux actifs, les réglages ;
--   - ils n'écrivent JAMAIS directement : les commandes et les messages passent par
--     des fonctions (0003_functions.sql) ;
--   - un client connecté lit et modifie son propre profil, lit ses commandes via list_my_orders() ;
--   - un admin (ligne dans admins) fait tout.
-- is_admin() est déclarée dans 0001_schema.sql : Postgres vérifie son existence
-- au moment où chaque politique est créée.

-- ---------------------------------------------------------------------------
-- Droits de base sur les tables (PostgREST vérifie ces GRANT avant la RLS).
-- ---------------------------------------------------------------------------

-- On retire d'abord les droits que Supabase accorde par défaut aux nouvelles tables.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.categories, public.products, public.recipes,
  public.delivery_zones, public.delivery_slots, public.settings to anon, authenticated;

-- Écritures de l'espace de gestion (filtrées par la RLS ci-dessous : is_admin()).
grant insert, update, delete on public.categories, public.products, public.recipes,
  public.delivery_zones, public.delivery_slots, public.settings to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items, public.order_events, public.admins to authenticated;
grant select, update, delete on public.contact_messages to authenticated;
grant select, update on public.customers to authenticated;
-- order_counters n'est lu et écrit que par create_order (security definer) : aucun droit.

-- ---------------------------------------------------------------------------
-- RLS activée partout
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.recipes enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.delivery_slots enable row level security;
alter table public.settings enable row level security;
alter table public.customers enable row level security;
alter table public.admins enable row level security;
alter table public.order_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.contact_messages enable row level security;

-- ---------------------------------------------------------------------------
-- Catalogue : lecture publique, écriture admin
-- ---------------------------------------------------------------------------

create policy "categories: lecture publique" on public.categories
  for select to anon, authenticated using (true);
create policy "categories: écriture admin" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "products: lecture publique" on public.products
  for select to anon, authenticated using (true);
create policy "products: écriture admin" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "recipes: lecture publique" on public.recipes
  for select to anon, authenticated using (true);
create policy "recipes: écriture admin" on public.recipes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Zones et créneaux : le public ne voit que les actifs, l'admin voit tout.
create policy "delivery_zones: lecture des actives" on public.delivery_zones
  for select to anon, authenticated using (active or public.is_admin());
create policy "delivery_zones: écriture admin" on public.delivery_zones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "delivery_slots: lecture des actifs" on public.delivery_slots
  for select to anon, authenticated using (active or public.is_admin());
create policy "delivery_slots: écriture admin" on public.delivery_slots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "settings: lecture publique" on public.settings
  for select to anon, authenticated using (true);
create policy "settings: écriture admin" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Comptes
-- ---------------------------------------------------------------------------

-- Un client lit et modifie sa propre ligne (créée par le trigger d'inscription).
-- Il ne peut pas changer son id ni son téléphone : voir le trigger de garde plus bas.
create policy "customers: lecture de soi ou admin" on public.customers
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "customers: modification de soi ou admin" on public.customers
  for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create or replace function private.guard_customer_update() returns trigger
language plpgsql as $$
begin
  if not public.is_admin() then
    -- Le client ne touche ni à son identifiant ni à son téléphone (c'est son identifiant de connexion).
    new.id := old.id;
    new.phone := old.phone;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger customers_guard before update on public.customers
  for each row execute function private.guard_customer_update();

-- Les admins voient la liste des admins (pour afficher un nom) ; personne ne la modifie par l'API.
create policy "admins: lecture par les admins" on public.admins
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Commandes : création par create_order() uniquement, lecture et mise à jour admin.
-- Le client connecté passe par list_my_orders(), le visiteur par get_order_by_token().
-- ---------------------------------------------------------------------------

create policy "orders: lecture admin" on public.orders
  for select to authenticated using (public.is_admin());
create policy "orders: notes admin" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Par l'API, l'admin ne peut modifier que les notes : statut, pesée et montants passent
-- par set_order_status() et set_weighed(), qui journalisent.
create or replace function private.guard_order_update() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.id := old.id;
    new.number := old.number;
    new.status := old.status;
    new.lang := old.lang;
    new.customer_name := old.customer_name;
    new.customer_phone := old.customer_phone;
    new.customer_email := old.customer_email;
    new.customer_user_id := old.customer_user_id;
    new.zone_id := old.zone_id;
    new.zone_name := old.zone_name;
    new.street := old.street;
    new.city := old.city;
    new.landmark := old.landmark;
    new.delivery_date := old.delivery_date;
    new.slot_id := old.slot_id;
    new.slot_label := old.slot_label;
    new.slot_from := old.slot_from;
    new.slot_to := old.slot_to;
    new.subtotal := old.subtotal;
    new.delivery_fee := old.delivery_fee;
    new.total := old.total;
    new.final_total := old.final_total;
    new.payment := old.payment;
    new.tracking_token := old.tracking_token;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger orders_guard before update on public.orders
  for each row execute function private.guard_order_update();

create policy "order_items: lecture admin" on public.order_items
  for select to authenticated using (public.is_admin());
create policy "order_events: lecture admin" on public.order_events
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Messages de contact : insertion par send_contact(), gestion admin.
-- ---------------------------------------------------------------------------

create policy "contact_messages: lecture admin" on public.contact_messages
  for select to authenticated using (public.is_admin());
create policy "contact_messages: mise à jour admin" on public.contact_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "contact_messages: suppression admin" on public.contact_messages
  for delete to authenticated using (public.is_admin());

-- order_counters : RLS activée sans politique = personne par l'API, seule create_order y touche.
