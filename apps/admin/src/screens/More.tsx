import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Download, LogOut, Mail, Percent, Route, Settings, Tags, Truck, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/lib/queries';
import { isDemo } from '@/lib/data';
import { PageHeader } from '@/components/PageHeader';

const items: { to: string; label: string; icon: LucideIcon; hint?: string }[] = [
  { to: '/commandes/aujourdhui', label: 'Tournée du jour', icon: Route, hint: 'Les livraisons par créneau' },
  { to: '/offres', label: 'Offres', icon: Percent, hint: 'Offre du jour, packs, saison' },
  { to: '/categories', label: 'Catégories', icon: Tags },
  { to: '/recettes', label: 'Recettes', icon: BookOpen },
  { to: '/livraison', label: 'Livraison', icon: Truck, hint: 'Zones et créneaux' },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/messages', label: 'Messages', icon: Mail },
  { to: '/export', label: 'Export CSV', icon: Download },
  { to: '/reglages', label: 'Réglages', icon: Settings, hint: 'Boutique, alertes, son' },
];

/** Menu « Plus » de la barre d'onglets, sur téléphone. */
export function More() {
  const { admin, logout } = useAuth();
  const { data: messages } = useMessages();
  const unread = messages?.filter((m) => !m.read).length ?? 0;
  return (
    <div>
      <PageHeader title="Plus" subtitle={admin?.email} />
      <ul className="card-flat divide-y divide-line">
        {items.map((it) => (
          <li key={it.to}>
            <Link to={it.to} className="flex min-h-14 items-center gap-3 px-3">
              <it.icon className="size-5 text-prairie" />
              <span className="flex-1">
                <span className="block font-semibold">{it.label}</span>
                {it.hint && <span className="block text-xs text-ink-3">{it.hint}</span>}
              </span>
              {it.to === '/messages' && unread > 0 && <span className="badge-count">{unread}</span>}
              <ChevronRight className="size-4 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-ghost mt-4 w-full" onClick={() => void logout()}>
        <LogOut className="size-4" /> Se déconnecter
      </button>
      {isDemo && <p className="mt-3 text-center text-xs text-ink-3">Mode démo : les données restent dans ce navigateur.</p>}
    </div>
  );
}
