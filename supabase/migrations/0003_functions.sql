-- Ferme Korba : fonctions.
-- La référence des règles est packages/core/src/orders.ts (buildOrder,
-- NEXT_STATUSES, applyWeighing) et money.ts (clampQty, lineTotal, deliveryFee).
-- Chaque fonction ici applique les mêmes règles, dans le même ordre, avec les
-- mêmes codes d'erreur, pour que le client mappe OrderError sans surprise.
--
-- Erreurs : raise exception using message = '<code>'. Le client lit error.message.
--   invalid, bot, shop_closed, zone_unknown, slot_unknown, slot_day,
--   date_not_allowed, product_unknown, product_unavailable, min_order
-- et, pour les fonctions d'administration : forbidden, not_found, bad_transition.

-- ---------------------------------------------------------------------------
-- Utilitaires internes (schéma private, jamais exposés)
-- ---------------------------------------------------------------------------

-- Arrondi au millime, comme roundMillimes().
create or replace function private.round_millimes(v numeric) returns numeric
language sql immutable as $$
  select round(v, 3);
$$;

-- Bornes de quantité selon le mode de vente, comme qtyBounds().
create or replace function private.qty_bounds(pricing jsonb, out min_qty numeric, out max_qty numeric)
language plpgsql immutable as $$
begin
  if pricing ->> 'mode' = 'per_kg' then
    min_qty := (pricing ->> 'min_kg')::numeric;
    max_qty := coalesce((pricing ->> 'max_kg')::numeric, 20);
  else
    min_qty := coalesce((pricing ->> 'min_qty')::numeric, 1);
    max_qty := coalesce((pricing ->> 'max_qty')::numeric, 30);
  end if;
end;
$$;

-- Ramène une quantité sur le pas et dans les bornes, comme clampQty().
create or replace function private.clamp_qty(pricing jsonb, qty numeric) returns numeric
language plpgsql immutable as $$
declare
  v_min numeric;
  v_max numeric;
  v_step numeric := case when pricing ->> 'mode' = 'per_kg' then (pricing ->> 'step_kg')::numeric else 1 end;
  v_snapped numeric;
begin
  select b.min_qty, b.max_qty into v_min, v_max from private.qty_bounds(pricing) b;
  if qty is null then
    return v_min;
  end if;
  v_snapped := round(qty / v_step, 0) * v_step;
  return private.round_millimes(least(v_max, greatest(v_min, v_snapped)));
end;
$$;

-- Montant estimé d'une ligne, comme lineTotal().
create or replace function private.line_total(pricing jsonb, qty numeric) returns numeric
language sql immutable as $$
  select private.round_millimes(
    case pricing ->> 'mode'
      when 'per_piece' then (pricing ->> 'price')::numeric * qty
      when 'per_kg_estimated' then (pricing ->> 'price_per_kg')::numeric * (pricing ->> 'est_weight_kg')::numeric * qty
      else (pricing ->> 'price_per_kg')::numeric * qty
    end);
$$;

-- Frais de livraison selon la zone et le sous-total, comme deliveryFee().
create or replace function private.delivery_fee(fee numeric, free_from numeric, subtotal numeric) returns numeric
language sql immutable as $$
  select case when free_from > 0 and subtotal >= free_from then 0 else private.round_millimes(fee) end;
$$;

-- Transitions autorisées, copie de NEXT_STATUSES.
create or replace function private.can_transition(p_from public.order_status, p_to public.order_status) returns boolean
language sql immutable as $$
  select case p_from
    when 'nouvelle' then p_to in ('confirmee', 'annulee')
    when 'confirmee' then p_to in ('en_preparation', 'annulee')
    when 'en_preparation' then p_to in ('en_livraison', 'livree', 'annulee')
    when 'en_livraison' then p_to in ('livree', 'refusee')
    else false
  end;
$$;

-- Comparaison en temps constant de deux chaînes courtes (jetons).
create or replace function private.const_time_eq(a text, b text) returns boolean
language plpgsql immutable as $$
declare
  v_a bytea := convert_to(coalesce(a, ''), 'UTF8');
  v_b bytea := convert_to(coalesce(b, ''), 'UTF8');
  v_len integer := length(v_a);
  v_diff integer := length(v_a) # length(v_b);
  i integer;
begin
  -- On parcourt toujours toute la longueur de a, sans sortir plus tôt.
  for i in 0 .. v_len - 1 loop
    v_diff := v_diff | (get_byte(v_a, i) # get_byte(v_b, i % greatest(length(v_b), 1)));
  end loop;
  return v_diff = 0 and length(v_b) > 0;
end;
$$;

-- Heure locale de la ferme.
create or replace function private.tunis_now() returns timestamp
language sql stable as $$
  select (now() at time zone 'Africa/Tunis');
$$;

-- Date de livraison autorisée, comme isDeliveryDateAllowed(), en heure de Tunis.
create or replace function private.is_delivery_date_allowed(
  p_date date, p_max_days_ahead integer, p_cutoff text, p_closed_days integer[], p_lead_days integer
) returns boolean
language plpgsql stable as $$
declare
  v_now timestamp := private.tunis_now();
  v_today date := v_now::date;
  v_past_cutoff boolean := v_now::time >= (p_cutoff || ':00')::time;
  v_first date := v_today + greatest(p_lead_days, case when v_past_cutoff then 1 else 0 end);
  v_last date := v_today + p_max_days_ahead;
begin
  if p_date is null then
    return false;
  end if;
  if p_date < v_first or p_date > v_last then
    return false;
  end if;
  if extract(dow from p_date)::integer = any (p_closed_days) then
    return false;
  end if;
  return true;
end;
$$;

-- Prochain numéro de commande FK-AAAA-00042, sans trou : la ligne du compteur
-- est verrouillée le temps de la transaction qui crée la commande.
create or replace function private.next_order_number() returns text
language plpgsql as $$
declare
  v_year integer := extract(year from private.tunis_now())::integer;
  v_seq integer;
begin
  insert into public.order_counters (year, last_seq) values (v_year, 1)
  on conflict (year) do update set last_seq = public.order_counters.last_seq + 1
  returning last_seq into v_seq;
  return 'FK-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

-- Une commande complète, forme identique à select('*, order_items(*), order_events(*)')
-- pour que le client n'ait qu'un seul mappage.
create or replace function private.order_json(p_id uuid) returns jsonb
language sql stable as $$
  select to_jsonb(o)
    || jsonb_build_object(
      'order_items', coalesce((
        select jsonb_agg(to_jsonb(i) order by i.sort, i.id)
        from public.order_items i where i.order_id = o.id), '[]'::jsonb),
      'order_events', coalesce((
        select jsonb_agg(to_jsonb(e) order by e.at, e.id)
        from public.order_events e where e.order_id = o.id), '[]'::jsonb))
  from public.orders o
  where o.id = p_id;
$$;

-- Résumé pour le client : jamais le jeton, jamais les notes internes ni les identifiants.
create or replace function private.order_summary(p_id uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'number', o.number,
    'status', o.status,
    'delivery_date', to_char(o.delivery_date, 'YYYY-MM-DD'),
    'slot', jsonb_build_object('id', o.slot_id, 'label', o.slot_label, 'from', o.slot_from, 'to', o.slot_to),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name, 'qty', i.qty, 'pricing', i.pricing, 'line_total', i.line_total,
        'image', i.image, 'slug', i.slug) order by i.sort, i.id)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'final_total', o.final_total,
    'history', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('status', e.status, 'at', e.at, 'note', e.note)) order by e.at, e.id)
      from public.order_events e where e.order_id = o.id), '[]'::jsonb),
    'created_at', o.created_at,
    'address', jsonb_build_object(
      'zone_id', o.zone_id, 'zone_name', o.zone_name, 'street', o.street, 'city', o.city, 'landmark', o.landmark),
    'customer', jsonb_build_object('name', o.customer_name, 'phone', o.customer_phone))
  from public.orders o
  where o.id = p_id;
$$;

-- ---------------------------------------------------------------------------
-- create_order(input jsonb) : la seule façon de créer une commande.
-- ---------------------------------------------------------------------------

create or replace function public.create_order(input jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_settings public.settings%rowtype;
  v_zone public.delivery_zones%rowtype;
  v_slot public.delivery_slots%rowtype;
  v_lang text;
  v_name text;
  v_phone text;
  v_email text;
  v_zone_id text;
  v_street text;
  v_city text;
  v_landmark text;
  v_date_text text;
  v_date date;
  v_slot_id text;
  v_notes text;
  v_items jsonb;
  v_item jsonb;
  v_pid text;
  v_qty numeric;
  v_merged jsonb := '[]'::jsonb;
  v_idx integer;
  v_found boolean;
  v_product public.products%rowtype;
  v_line_qty numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_fee numeric;
  v_total numeric;
  v_order_id uuid := gen_random_uuid();
  v_number text;
  v_token text;
  v_user uuid := auth.uid();
  v_sort integer := 0;
  v_recent integer;
begin
  if input is null or jsonb_typeof(input) <> 'object' then
    raise exception using message = 'invalid';
  end if;

  -- Champ piège : un robot le remplit, un humain ne le voit pas.
  if coalesce(input ->> 'website', '') <> '' then
    raise exception using message = 'bot';
  end if;

  -- Langue.
  v_lang := input ->> 'lang';
  if v_lang is null or v_lang not in ('fr', 'ar') then
    raise exception using message = 'invalid';
  end if;

  -- Client.
  if jsonb_typeof(input -> 'customer') <> 'object' then
    raise exception using message = 'invalid';
  end if;
  v_name := private.clean_text(input -> 'customer' ->> 'name');
  if v_name is null or length(v_name) < 2 or length(v_name) > 60
     or v_name !~ '^[[:alpha:]\u0610-\u061a\u064b-\u065f\u0670][[:alpha:]\u0610-\u061a\u064b-\u065f\u0670[:space:]''’.-]{1,59}$' then
    raise exception using message = 'invalid';
  end if;
  v_phone := input -> 'customer' ->> 'phone';
  if v_phone is null or length(trim(v_phone)) < 8 or length(trim(v_phone)) > 20 then
    raise exception using message = 'invalid';
  end if;
  v_phone := private.normalize_phone(v_phone);
  if v_phone is null then
    raise exception using message = 'invalid';
  end if;
  v_email := nullif(lower(trim(coalesce(input -> 'customer' ->> 'email', ''))), '');
  if v_email is not null and (length(v_email) > 120 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then
    raise exception using message = 'invalid';
  end if;

  -- Adresse.
  if jsonb_typeof(input -> 'address') <> 'object' then
    raise exception using message = 'invalid';
  end if;
  v_zone_id := input -> 'address' ->> 'zone_id';
  v_street := private.clean_text(input -> 'address' ->> 'street');
  v_city := private.clean_text(input -> 'address' ->> 'city');
  v_landmark := nullif(private.clean_text(input -> 'address' ->> 'landmark'), '');
  if v_zone_id is null or length(v_zone_id) not between 1 and 64
     or length(v_street) not between 5 and 200
     or length(v_city) not between 2 and 80
     or length(coalesce(v_landmark, '')) > 160 then
    raise exception using message = 'invalid';
  end if;

  -- Date, créneau, notes, lignes.
  v_date_text := input ->> 'delivery_date';
  if v_date_text is null or v_date_text !~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$' then
    raise exception using message = 'invalid';
  end if;
  begin
    v_date := v_date_text::date;
  exception when others then
    raise exception using message = 'invalid';
  end;
  v_slot_id := input ->> 'slot_id';
  if v_slot_id is null or length(v_slot_id) not between 1 and 64 then
    raise exception using message = 'invalid';
  end if;
  v_notes := nullif(private.clean_text(input ->> 'notes'), '');
  if length(coalesce(v_notes, '')) > 300 then
    raise exception using message = 'invalid';
  end if;
  v_items := input -> 'items';
  if v_items is null or jsonb_typeof(v_items) <> 'array'
     or jsonb_array_length(v_items) < 1 or jsonb_array_length(v_items) > 40 then
    raise exception using message = 'invalid';
  end if;
  for v_item in select value from jsonb_array_elements(v_items) loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'qty') <> 'number' then
      raise exception using message = 'invalid';
    end if;
    v_pid := v_item ->> 'product_id';
    v_qty := (v_item ->> 'qty')::numeric;
    if v_pid is null or length(v_pid) not between 1 and 64 or v_qty <= 0 or v_qty > 100 then
      raise exception using message = 'invalid';
    end if;
    -- Fusion des lignes en double sur le même produit, ordre d'apparition conservé.
    v_found := false;
    for v_idx in 0 .. jsonb_array_length(v_merged) - 1 loop
      if v_merged -> v_idx ->> 'product_id' = v_pid then
        v_merged := jsonb_set(v_merged, array[v_idx::text, 'qty'],
          to_jsonb((v_merged -> v_idx ->> 'qty')::numeric + v_qty));
        v_found := true;
        exit;
      end if;
    end loop;
    if not v_found then
      v_merged := v_merged || jsonb_build_array(jsonb_build_object('product_id', v_pid, 'qty', v_qty));
    end if;
  end loop;

  -- Limite anti-abus : pas plus de 5 commandes par téléphone et par heure.
  select count(*) into v_recent from public.orders
  where customer_phone = v_phone and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception using message = 'invalid';
  end if;

  -- Boutique, zone, créneau, date, jour du créneau.
  select * into v_settings from public.settings where id = 1;
  if not found or not v_settings.shop_open then
    raise exception using message = 'shop_closed';
  end if;

  select * into v_zone from public.delivery_zones where id = v_zone_id and active;
  if not found then
    raise exception using message = 'zone_unknown';
  end if;

  select * into v_slot from public.delivery_slots where id = v_slot_id and active;
  if not found then
    raise exception using message = 'slot_unknown';
  end if;

  if not private.is_delivery_date_allowed(
    v_date, v_settings.max_days_ahead, v_settings.cutoff_time, v_settings.closed_days, v_zone.lead_days) then
    raise exception using message = 'date_not_allowed';
  end if;

  if not (extract(dow from v_date)::integer = any (v_slot.days)) then
    raise exception using message = 'slot_day';
  end if;

  -- Lignes : produit existant, pas en rupture, quantité calée.
  for v_item in select value from jsonb_array_elements(v_merged) loop
    v_pid := v_item ->> 'product_id';
    select * into v_product from public.products where id = v_pid;
    if not found then
      raise exception using message = 'product_unknown';
    end if;
    if v_product.stock = 'rupture' then
      raise exception using message = 'product_unavailable';
    end if;
    v_line_qty := private.clamp_qty(v_product.pricing, (v_item ->> 'qty')::numeric);
    v_line_total := private.line_total(v_product.pricing, v_line_qty);
    v_subtotal := v_subtotal + v_line_total;
    -- On garde la ligne en mémoire dans v_merged, elle sera insérée après la création de la commande.
    v_merged := jsonb_set(v_merged, array[v_sort::text],
      jsonb_build_object(
        'product_id', v_pid, 'qty', v_line_qty, 'line_total', v_line_total,
        'name', v_product.name, 'slug', v_product.slug,
        'image', coalesce(v_product.images[1], ''), 'pricing', v_product.pricing));
    v_sort := v_sort + 1;
  end loop;

  v_subtotal := private.round_millimes(v_subtotal);
  if v_subtotal < v_settings.min_order then
    raise exception using message = 'min_order';
  end if;
  v_fee := private.delivery_fee(v_zone.fee, v_zone.free_from, v_subtotal);
  v_total := private.round_millimes(v_subtotal + v_fee);

  -- Numéro et jeton, puis insertion.
  v_number := private.next_order_number();
  v_token := encode(extensions.gen_random_bytes(12), 'hex');

  insert into public.orders (
    id, number, status, lang,
    customer_name, customer_phone, customer_email, customer_user_id,
    zone_id, zone_name, street, city, landmark,
    delivery_date, slot_id, slot_label, slot_from, slot_to,
    subtotal, delivery_fee, total, final_total, payment, notes, tracking_token
  ) values (
    v_order_id, v_number, 'nouvelle', v_lang,
    v_name, v_phone, v_email, v_user,
    v_zone.id, v_zone.name, v_street, v_city, v_landmark,
    v_date, v_slot.id, v_slot.label, v_slot.slot_from, v_slot.slot_to,
    v_subtotal, v_fee, v_total, null, 'cod', v_notes, v_token
  );

  v_sort := 0;
  for v_item in select value from jsonb_array_elements(v_merged) loop
    insert into public.order_items (order_id, sort, product_id, name, slug, image, pricing, qty, line_total)
    values (
      v_order_id, v_sort, v_item ->> 'product_id', v_item -> 'name', v_item ->> 'slug', v_item ->> 'image',
      v_item -> 'pricing', (v_item ->> 'qty')::numeric, (v_item ->> 'line_total')::numeric);
    v_sort := v_sort + 1;
  end loop;

  insert into public.order_events (order_id, status) values (v_order_id, 'nouvelle');

  return jsonb_build_object('number', v_number, 'tracking_token', v_token);
end;
$$;
revoke execute on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Suivi sans compte : numéro + jeton secret.
-- ---------------------------------------------------------------------------

create or replace function public.get_order_by_token(p_number text, p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_token text;
begin
  if p_number is null or p_token is null or length(p_token) > 64 then
    return null;
  end if;
  select id, tracking_token into v_id, v_token
  from public.orders where number = upper(trim(p_number));
  if not found then
    -- Même coût qu'une comparaison réelle, pour ne pas révéler l'existence du numéro.
    perform private.const_time_eq(repeat('0', 24), p_token);
    return null;
  end if;
  if not private.const_time_eq(v_token, p_token) then
    return null;
  end if;
  return private.order_summary(v_id);
end;
$$;
revoke execute on function public.get_order_by_token(text, text) from public, anon, authenticated;
grant execute on function public.get_order_by_token(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Client connecté : ses commandes (par compte ou par téléphone du profil).
-- ---------------------------------------------------------------------------

create or replace function public.list_my_orders() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(private.order_summary(o.id) order by o.created_at desc), '[]'::jsonb)
  from public.orders o
  where auth.uid() is not null
    and (
      o.customer_user_id = auth.uid()
      or o.customer_phone = (select c.phone from public.customers c where c.id = auth.uid())
    );
$$;
revoke execute on function public.list_my_orders() from public, anon, authenticated;
grant execute on function public.list_my_orders() to authenticated;

-- ---------------------------------------------------------------------------
-- Formulaire de contact : insertion contrôlée, 5 messages par heure et par téléphone.
-- ---------------------------------------------------------------------------

create or replace function public.send_contact(p_name text, p_phone text, p_message text, p_website text default '')
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_name text := private.clean_text(p_name);
  v_phone text := private.normalize_phone(p_phone);
  v_message text := private.clean_text(p_message);
  v_recent integer;
begin
  if coalesce(p_website, '') <> '' then
    raise exception using message = 'bot';
  end if;
  if v_name is null or length(v_name) < 2 or length(v_name) > 60
     or v_name !~ '^[[:alpha:]\u0610-\u061a\u064b-\u065f\u0670][[:alpha:]\u0610-\u061a\u064b-\u065f\u0670[:space:]''’.-]{1,59}$' then
    raise exception using message = 'invalid';
  end if;
  if v_phone is null then
    raise exception using message = 'invalid';
  end if;
  if length(v_message) < 10 or length(v_message) > 1000 then
    raise exception using message = 'invalid';
  end if;
  select count(*) into v_recent from public.contact_messages
  where phone = v_phone and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception using message = 'invalid';
  end if;
  insert into public.contact_messages (name, phone, message) values (v_name, v_phone, v_message);
end;
$$;
revoke execute on function public.send_contact(text, text, text, text) from public, anon, authenticated;
grant execute on function public.send_contact(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Espace de gestion : changement de statut, pesée, statistiques, clients.
-- Toutes vérifient is_admin() avant quoi que ce soit.
-- ---------------------------------------------------------------------------

create or replace function public.set_order_status(p_order_id uuid, p_status public.order_status, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_current public.order_status;
  v_by text;
  v_note text := nullif(left(private.clean_text(p_note), 300), '');
begin
  if not public.is_admin() then
    raise exception using message = 'forbidden';
  end if;
  select status into v_current from public.orders where id = p_order_id for update;
  if not found then
    raise exception using message = 'not_found';
  end if;
  if not private.can_transition(v_current, p_status) then
    raise exception using message = 'bad_transition';
  end if;
  select name into v_by from public.admins where user_id = auth.uid();
  update public.orders set status = p_status where id = p_order_id;
  insert into public.order_events (order_id, status, note, by) values (p_order_id, p_status, v_note, v_by);
  return private.order_json(p_order_id);
end;
$$;
revoke execute on function public.set_order_status(uuid, public.order_status, text) from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, public.order_status, text) to authenticated;

-- Pesée : lines = [{ "item_id": uuid, "weighed_kg": number | null }, …], comme applyWeighing().
create or replace function public.set_weighed(p_order_id uuid, p_lines jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_line jsonb;
  v_item_id uuid;
  v_kg numeric;
  v_final numeric;
begin
  if not public.is_admin() then
    raise exception using message = 'forbidden';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception using message = 'invalid';
  end if;
  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    raise exception using message = 'not_found';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    begin
      v_item_id := (v_line ->> 'item_id')::uuid;
    exception when others then
      raise exception using message = 'invalid';
    end;
    if jsonb_typeof(v_line -> 'weighed_kg') = 'number' then
      v_kg := greatest(0, private.round_millimes((v_line ->> 'weighed_kg')::numeric));
    else
      v_kg := null;
    end if;
    -- Les produits à la pièce ne se pèsent pas : on les ignore, comme le client.
    update public.order_items i
    set weighed_kg = v_kg,
        final_total = case when v_kg is null then null
                           else private.round_millimes((i.pricing ->> 'price_per_kg')::numeric * v_kg) end
    where i.id = v_item_id and i.order_id = p_order_id and i.pricing ->> 'mode' <> 'per_piece';
  end loop;

  -- Total final : lignes pesées au poids réel, les autres à l'estimation, plus la livraison.
  select private.round_millimes(coalesce(sum(
    case when i.weighed_kg is not null and i.pricing ->> 'mode' <> 'per_piece'
         then (i.pricing ->> 'price_per_kg')::numeric * i.weighed_kg
         else i.line_total end), 0) + o.delivery_fee)
  into v_final
  from public.orders o
  left join public.order_items i on i.order_id = o.id
  where o.id = p_order_id
  group by o.delivery_fee;

  update public.orders set final_total = v_final where id = p_order_id;
  return private.order_json(p_order_id);
end;
$$;
revoke execute on function public.set_weighed(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_weighed(uuid, jsonb) to authenticated;

-- Tableau de bord : mêmes définitions que le mode démo (local.ts, stats()).
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_today date := private.tunis_now()::date;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception using message = 'forbidden';
  end if;

  with valid as (
    select o.id, o.status, (o.created_at at time zone 'Africa/Tunis')::date as day,
           coalesce(o.final_total, o.total) as revenue
    from public.orders o
    where o.status not in ('annulee', 'refusee')
  ),
  days as (
    select (v_today - i)::date as day from generate_series(13, 0, -1) as i
  ),
  daily as (
    select d.day, count(v.id) as orders, private.round_millimes(coalesce(sum(v.revenue), 0)) as revenue
    from days d left join valid v on v.day = d.day
    group by d.day order by d.day
  ),
  top as (
    select i.product_id, min(i.name::text)::jsonb as name, sum(i.qty) as qty
    from public.order_items i
    join valid v on v.id = i.order_id
    where v.day >= v_today - 29
    group by i.product_id
    order by sum(i.qty) desc
    limit 5
  )
  select jsonb_build_object(
    'today_orders', (select count(*) from valid where day = v_today),
    'today_revenue', (select private.round_millimes(coalesce(sum(revenue), 0)) from valid where day = v_today),
    'pending', (select count(*) from public.orders where status = 'nouvelle'),
    'week_orders', (select count(*) from valid where day >= v_today - 6),
    'week_revenue', (select private.round_millimes(coalesce(sum(revenue), 0)) from valid where day >= v_today - 6),
    'month_revenue', (select private.round_millimes(coalesce(sum(revenue), 0)) from valid where day >= v_today - 29),
    'low_stock', (select count(*) from public.products where stock <> 'en_stock'),
    'top_products', coalesce((select jsonb_agg(jsonb_build_object('product_id', product_id, 'name', name, 'qty', qty)) from top), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'orders', orders, 'revenue', revenue) order by day) from daily), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke execute on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to authenticated;

-- Clients vus par la gestion : comptes + clients sans compte (par téléphone), avec
-- nombre de commandes et total dépensé (hors annulées et refusées), comme listCustomers().
create or replace function public.admin_customers(p_q text default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_q text := nullif(lower(trim(coalesce(p_q, ''))), '');
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception using message = 'forbidden';
  end if;
  with by_phone as (
    select o.customer_phone as phone,
           count(*) as orders_count,
           private.round_millimes(coalesce(sum(coalesce(o.final_total, o.total))
             filter (where o.status not in ('annulee', 'refusee')), 0)) as total_spent,
           min(o.created_at) as first_order_at,
           (array_agg(o.customer_name order by o.created_at desc))[1] as last_name,
           (array_agg(o.customer_email order by o.created_at desc))[1] as last_email
    from public.orders o
    group by o.customer_phone
  ),
  rows_ as (
    select coalesce(c.id::text, b.phone) as id,
           coalesce(c.name, b.last_name) as name,
           coalesce(c.phone, b.phone) as phone,
           coalesce(c.email, b.last_email) as email,
           c.default_address,
           coalesce(c.created_at, b.first_order_at) as created_at,
           coalesce(b.orders_count, 0) as orders_count,
           coalesce(b.total_spent, 0) as total_spent
    from public.customers c
    full outer join by_phone b on b.phone = c.phone
  )
  select coalesce(jsonb_agg(to_jsonb(r) order by r.total_spent desc, r.created_at desc), '[]'::jsonb)
  into v_result
  from rows_ r
  where v_q is null
     or lower(r.name) like '%' || v_q || '%'
     or r.phone like '%' || replace(v_q, ' ', '') || '%';
  return v_result;
end;
$$;
revoke execute on function public.admin_customers(text) from public, anon, authenticated;
grant execute on function public.admin_customers(text) to authenticated;
