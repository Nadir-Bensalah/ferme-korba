import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatPrice } from '@ferme/core';
import { source, APP_TITLE } from '@/lib/data';
import { invalidateOrders } from '@/lib/queries';
import { getPrefs } from '@/lib/prefs';
import { armAudio, playChime } from '@/lib/sound';
import { showLocalNotification } from '@/lib/notify';
import { relativeDay } from '@/lib/format';
import { useToast } from './useToast';

interface NewOrdersApi {
  unseen: number;
  markSeen(): void;
}

const Ctx = createContext<NewOrdersApi | null>(null);

/**
 * L'alerte à chaque commande vit ici, et nulle part ailleurs : toast persistant,
 * son bref, titre de l'onglet préfixé, notification système si permise.
 */
export function NewOrdersProvider({ children, navigate }: { children: ReactNode; navigate: (to: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [unseen, setUnseen] = useState(0);
  const nav = useRef(navigate);
  nav.current = navigate;

  useEffect(() => {
    armAudio();
  }, []);

  useEffect(() => {
    document.title = unseen > 0 ? `(${unseen}) ${APP_TITLE}` : APP_TITLE;
  }, [unseen]);

  useEffect(() => {
    const off = source.onNewOrder((order) => {
      invalidateOrders(qc);
      setUnseen((n) => n + 1);
      const body = `${order.customer.name} · ${formatPrice(order.total, 'fr')} · ${relativeDay(order.delivery_date)}`;
      toast.push({ kind: 'order', title: `Nouvelle commande ${order.number}`, body, to: `/commandes/${order.id}`, persistent: true });
      const prefs = getPrefs();
      if (prefs.sound) playChime();
      if (prefs.notifications) showLocalNotification(`Nouvelle commande ${order.number}`, body, () => nav.current(`/commandes/${order.id}`));
    });
    return off;
  }, [qc, toast]);

  const markSeen = useCallback(() => setUnseen(0), []);
  const api = useMemo(() => ({ unseen, markSeen }), [unseen, markSeen]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useNewOrders(): NewOrdersApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('NewOrdersProvider manquant');
  return api;
}
