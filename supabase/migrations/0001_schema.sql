-- Ferme Korba : schéma de la boutique (paiement à la livraison).
-- Les types de référence sont dans packages/core/src/types.ts : chaque table
-- renvoie, après mappage, exactement l'objet TypeScript correspondant.
--
-- Conventions :
--   - les identifiants du catalogue (catégories, produits, recettes, zones,
--     créneaux) sont des textes choisis par l'espace de gestion ou le seed
--     (« p-poulet-fermier ») ; ceux des commandes sont des uuid ;
--   - les textes bilingues sont des jsonb { "fr": ..., "ar": ... } ;
--   - les montants sont en dinars, numeric(12,3) : trois décimales, le millime.

create extension if not exists pgcrypto with schema extensions;

-- Schéma des fonctions internes : jamais exposé par l'API, appelé uniquement
-- par les fonctions « security definer » du schéma public et par les triggers.
create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Types et contrôles
-- ---------------------------------------------------------------------------

create type public.order_status as enum (
  'nouvelle', 'confirmee', 'en_preparation', 'en_livraison', 'livree', 'annulee', 'refusee'
);

-- Un texte bilingue est un objet avec les deux clés, chacune une chaîne.
create or replace function private.is_localized(v jsonb) returns boolean
language sql immutable as $$
  select v is not null
     and jsonb_typeof(v) = 'object'
     and jsonb_typeof(v -> 'fr') = 'string'
     and jsonb_typeof(v -> 'ar') = 'string';
$$;

-- Tableau de chaînes bilingue : { "fr": [...], "ar": [...] } (ingrédients, étapes).
create or replace function private.is_localized_list(v jsonb) returns boolean
language sql immutable as $$
  select v is not null
     and jsonb_typeof(v) = 'object'
     and jsonb_typeof(v -> 'fr') = 'array'
     and jsonb_typeof(v -> 'ar') = 'array';
$$;

-- Le prix d'un produit : trois modes, chacun avec ses champs obligatoires.
create or replace function private.is_pricing(v jsonb) returns boolean
language sql immutable as $$
  select v is not null and jsonb_typeof(v) = 'object' and (
    (v ->> 'mode' = 'per_piece'
      and jsonb_typeof(v -> 'price') = 'number' and (v ->> 'price')::numeric > 0)
    or
    (v ->> 'mode' = 'per_kg_estimated'
      and jsonb_typeof(v -> 'price_per_kg') = 'number' and (v ->> 'price_per_kg')::numeric > 0
      and jsonb_typeof(v -> 'est_weight_kg') = 'number' and (v ->> 'est_weight_kg')::numeric > 0)
    or
    (v ->> 'mode' = 'per_kg'
      and jsonb_typeof(v -> 'price_per_kg') = 'number' and (v ->> 'price_per_kg')::numeric > 0
      and jsonb_typeof(v -> 'step_kg') = 'number' and (v ->> 'step_kg')::numeric > 0
      and jsonb_typeof(v -> 'min_kg') = 'number' and (v ->> 'min_kg')::numeric > 0)
  );
$$;

-- Heure « HH:MM ».
create or replace function private.is_hhmm(v text) returns boolean
language sql immutable as $$
  select v ~ '^([01]\d|2[0-3]):[0-5]\d$';
$$;

-- updated_at tenu à jour par trigger.
create or replace function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table public.categories (
  id          text primary key check (length(id) between 1 and 64),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{1,80}$'),
  name        jsonb not null check (private.is_localized(name)),
  description jsonb not null default '{"fr":"","ar":""}' check (private.is_localized(description)),
  image       text not null default '',
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.products (
  id          text primary key check (length(id) between 1 and 64),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{1,80}$'),
  category_id text not null references public.categories (id) on delete restrict,
  name        jsonb not null check (private.is_localized(name)),
  short       jsonb not null default '{"fr":"","ar":""}' check (private.is_localized(short)),
  description jsonb not null default '{"fr":"","ar":""}' check (private.is_localized(description)),
  images      text[] not null default '{}',
  pricing     jsonb not null check (private.is_pricing(pricing)),
  compare_at  numeric(12,3) check (compare_at is null or compare_at > 0),
  badges      text[] not null default '{}'
              check (badges <@ array['fermier', 'nouveau', 'promo', 'best']::text[]),
  stock       text not null default 'en_stock' check (stock in ('en_stock', 'bientot', 'rupture')),
  is_featured boolean not null default false,
  sort        integer not null default 0,
  tips        jsonb check (tips is null or private.is_localized(tips)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index products_category_idx on public.products (category_id, sort);
create index products_featured_idx on public.products (is_featured) where is_featured;

create table public.recipes (
  id            text primary key check (length(id) between 1 and 64),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{1,80}$'),
  title         jsonb not null check (private.is_localized(title)),
  intro         jsonb not null default '{"fr":"","ar":""}' check (private.is_localized(intro)),
  image         text not null default '',
  duration_min  integer not null default 0 check (duration_min >= 0),
  servings      integer not null default 4 check (servings > 0),
  difficulty    smallint not null default 1 check (difficulty between 1 and 3),
  ingredients   jsonb not null default '{"fr":[],"ar":[]}' check (private.is_localized_list(ingredients)),
  steps         jsonb not null default '{"fr":[],"ar":[]}' check (private.is_localized_list(steps)),
  product_slugs text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Livraison et réglages
-- ---------------------------------------------------------------------------

create table public.delivery_zones (
  id         text primary key check (length(id) between 1 and 64),
  name       jsonb not null check (private.is_localized(name)),
  areas      jsonb not null default '{"fr":"","ar":""}' check (private.is_localized(areas)),
  fee        numeric(12,3) not null default 0 check (fee >= 0),
  free_from  numeric(12,3) not null default 0 check (free_from >= 0),
  lead_days  integer not null default 0 check (lead_days between 0 and 30),
  active     boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.delivery_slots (
  id         text primary key check (length(id) between 1 and 64),
  label      jsonb not null check (private.is_localized(label)),
  -- « from » et « to » sont des mots réservés : colonnes préfixées, remappées côté client.
  slot_from  text not null check (private.is_hhmm(slot_from)),
  slot_to    text not null check (private.is_hhmm(slot_to)),
  days       integer[] not null default '{1,2,3,4,5,6}' check (days <@ array[0,1,2,3,4,5,6]),
  active     boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une seule ligne de réglages : id = 1, imposé par contrainte.
create table public.settings (
  id             integer primary key default 1 check (id = 1),
  shop_open      boolean not null default true,
  announcement   jsonb not null default '{"fr":"","ar":""}' check (private.is_localized(announcement)),
  min_order      numeric(12,3) not null default 0 check (min_order >= 0),
  max_days_ahead integer not null default 6 check (max_days_ahead between 0 and 60),
  cutoff_time    text not null default '18:00' check (private.is_hhmm(cutoff_time)),
  closed_days    integer[] not null default '{0}' check (closed_days <@ array[0,1,2,3,4,5,6]),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Comptes
-- ---------------------------------------------------------------------------

-- Profil client, une ligne par utilisateur Auth inscrit avec un téléphone.
create table public.customers (
  id              uuid primary key references auth.users (id) on delete cascade,
  name            text not null check (length(name) between 1 and 60),
  phone           text not null unique check (phone ~ '^\+216[2-579]\d{7}$'),
  email           text check (email is null or length(email) <= 120),
  default_address jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Qui a le droit d'ouvrir l'espace de gestion. Ajout à la main (voir docs/SUPABASE.md).
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null default 'Admin' check (length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- is_admin() : une ligne dans admins pour l'utilisateur courant. Déclarée ici
-- parce que les politiques (0002) la référencent dès leur création.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Commandes
-- ---------------------------------------------------------------------------

-- Compteur par année pour les numéros FK-2026-00042.
create table public.order_counters (
  year     integer primary key,
  last_seq integer not null default 0
);

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,
  status           public.order_status not null default 'nouvelle',
  lang             text not null default 'fr' check (lang in ('fr', 'ar')),
  -- Client (instantané, même s'il a un compte).
  customer_name    text not null,
  customer_phone   text not null,
  customer_email   text,
  customer_user_id uuid references auth.users (id) on delete set null,
  -- Adresse : la zone est copiée (id + nom) pour rester lisible si elle change.
  zone_id          text not null,
  zone_name        jsonb not null check (private.is_localized(zone_name)),
  street           text not null,
  city             text not null,
  landmark         text,
  -- Livraison : le créneau est copié lui aussi.
  delivery_date    date not null,
  slot_id          text not null,
  slot_label       jsonb not null check (private.is_localized(slot_label)),
  slot_from        text not null,
  slot_to          text not null,
  -- Montants.
  subtotal         numeric(12,3) not null check (subtotal >= 0),
  delivery_fee     numeric(12,3) not null check (delivery_fee >= 0),
  total            numeric(12,3) not null check (total >= 0),
  final_total      numeric(12,3) check (final_total is null or final_total >= 0),
  payment          text not null default 'cod' check (payment = 'cod'),
  notes            text,
  -- Jeton secret de suivi sans compte (24 caractères hexadécimaux).
  tracking_token   text not null unique check (tracking_token ~ '^[0-9a-f]{24}$'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_delivery_date_idx on public.orders (delivery_date, slot_id);
create index orders_phone_idx on public.orders (customer_phone, created_at desc);
create index orders_created_idx on public.orders (created_at desc);
create index orders_customer_user_idx on public.orders (customer_user_id) where customer_user_id is not null;
create index orders_zone_idx on public.orders (zone_id);

create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  sort        integer not null default 0,
  product_id  text not null,
  -- Instantané du produit au moment de la commande.
  name        jsonb not null check (private.is_localized(name)),
  slug        text not null,
  image       text not null default '',
  pricing     jsonb not null check (private.is_pricing(pricing)),
  qty         numeric(10,3) not null check (qty > 0),
  line_total  numeric(12,3) not null check (line_total >= 0),
  weighed_kg  numeric(10,3) check (weighed_kg is null or weighed_kg >= 0),
  final_total numeric(12,3) check (final_total is null or final_total >= 0)
);
create index order_items_order_idx on public.order_items (order_id, sort);
create index order_items_product_idx on public.order_items (product_id);

-- Historique des statuts : une ligne par changement, la première à la création.
create table public.order_events (
  id       bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status   public.order_status not null,
  at       timestamptz not null default now(),
  note     text,
  by       text
);
create index order_events_order_idx on public.order_events (order_id, at);

-- ---------------------------------------------------------------------------
-- Contact
-- ---------------------------------------------------------------------------

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  message    text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index contact_messages_phone_idx on public.contact_messages (phone, created_at desc);
create index contact_messages_unread_idx on public.contact_messages (created_at desc) where not read;

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------

create trigger categories_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();
create trigger recipes_updated_at before update on public.recipes
  for each row execute function private.set_updated_at();
create trigger delivery_zones_updated_at before update on public.delivery_zones
  for each row execute function private.set_updated_at();
create trigger delivery_slots_updated_at before update on public.delivery_slots
  for each row execute function private.set_updated_at();
create trigger settings_updated_at before update on public.settings
  for each row execute function private.set_updated_at();
create trigger customers_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger orders_updated_at before update on public.orders
  for each row execute function private.set_updated_at();

-- Ligne de réglages par défaut, pour que la boutique tourne dès la première migration.
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profil client créé à l'inscription
-- ---------------------------------------------------------------------------
-- Le client s'inscrit avec un téléphone et un mot de passe. Côté Auth, c'est un
-- compte e-mail/mot de passe dont l'e-mail est technique (216XXXXXXXX@clients.…),
-- et les métadonnées portent { name, phone, email }. Ce trigger crée le profil.
-- Un utilisateur sans « phone » dans ses métadonnées (un admin) n'a pas de profil client.

-- Deux utilitaires partagés par le trigger ci-dessous et par create_order.

-- Retire les balises et compresse les espaces, comme cleanText() côté client.
create or replace function private.clean_text(s text) returns text
language sql immutable as $$
  select trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(s, ''), '<[^>]*>', '', 'g'),
        '[  -​  ﻿]', ' ', 'g'),
      '\s+', ' ', 'g'));
$$;

-- Numéro tunisien normalisé en +216XXXXXXXX, ou null, comme normalizePhone().
create or replace function private.normalize_phone(raw text) returns text
language plpgsql immutable as $$
declare
  v_digits text;
  v_local text;
begin
  if raw is null then
    return null;
  end if;
  v_digits := regexp_replace(raw, '[^0-9+]', '', 'g');
  v_local := regexp_replace(v_digits, '^\+?216', '');
  v_local := regexp_replace(v_local, '^00216', '');
  if v_local !~ '^[2-579]\d{7}$' then
    return null;
  end if;
  return '+216' || v_local;
end;
$$;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_phone text := private.normalize_phone(v_meta ->> 'phone');
  v_name text := left(private.clean_text(coalesce(v_meta ->> 'name', '')), 60);
  v_email text := nullif(lower(trim(coalesce(v_meta ->> 'email', ''))), '');
begin
  if v_phone is null then
    return new;
  end if;
  if length(v_name) < 1 then
    v_name := 'Client';
  end if;
  insert into public.customers (id, name, phone, email)
  values (new.id, v_name, v_phone, left(v_email, 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
