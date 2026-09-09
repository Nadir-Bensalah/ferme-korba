import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '@ferme/core';
import { t } from '@/i18n';
import RollingText from './RollingText';
import { useMounted } from './shared';

/**
 * Tri et filtre de la grille de la boutique. La grille est construite par
 * Astro : cet îlot ne la reconstruit pas, il range et masque les cartes déjà
 * là, ce qui garde les photos, les boutons d'ajout et les transitions.
 *
 * Le choix vit dans l'adresse (?tri=, ?stock=) : une page triée se partage et
 * se retrouve dans l'historique. Sans JavaScript, la grille reste dans son
 * ordre de départ, complète : rien ne manque, il n'y a juste pas de tri.
 *
 * ShopLive corrige les prix et les stocks à l'exécution puis émet
 * « shop:live » : on réapplique alors le tri sur les valeurs fraîches.
 */
export type SortKey = 'populaire' | 'prix-asc' | 'prix-desc';

interface Props {
  lang: Lang;
  /** Nombre de produits construits dans la page, avant tout filtre. */
  total: number;
  /** Adresse de la boutique complète, pour vider les filtres. */
  shopUrl: string;
}

const SORTS: SortKey[] = ['populaire', 'prix-asc', 'prix-desc'];

function readParams(): { sort: SortKey; inStock: boolean } {
  if (typeof window === 'undefined') return { sort: 'populaire', inStock: false };
  const p = new URLSearchParams(window.location.search);
  const raw = p.get('tri') as SortKey | null;
  return { sort: raw && SORTS.includes(raw) ? raw : 'populaire', inStock: p.get('stock') === 'oui' };
}

export default function ShopControls({ lang, total, shopUrl }: Props) {
  const d = t(lang);
  const mounted = useMounted();
  const [sort, setSort] = useState<SortKey>('populaire');
  const [inStock, setInStock] = useState(false);
  const [count, setCount] = useState(total);
  const [busy, setBusy] = useState(false);

  /** Range et masque les cartes déjà présentes dans la grille. */
  const apply = useCallback(
    (nextSort: SortKey, nextStock: boolean) => {
      const grid = document.querySelector<HTMLElement>('[data-shop-grid]');
      if (!grid) return;
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-product-id]'));
      let visible = 0;
      for (const card of cards) {
        const gone = card.dataset.gone === '1';
        // « En stock » veut dire disponible aujourd'hui : « bientôt de retour »
        // ne l'est pas, il sort donc du filtre lui aussi.
        const out = card.dataset.stock !== 'en_stock';
        const show = !gone && !(nextStock && out);
        card.hidden = !show;
        if (show) visible += 1;
      }
      const key = (el: HTMLElement) => Number(el.dataset.price ?? 0);
      const rank = (el: HTMLElement) => Number(el.dataset.order ?? 0);
      const pop = (el: HTMLElement) => Number(el.dataset.pop ?? 9);
      const sorted = [...cards].sort((a, b) => {
        if (nextSort === 'prix-asc') return key(a) - key(b) || rank(a) - rank(b);
        if (nextSort === 'prix-desc') return key(b) - key(a) || rank(a) - rank(b);
        return pop(a) - pop(b) || rank(a) - rank(b);
      });
      sorted.forEach((el) => grid.appendChild(el));
      setCount(visible);

      const empty = document.querySelector<HTMLElement>('[data-shop-empty]');
      if (empty) {
        empty.hidden = visible > 0;
        // Une grille vidée par le filtre ne dit pas la même chose qu'une
        // catégorie vide : on change le texte, pas le bloc.
        const filtered = visible === 0 && nextStock;
        const title = empty.querySelector<HTMLElement>('[data-empty-title]');
        const text = empty.querySelector<HTMLElement>('[data-empty-text]');
        if (title) title.textContent = filtered ? d.shop.emptyFiltered : d.shop.empty;
        if (text) text.textContent = filtered ? d.shop.emptyHint : '';
      }
    },
    [d],
  );

  // Reprise de l'adresse au montage, puis application.
  useEffect(() => {
    const p = readParams();
    setSort(p.sort);
    setInStock(p.inStock);
    apply(p.sort, p.inStock);
  }, [apply]);

  // ShopLive a corrigé prix et stocks : on range de nouveau.
  useEffect(() => {
    const onLive = () => apply(sort, inStock);
    document.addEventListener('shop:live', onLive);
    return () => document.removeEventListener('shop:live', onLive);
  }, [apply, sort, inStock]);

  const change = (nextSort: SortKey, nextStock: boolean) => {
    setSort(nextSort);
    setInStock(nextStock);
    const url = new URL(window.location.href);
    if (nextSort === 'populaire') url.searchParams.delete('tri');
    else url.searchParams.set('tri', nextSort);
    if (nextStock) url.searchParams.set('stock', 'oui');
    else url.searchParams.delete('stock');
    window.history.replaceState({}, '', url);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      apply(nextSort, nextStock);
      return;
    }
    // Un souffle de fondu pendant que la grille se range : l'œil suit,
    // au lieu de voir les cartes sauter d'un coup.
    setBusy(true);
    window.setTimeout(() => {
      apply(nextSort, nextStock);
      setBusy(false);
    }, 140);
  };

  useEffect(() => {
    const grid = document.querySelector<HTMLElement>('[data-shop-grid]');
    if (grid) grid.dataset.busy = busy ? '1' : '0';
  }, [busy]);

  const label = d.shop.count(count);
  const clean = sort !== 'populaire' || inStock;

  // Avant l'hydratation, et donc sans JavaScript, il ne reste que le compte :
  // pas de commande morte, et la grille complète juste en dessous.
  if (!mounted) {
    return (
      <p className="mb-5 text-sm font-semibold text-ink-3" data-product-count>
        {label}
      </p>
    );
  }

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-3" aria-live="polite">
        <RollingText value={label} />
        {clean && (
          <a href={shopUrl} className="text-prairie underline decoration-prairie/40 underline-offset-2 hover:text-prairie-deep">
            {d.shop.showAll}
          </a>
        )}
      </p>

      {/* Sur mobile les deux commandes restent sur une ligne qui se fait
          glisser au doigt, comme la barre de catégories juste au-dessus. */}
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 scrollbar-none [mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none]">
        <label className="sr-only" htmlFor="tri">
          {d.shop.sort}
        </label>
        <div className="relative shrink-0">
          <span className="pointer-events-none absolute inset-y-0 start-3 hidden items-center text-ink-3 sm:flex" aria-hidden="true">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 20V4.6M3.6 8 7 4.6 10.4 8" />
              <path d="M17 4v15.4M13.6 16l3.4 3.4 3.4-3.4" />
            </svg>
          </span>
          <select
            id="tri"
            className="appearance-none rounded-pill border-2 border-line bg-paper ps-4 pe-9 text-sm font-bold text-ink transition-colors hover:border-line-2 sm:ps-9"
            style={{ minHeight: '48px' }}
            value={sort}
            onChange={(e) => change(e.target.value as SortKey, inStock)}
          >
            <option value="populaire">{d.shop.sortPopular}</option>
            <option value="prix-asc">{d.shop.sortPriceUp}</option>
            <option value="prix-desc">{d.shop.sortPriceDown}</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-ink-3" aria-hidden="true">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>

        <button type="button" className="choice-pill gap-2 active:scale-[0.97] motion-reduce:active:scale-100" aria-pressed={inStock} onClick={() => change(sort, !inStock)}>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 transition-colors ${inStock ? 'border-prairie bg-prairie text-white' : 'border-line-2 bg-paper text-transparent'}`} aria-hidden="true">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 5 5 9-10.5" />
            </svg>
          </span>
          {d.shop.inStockOnly}
        </button>
      </div>
    </div>
  );
}
