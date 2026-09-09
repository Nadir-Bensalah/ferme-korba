# Ferme Korba

Site vitrine et boutique en ligne d'un élevage de volailles à Korba (Tunisie), avec paiement à la
livraison et un espace de gestion des commandes. Français et arabe. Pensé pour le téléphone d'abord.

- Site : https://nadir-bensalah.github.io/ferme-korba/
- Espace de gestion : https://nadir-bensalah.github.io/ferme-korba/admin/ (démo : `demo@ferme-korba.tn` / `demo1234`)

## Démarrer

```bash
npm install
npm run dev          # boutique sur http://localhost:4321
npm run dev:admin    # gestion sur http://localhost:4322
npm test             # règles de calcul et de validation
npm run check        # types
npm run build:pages  # dist/ prêt pour GitHub Pages
```

Sans clés Supabase, tout tourne en mode démo dans le navigateur. Pour brancher la base,
voir `docs/SUPABASE.md`. Pour comprendre le découpage, voir `docs/ARCHITECTURE.md`.

## Personnaliser

Nom, téléphone, adresse, réseaux : `packages/core/src/config.ts`. Logo : `apps/boutique/src/components/Logo.astro`.
Produits, zones, créneaux, réglages : dans l'espace de gestion, ou `packages/core/src/seed.ts` pour le jeu de départ.

Réalisé par [Capmedia Digital](https://capmedia.tn).
