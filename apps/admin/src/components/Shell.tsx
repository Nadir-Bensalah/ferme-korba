import { useEffect, useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Download,
  LayoutDashboard,
  LogOut,
  Mail,
  MoreHorizontal,
  Package,
  Route,
  Search,
  Settings,
  ShoppingBag,
  Tags,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { brand } from '@ferme/core';
import { isDemo } from '@/lib/data';
import { imageUrl } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { useNewOrders } from '@/hooks/useNewOrders';
import { useMessages, useNewOrdersCount } from '@/lib/queries';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Correspondance exacte, sinon par préfixe. */
  exact?: boolean;
  badge?: number;
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex min-h-12 items-center gap-2.5 px-1">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8" />
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-base font-bold">{brand.name.fr}</span>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3">Gestion</span>
        </span>
      )}
    </Link>
  );
}

export const SECONDARY_PATHS = ['/categories', '/recettes', '/livraison', '/clients', '/messages', '/reglages', '/export', '/plus'];

export function Shell() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { markSeen } = useNewOrders();
  const { data: newCount = 0 } = useNewOrdersCount();
  const { data: messages } = useMessages();
  const unread = messages?.filter((m) => !m.read).length ?? 0;
  const [q, setQ] = useState('');

  useEffect(() => {
    if (location.pathname.startsWith('/commandes')) markSeen();
  }, [location.pathname, markSeen]);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    navigate(`/commandes?q=${encodeURIComponent(term)}&status=toutes`);
  };

  const path = location.pathname;
  const isActive = (item: NavItem) => {
    if (item.exact) return path === item.to;
    if (item.to === '/commandes') return path.startsWith('/commandes') && !path.startsWith('/commandes/aujourdhui');
    return path.startsWith(item.to);
  };

  const main: NavItem[] = [
    { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
    { to: '/commandes', label: 'Commandes', icon: ShoppingBag, badge: newCount },
    { to: '/commandes/aujourdhui', label: 'Tournée du jour', icon: Route },
    { to: '/produits', label: 'Produits', icon: Package },
    { to: '/categories', label: 'Catégories', icon: Tags },
    { to: '/recettes', label: 'Recettes', icon: BookOpen },
    { to: '/livraison', label: 'Livraison', icon: Truck },
    { to: '/clients', label: 'Clients', icon: Users },
    { to: '/messages', label: 'Messages', icon: Mail, badge: unread },
    { to: '/export', label: 'Export', icon: Download },
    { to: '/reglages', label: 'Réglages', icon: Settings },
  ];

  const tabs: NavItem[] = [
    { to: '/', label: 'Tableau', icon: LayoutDashboard, exact: true },
    { to: '/commandes', label: 'Commandes', icon: ShoppingBag, badge: newCount },
    { to: '/produits', label: 'Produits', icon: Package },
    { to: '/plus', label: 'Plus', icon: MoreHorizontal, badge: unread },
  ];
  const plusActive = SECONDARY_PATHS.some((p) => path.startsWith(p));

  return (
    <div className="min-h-dvh md:pl-[var(--sidebar-w)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] flex-col border-r border-line bg-paper md:flex">
        <div className="px-3 pt-3">
          <Logo />
        </div>
        <nav className="mt-2 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3" aria-label="Navigation principale">
          {main.map((item) => (
            <Link key={item.to} to={item.to} className={`nav-item ${isActive(item) ? 'active' : ''}`} aria-current={isActive(item) ? 'page' : undefined}>
              <item.icon className="size-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge ? <span className="badge-count">{item.badge}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="truncate px-1 text-xs text-ink-3">{admin?.email}</div>
          <button type="button" className="nav-item mt-1 w-full" onClick={() => void logout()}>
            <LogOut className="size-5" /> Se déconnecter
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-[var(--header-h)] w-full max-w-6xl items-center gap-2 px-3 md:px-6">
          <div className="md:hidden">
            <Logo compact />
          </div>
          <form onSubmit={submitSearch} className="relative flex-1" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Numéro, nom ou téléphone"
              aria-label="Rechercher une commande"
              className="field field-sm pl-9"
              enterKeyHint="search"
            />
          </form>
          <Link to="/commandes?status=nouvelle" className="btn-ghost btn-sm relative hidden sm:inline-flex" aria-label="Commandes à confirmer">
            À confirmer
            {newCount > 0 && <span className="badge-count">{newCount}</span>}
          </Link>
        </div>
        {isDemo && (
          <div className="bg-yolk-soft px-3 py-1 text-center text-xs font-semibold text-yolk-deep">
            Mode démo : les données restent dans ce navigateur.{' '}
            <Link to="/reglages" className="underline">
              Réglages
            </Link>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl px-3 py-4 pb-bottom-bar md:px-6 md:py-6 md:pb-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper safe-bottom md:hidden" aria-label="Navigation">
        <div className="flex h-[var(--bottom-bar-h)]">
          {tabs.map((item) => {
            const active = item.to === '/plus' ? plusActive : isActive(item);
            return (
              <Link key={item.to} to={item.to} className={`tab-item relative ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
                <item.icon className="size-6" />
                {item.label}
                {item.badge ? <span className="badge-count absolute right-[calc(50%-1.6rem)] top-1.5">{item.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export { imageUrl };
