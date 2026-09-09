# Supabase

La base vit dans `supabase/` : les migrations dans `supabase/migrations/`, le jeu de départ dans
`supabase/seed.sql` (généré par `node scripts/seed-sql.mjs` depuis `packages/core/src/seed.ts`,
ne jamais le modifier à la main).

## Migrations

| Fichier | Ce qu'elle pose |
|---|---|
| `0001_schema.sql` | Tables du catalogue, de la livraison, des comptes et des commandes, `is_admin()`, triggers `updated_at`. |
| `0002_policies.sql` | Droits (GRANT) et RLS : lecture publique du catalogue, écriture réservée aux admins. |
| `0003_functions.sql` | `create_order`, `get_order_by_token`, `send_contact`, `list_my_orders`, `set_order_status`, `set_weighed`, `admin_stats`, `admin_customers`. |
| `0004_storage_realtime.sql` | Bucket `products` (photos) et publication Realtime sur `orders`. |
| `0005_offers.sql` | Table `offers` (offre du jour, pack combiné, spécial saison) : le public lit les actives, l'admin écrit, index `(active, sort)`. |

## Tables

- `categories`, `products`, `recipes` : le catalogue, lecture publique.
- `offers` : les offres mises en avant sur l'accueil et la boutique. Une ligne = `Offer`
  (`packages/core/src/types.ts`), textes bilingues en jsonb `{fr, ar}`, `product_slugs` pour
  « Ajouter le pack », `ends_at` vide = l'offre du jour se termine à l'heure limite de commande.
- `delivery_zones`, `delivery_slots`, `settings` : la livraison et les réglages.
- `customers`, `admins` : les comptes. Un admin s'ajoute à la main dans `admins` (SQL Editor).
- `orders`, `order_items`, `order_events`, `order_counters` : les commandes, écrites uniquement par les fonctions.
- `contact_messages` : le formulaire de contact.

## Lancer en local

```
supabase start
supabase db reset        # rejoue les migrations puis seed.sql
```

## Clés

Boutique : `PUBLIC_SUPABASE_URL` et `PUBLIC_SUPABASE_ANON_KEY`. Espace de gestion :
`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`. Sans clés, les deux tournent en mode démo.
