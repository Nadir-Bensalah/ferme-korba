import type { Lang } from '@ferme/core';
import { brand, formatPrice, seedSettings, seedZones } from '@ferme/core';
import { formatHour, L } from '@/i18n';
import type { LegalVars } from '@/i18n/fr';

/** Ce que les textes légaux citent : identité, hébergeur, minimum, heure limite, zones. Une seule source : `brand` et le jeu de données. */
export function legalVars(lang: Lang): LegalVars {
  const zones = seedZones
    .filter((z) => z.active)
    .sort((a, b) => a.sort - b.sort)
    .map((z) => `${L(z.name, lang)} (${L(z.areas, lang)})`)
    .join(lang === 'ar' ? '؛ ' : ' ; ');
  return {
    name: brand.name[lang],
    legal: brand.legal[lang],
    address: brand.address[lang],
    phone: brand.phoneDisplay,
    email: brand.email,
    since: brand.since,
    host:
      lang === 'ar'
        ? 'GitHub Pages (GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, الولايات المتحدة)'
        : 'GitHub Pages (GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis)',
    minOrder: formatPrice(seedSettings.min_order, lang),
    cutoff: formatHour(seedSettings.cutoff_time, lang),
    zones,
  };
}
