/**
 * Identité de la ferme. C'est LE fichier à modifier quand le client donne son
 * nom, son logo et ses coordonnées. Rien d'autre à chercher.
 */
export const brand = {
  name: { fr: 'Ferme Korba', ar: 'مزرعة قربة' },
  tagline: {
    fr: 'Volailles fermières et charcuterie, de notre ferme à votre table',
    ar: 'دواجن بلدية وشاركوتري، من مزرعتنا إلى مائدتكم',
  },
  /** Numéro affiché et appelé. Format international sans espace. */
  phone: '+21651788518',
  phoneDisplay: '51 788 518',
  whatsapp: '+21651788518',
  email: 'contact@ferme-korba.tn',
  address: {
    fr: 'Route de Menzel Temime, 8070 Korba, Nabeul',
    ar: 'طريق منزل تميم، 8070 قربة، نابل',
  },
  /** Coordonnées pour la carte et les données structurées. */
  geo: { lat: 36.5786, lng: 10.8583 },
  hours: {
    fr: 'Du lundi au samedi, de 8 h à 19 h',
    ar: 'من الاثنين إلى السبت، من 8 صباحاً إلى 7 مساءً',
  },
  social: {
    facebook: 'https://facebook.com/',
    instagram: 'https://instagram.com/',
    tiktok: '',
  },
  /** Année de création, affichée dans « la ferme ». */
  since: 1998,
  /** Domaine public final. Le site GitHub Pages sert en attendant. */
  siteUrl: 'https://nadir-bensalah.github.io/ferme-korba',
  legal: {
    fr: 'Ferme Korba, élevage familial, Korba, Nabeul, Tunisie',
    ar: 'مزرعة قربة، تربية عائلية، قربة، نابل، تونس',
  },
} as const;

export const currency = {
  code: 'TND',
  /** Le dinar a trois décimales : 12,500 DT. */
  decimals: 3,
  symbol: { fr: 'DT', ar: 'د.ت' },
} as const;

/** Préfixe des numéros de commande : FK-2026-00042 */
export const ORDER_PREFIX = 'FK';
