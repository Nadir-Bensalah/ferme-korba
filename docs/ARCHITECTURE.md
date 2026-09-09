# Architecture

Un seul dépôt, trois morceaux :

| Dossier | Rôle | Techno |
|---|---|---|
| `apps/boutique` | Site public : vitrine + boutique, FR et AR | Astro 5 (statique), îlots React, Tailwind 4, nanostores |
| `apps/admin` | Espace de gestion, servi sous `/admin/` | Vite + React 19, react-router (hash), react-query |
| `packages/core` | Ce que les deux partagent : types, règles de calcul, validation, jeu de démo, accès aux données | TypeScript, zod, supabase-js |
| `supabase` | Schéma SQL, règles d'accès, fonctions, seed | Postgres |

## Une source de données, deux implémentations

Les écrans parlent à une interface (`packages/core/src/data/source.ts`). Avec les clés
`PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` (boutique) ou `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` (gestion), c'est Supabase. Sans, c'est le mode démo : tout vit dans
le navigateur (`localStorage`). Le site GitHub Pages tourne en démo tant que la base n'est pas branchée.

Le calcul d'une commande (`packages/core/src/orders.ts`) est la référence : mêmes règles côté
navigateur (démo) et côté base (fonction SQL `create_order`). Le client n'envoie que des
identifiants et des quantités, le serveur recalcule tout.

## Chemins

Le site vit sous `/ferme-korba` sur GitHub Pages et à la racine sur un domaine dédié.
`BASE_PATH` règle ça. Dans la boutique, **tout lien passe par `href(lang, path)`** et
**tout fichier statique par `asset(path)`** (`apps/boutique/src/lib/paths.ts`).

## Langues

Français à la racine, arabe sous `/ar/`. Une page = une vue (`src/views/X.astro`, prop `lang`)
et deux fichiers de route très courts (`src/pages/x.astro`, `src/pages/ar/x.astro`).
Les textes d'interface sont dans `src/i18n/fr.ts` et `ar.ts`, les contenus (produits,
recettes) portent leurs deux langues (`{ fr, ar }`, lu avec `L(v, lang)`).

## Prix

Le dinar a trois décimales. Trois modes de vente : à la pièce, au kilo (le client choisit
un poids), au kilo estimé (le client choisit des pièces, le prix est ajusté à la pesée).
Tout est dans `packages/core/src/money.ts`.

## Images

Les originaux sont dans `assets/photos` (crédits dans `CREDITS.md`). `node scripts/images.mjs`
produit les JPEG et WebP dans `apps/boutique/public/images`. Le composant `Picture.astro`
sert le bon format.

## Déploiement

`.github/workflows/deploy.yml` : tests, vérification des types, construction des deux apps,
assemblage dans `dist/` (`scripts/build-pages.mjs`), publication sur GitHub Pages.

## Le décor

Le site emprunte la matière des sites agroalimentaires tunisiens : herbes posées
dans les marges, bords de sections irréguliers, photos aux contours organiques,
fonds en filigrane. Trois outils, dans `apps/boutique/src/components/deco` et à
la fin de `global.css` :

- **`Deco.astro`** : 14 dessins au trait (persil, coriandre, romarin, poivre,
  plume, oeuf, oeufs, ble, oranger, piment, ail, grain, poussin, poule).
  `<Deco type="persil" class="deco deco-lg -start-8 top-24 w-28 text-prairie/25" />`
  Toujours `aria-hidden`, jamais cliquable. `.deco-lg` disparaît sous 640 px.
- **`TornEdge.astro`** : bord déchiré (`torn`) ou ondulé (`wave`), posé DANS une
  section en `relative`. La couleur donnée en `text-*` est celle de la section
  suivante : le bord la fait mordre sur la section courante.
- **Classes CSS** : `.filigree` et `.filigree-green` (motif d'herbes très pâle en
  fond), `blob` et `blob-2` (masquent une image en forme de tache peinte),
  `.deco-sway` (balancement lent, désactivé si l'utilisateur réduit les animations).

Piège rencontré : dans une data URI SVG, la couleur s'écrit `%23xxxxxx`. Si le `#`
est encodé deux fois (`%2523`), le motif est bien chargé mais rien ne se dessine.

## Typographie

Titres : Baloo 2 extra-gras en français, Baloo Bhaijaan 2 gras en arabe. Texte courant :
Nunito Sans en français, Noto Sans Arabic en arabe. Tout se règle dans le bloc `@theme`
de `apps/boutique/src/styles/global.css` (familles) et dans `Base.astro` (fichiers Google Fonts).

La version précédente (Bricolage Grotesque + Manrope + Cairo) est gardée sous le repère git
`typo-v1-bricolage-manrope`. Pour y revenir :

```bash
git checkout typo-v1-bricolage-manrope -- apps/boutique/src/styles/global.css apps/boutique/src/layouts/Base.astro
```
