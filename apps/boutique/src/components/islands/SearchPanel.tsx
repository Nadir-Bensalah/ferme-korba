import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Category, Lang, Product, Recipe } from '@ferme/core';
import { displayPrice, seedCategories, seedProducts, seedRecipes } from '@ferme/core';
import { t, L } from '@/i18n';
import { asset, href, routes } from '@/lib/paths';
import { data } from '@/lib/data';
import { search, type Hit, type PageEntry } from '@/lib/search';

interface Props {
  lang: Lang;
  open: boolean;
  onClose: () => void;
}

const PAGES: PageEntry[] = [
  { id: 'shop', path: routes.shop, label: { fr: 'La boutique', ar: 'المتجر' }, keywords: { fr: 'produits acheter commander prix', ar: 'منتجات شراء طلب أسعار' } },
  { id: 'farm', path: routes.farm, label: { fr: 'La ferme', ar: 'المزرعة' }, keywords: { fr: 'histoire élevage plein air korba famille', ar: 'قصة تربية هواء طلق قربة عائلة' } },
  { id: 'quality', path: routes.quality, label: { fr: 'Notre qualité', ar: 'جودتنا' }, keywords: { fr: 'engagements antibiotique froid vétérinaire questions', ar: 'التزامات مضادات حيوية تبريد بيطري أسئلة' } },
  { id: 'recipes', path: routes.recipes, label: { fr: 'Recettes', ar: 'وصفات' }, keywords: { fr: 'cuisine idées plats', ar: 'طبخ أفكار أطباق' } },
  { id: 'contact', path: routes.contact, label: { fr: 'Contact', ar: 'اتصل بنا' }, keywords: { fr: 'téléphone whatsapp adresse horaires itinéraire', ar: 'هاتف واتساب عنوان أوقات طريق' } },
  { id: 'tracking', path: routes.tracking, label: { fr: 'Suivre ma commande', ar: 'تتبّع طلبي' }, keywords: { fr: 'suivi commande statut livraison', ar: 'تتبع طلب حالة توصيل' } },
  { id: 'account', path: routes.account, label: { fr: 'Mon compte', ar: 'حسابي' }, keywords: { fr: 'connexion inscription commandes', ar: 'دخول تسجيل طلبات' } },
  { id: 'cart', path: routes.cart, label: { fr: 'Panier', ar: 'السلة' }, keywords: { fr: 'panier commander', ar: 'سلة طلب' } },
  { id: 'terms', path: routes.terms, label: { fr: 'Conditions de vente', ar: 'شروط البيع' }, keywords: { fr: 'cgv livraison paiement retour', ar: 'شروط توصيل دفع إرجاع' } },
];

/**
 * Panneau de recherche : un champ, des résultats groupés (produits, recettes,
 * pages), navigation au clavier. Les produits viennent du site tel que construit,
 * puis se rafraîchissent depuis la base si elle est branchée.
 */
export default function SearchPanel({ lang, open, onClose }: Props) {
  const d = t(lang);
  const [q, setQ] = useState('');
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [categories, setCategories] = useState<Category[]>(seedCategories);
  const [recipes, setRecipes] = useState<Recipe[]>(seedRecipes);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    document.documentElement.style.overflow = 'hidden';
    const id = requestAnimationFrame(() => input.current?.focus());
    const src = data();
    if (src.kind === 'supabase') {
      Promise.all([src.listProducts(), src.listCategories(), src.listRecipes()])
        .then(([p, c, r]) => {
          setProducts(p);
          setCategories(c);
          setRecipes(r);
        })
        .catch(() => {});
    }
    return () => {
      cancelAnimationFrame(id);
      document.documentElement.style.overflow = '';
      opener.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    const off = () => onClose();
    document.addEventListener('astro:before-swap', off);
    return () => document.removeEventListener('astro:before-swap', off);
  }, [onClose]);

  const results = useMemo(() => search(q, { products, categories, recipes, pages: PAGES }, lang), [q, products, categories, recipes, lang]);
  const flat: Hit[] = useMemo(() => [...results.products, ...results.recipes, ...results.pages], [results]);
  useEffect(() => setCursor(0), [q]);

  const linkOf = (h: Hit): string =>
    h.kind === 'product' ? href(lang, routes.product(h.product.slug)) : h.kind === 'recipe' ? href(lang, routes.recipe(h.recipe.slug)) : href(lang, h.page.path);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(flat.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter' && flat[cursor]) {
      e.preventDefault();
      window.location.href = linkOf(flat[cursor]!);
    }
  };

  if (!open || typeof document === 'undefined') return null;
  const trimmed = q.trim();
  const none = trimmed.length > 0 && flat.length === 0;
  let idx = -1;

  const Row = ({ hit, children }: { hit: Hit; children: React.ReactNode }) => {
    idx += 1;
    const active = idx === cursor;
    const my = idx;
    return (
      <li>
        <a
          href={linkOf(hit)}
          className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${active ? 'bg-prairie-soft' : 'hover:bg-cream'}`}
          onMouseEnter={() => setCursor(my)}
          aria-selected={active}
          role="option"
        >
          {children}
        </a>
      </li>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={d.search.label}>
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mt-[max(0px,env(safe-area-inset-top))] w-full max-w-2xl overflow-hidden rounded-xl bg-paper shadow-float animate-pop" style={{ maxHeight: 'calc(100dvh - 24px)' }}>
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 sm:px-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ink-3">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={input}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={d.search.placeholder}
            className="min-h-12 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-label={d.search.label}
            aria-controls="search-results"
            aria-activedescendant={flat[cursor] ? `search-hit-${cursor}` : undefined}
          />
          <button type="button" onClick={onClose} className="rounded-pill p-2 text-ink-2 hover:bg-cream" aria-label={d.search.close}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div id="search-results" className="overflow-y-auto overscroll-contain p-2 sm:p-3" style={{ maxHeight: 'calc(100dvh - 24px - 60px)' }} role="listbox">
          {!trimmed && <p className="px-3 py-6 text-center text-sm text-ink-3">{d.search.start}</p>}
          {none && <p className="px-3 py-6 text-center text-sm text-ink-2">{d.search.empty(trimmed)}</p>}

          {results.products.length > 0 && (
            <section className="mb-2">
              <h2 className="eyebrow px-3 pb-1 pt-2">{d.search.products}</h2>
              <ul>
                {results.products.map((h) => {
                  if (h.kind !== 'product') return null;
                  const p = h.product;
                  const price = displayPrice(p.pricing, lang);
                  return (
                    <Row hit={h} key={p.id}>
                      <img src={asset(p.images[0] ?? '')} alt="" width={48} height={48} className={`h-12 w-12 shrink-0 rounded-md object-cover ${p.stock === 'rupture' ? 'grayscale' : ''}`} loading="lazy" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{L(p.name, lang)}</span>
                        <span className="block truncate text-xs text-ink-3">{L(h.category?.name, lang)}</span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-end text-sm font-bold text-ink tabular">
                        {p.stock === 'rupture' ? <span className="text-ink-3">{d.common.outOfStock}</span> : price.amount}
                        {p.stock !== 'rupture' && <span className="block text-[11px] font-semibold text-ink-3">{price.unit}</span>}
                      </span>
                    </Row>
                  );
                })}
              </ul>
            </section>
          )}

          {results.recipes.length > 0 && (
            <section className="mb-2">
              <h2 className="eyebrow px-3 pb-1 pt-2">{d.search.recipes}</h2>
              <ul>
                {results.recipes.map((h) => {
                  if (h.kind !== 'recipe') return null;
                  const r = h.recipe;
                  return (
                    <Row hit={h} key={r.id}>
                      <img src={asset(r.image)} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-md object-cover" loading="lazy" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{L(r.title, lang)}</span>
                        <span className="block text-xs text-ink-3">
                          {r.duration_min} {d.common.minutes} · {r.servings} {d.common.servings}
                        </span>
                      </span>
                    </Row>
                  );
                })}
              </ul>
            </section>
          )}

          {results.pages.length > 0 && (
            <section className="mb-1">
              <h2 className="eyebrow px-3 pb-1 pt-2">{d.search.pages}</h2>
              <ul>
                {results.pages.map((h) => {
                  if (h.kind !== 'page') return null;
                  return (
                    <Row hit={h} key={h.page.id}>
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-cream text-prairie" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M13 6l6 6-6 6" className="rtl:-scale-x-100" />
                        </svg>
                      </span>
                      <span className="font-semibold text-ink">{L(h.page.label, lang)}</span>
                    </Row>
                  );
                })}
              </ul>
            </section>
          )}

          {trimmed && results.products.length > 0 && (
            <a href={href(lang, routes.shop)} className="mt-1 block rounded-md px-3 py-2.5 text-center text-sm font-bold text-prairie hover:bg-cream">
              {d.search.seeAllProducts}
            </a>
          )}
        </div>

        <p className="hidden border-t border-line px-4 py-2 text-xs text-ink-3 sm:block">{d.search.hint}</p>
      </div>
    </div>,
    document.body,
  );
}
